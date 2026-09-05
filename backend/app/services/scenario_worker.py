"""The scenario worker.

A run holds state for seconds to minutes, so it cannot occupy a request
handler. v1 is an asyncio task started in the FastAPI lifespan, pulling queued
runs from Postgres. That avoids adding a broker to a box already running
Postgres, Redis, Caddy and two apps; when it outgrows that, the upgrade is a
separate process against the same table, with no schema change.

`execute_run` and `run_once` are ordinary awaitables so the engine's behaviour
is testable without starting the loop.
"""

import asyncio
import logging

from app.db.database import async_session_factory
from app.models.scenario import Scenario
from app.services.scenario_run_service import (
    claim_next_run,
    finish_run,
    mark_running,
    record_step_result,
    sweep_timed_out_runs,
)
from app.services.scenario_steps import execute_step
from app.services.scenario_variables import build_namespace

logger = logging.getLogger(__name__)

POLL_SECONDS = 1.0

_task: asyncio.Task | None = None
_stopping = False


async def execute_run(run, db, *, client=None) -> str:
    """Drive one run to a terminal status and return it."""
    scenario = await db.get(Scenario, run.scenario_id)
    if scenario is None:
        await finish_run(run, "error", "Scenario no longer exists", db)
        return "error"

    if run.status != "running":
        await mark_running(run, db)

    namespace = build_namespace(scenario.variables, run.variables)
    steps = scenario.steps or []

    outcome = "passed"
    halted_at = None

    for index, step in enumerate(steps):
        if halted_at is not None:
            await record_step_result(
                run, index, (step or {}).get("type", "unknown"), {"status": "skipped"}, db
            )
            continue

        result = await execute_step(step, namespace, client=client)
        await record_step_result(run, index, (step or {}).get("type", "unknown"), result, db)

        namespace.update(result.get("captured") or {})

        if result["status"] == "error":
            # An engine fault is not the customer's assertion failing, and the
            # run cannot meaningfully continue past it.
            outcome = "error"
            halted_at = index
        elif result["status"] == "failed":
            # A failed assertion fails the run but the remaining steps still
            # run, so one report shows every problem rather than only the first.
            outcome = "failed" if outcome != "error" else outcome
            if (step or {}).get("stop_on_failure"):
                halted_at = index

    error = None if outcome != "error" else "A step could not be executed"
    await finish_run(run, outcome, error, db)
    return outcome


async def run_once(db, *, client=None) -> bool:
    """Sweep stale runs, then claim and execute at most one run."""
    await sweep_timed_out_runs(db)

    run = await claim_next_run(db)
    if run is None:
        return False

    await mark_running(run, db)

    # Commit the claim immediately, before executing anything. The claim query
    # takes FOR UPDATE on the scenario row as well as the run row, and holding
    # that for the whole run would block a user editing or deleting the
    # scenario until the run finished. Once the run is committed as `running`,
    # the NOT EXISTS predicate is what keeps other workers off this scenario —
    # the row lock has done its job and is no longer needed.
    await db.commit()

    try:
        await execute_run(run, db, client=client)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Scenario run %s crashed", run.id)
        await finish_run(run, "error", str(exc) or exc.__class__.__name__, db)
    return True


async def _loop() -> None:
    while not _stopping:
        try:
            async with async_session_factory() as db:
                did_work = await run_once(db)
                await db.commit()
            if not did_work:
                await asyncio.sleep(POLL_SECONDS)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Scenario worker iteration failed")
            await asyncio.sleep(POLL_SECONDS)


async def start_worker() -> None:
    global _task, _stopping
    _stopping = False
    _task = asyncio.create_task(_loop())


async def stop_worker() -> None:
    global _task, _stopping
    _stopping = True
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):
            pass
        _task = None
