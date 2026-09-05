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
import time

from app.db.database import async_session_factory
from app.models.scenario import Scenario, ScenarioRun
from app.services.scenario_run_service import (
    TERMINAL_STATUSES,
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

DEFAULT_RUN_TIMEOUT_SECONDS = 120

_task: asyncio.Task | None = None
_stopping = False


async def execute_run(run, db, *, client=None) -> str:
    """Drive one run to a terminal status and return it."""
    scenario = await db.get(Scenario, run.scenario_id)
    if scenario is None:
        moved = await finish_run(run, "error", "Scenario no longer exists", db)
        return "error" if moved else run.status

    if run.status != "running":
        await mark_running(run, db)

    namespace = build_namespace(scenario.variables, run.variables)
    steps = scenario.steps or []

    # The scenario's declared ceiling, enforced here rather than left to the
    # sweeper: `sweep_timed_out_runs` only runs between calls to `run_once`,
    # never while this coroutine is awaiting inside a run, so without a
    # per-step deadline a run's own `timeout_seconds` is unenforceable and one
    # user can occupy the single worker indefinitely. monotonic, not wall
    # clock, so a system clock adjustment mid-run can't distort the budget.
    timeout_budget = scenario.timeout_seconds or DEFAULT_RUN_TIMEOUT_SECONDS
    deadline = time.monotonic() + timeout_budget

    outcome = "passed"
    halted_at = None
    cancelled = False

    for index, step in enumerate(steps):
        step_type = step.get("type", "unknown") if isinstance(step, dict) else "unknown"

        if halted_at is None:
            # One check per step decides whether to keep going at all — has
            # another session moved this run to a terminal status (a user's
            # cancel), or has the scenario's declared timeout_seconds run out?
            # Refreshing here is what lets the cancel check see another
            # session's commit: this session's identity map otherwise keeps
            # showing "running" forever, no matter what anyone else commits.
            await db.refresh(run)
            if run.status in TERMINAL_STATUSES:
                cancelled = True
                halted_at = index
            elif deadline - time.monotonic() <= 0:
                outcome = "timeout"
                halted_at = index

        if halted_at is not None:
            await record_step_result(run, index, step_type, {"status": "skipped"}, db)
            await db.commit()
            continue

        remaining_budget = deadline - time.monotonic()
        result = await execute_step(
            step, namespace, client=client, budget_seconds=remaining_budget, db=db, scenario=scenario
        )
        await record_step_result(run, index, step_type, result, db)
        # Commit as we go rather than leaving every step uncommitted until the
        # run finishes. Uncommitted results are invisible to GET .../runs/{id}
        # for the run's whole duration, and the open write transaction pins a
        # pool connection, holding the xmin horizon against VACUUM. It also
        # means the cancel check above actually sees other sessions' commits.
        await db.commit()

        namespace.update(result.get("captured") or {})

        if result["status"] == "error":
            # An engine fault is not the customer's assertion failing, and the
            # run cannot meaningfully continue past it.
            outcome = "error"
            halted_at = index
        elif result["status"] == "failed":
            # A failed assertion fails the run but the remaining steps still
            # run, so one report shows every problem rather than only the first.
            # (outcome is never "error" here: that branch always sets
            # halted_at, and a halted run skips straight to the top of the
            # loop on every later iteration without reaching this branch.)
            outcome = "failed"
            if isinstance(step, dict) and step.get("stop_on_failure"):
                halted_at = index
        elif result["status"] == "timeout":
            # A wait clamps itself to the run's remaining budget, so a wait
            # that expires exactly when the run's own deadline does is the
            # run's timeout_seconds being exhausted, not the step's own
            # timeout_seconds — check the run deadline first so that case
            # reports the engine's ceiling (and its message) rather than
            # blaming the step. Only a wait that expired on its own terms,
            # with run budget still left, is the customer's test failing.
            if deadline - time.monotonic() <= 0:
                # Mirror the post-loop rule below: only ever *promote* a
                # "passed" outcome to "timeout". A step that already failed an
                # assertion (or errored) earned that verdict on its own terms,
                # and reporting "timeout" instead would erase the "failed"
                # signal CI actually needs to see.
                outcome = "timeout" if outcome == "passed" else outcome
            else:
                outcome = "failed" if outcome != "error" else outcome
            halted_at = index

    if cancelled:
        # The run is already terminal — another session's cancel_run got
        # there first. finish_run would just refuse this move, so don't call
        # it at all; the honest answer is whatever status is already durable.
        return run.status

    # The loop above only checks the deadline *before* each step, so a run
    # whose last (or only) step consumes the whole remaining budget still
    # reaches here with outcome == "passed" — Design §8's `timeout` state
    # would otherwise be unreachable for single-step runs. Only downgrade a
    # "passed" outcome: a step that already failed or errored earned that
    # verdict on its own terms and must not be relabelled just because the
    # clock also ran out.
    if outcome == "passed" and deadline - time.monotonic() <= 0:
        outcome = "timeout"

    # Refresh from the database immediately before the final write. `run` may
    # have been loaded minutes ago, at claim time, and this session's identity
    # map does not update it just because another session committed a change
    # in the meantime — a user's cancel_run (or the sweeper's timeout) in a
    # different session leaves this in-memory object still saying "running".
    # Without the refresh, finish_run's terminal-status check reads that stale
    # value, the guard never trips, and a cancelled run gets overwritten back
    # to "passed"/"failed"/"error" — the exact bug that guard exists to stop.
    await db.refresh(run)

    if outcome == "error":
        error = "A step could not be executed"
    elif outcome == "timeout":
        error = f"Run exceeded its {timeout_budget}s timeout_seconds"
    else:
        error = None
    moved = await finish_run(run, outcome, error, db)
    return outcome if moved else run.status


async def run_once(db, *, client=None) -> bool:
    """Sweep stale runs, then claim and execute at most one run.

    Commits the claim itself (see below), but leaves the sweep and the run's
    final status write for the caller to commit — that split is deliberate
    (it is what lets tests drive `execute_run` directly against a single
    session), but it means a caller that forgets the final commit will see a
    run "finish" in memory without it ever becoming durable.
    """
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

    run_id = run.id
    try:
        await execute_run(run, db, client=client)
    except Exception as exc:
        # execute_run's own failure (e.g. a ForeignKeyViolation/StaleDataError
        # from a concurrently deleted scenario cascading away the run row)
        # leaves this session's transaction aborted. `run_id` is captured
        # above, before anything can fail: once the transaction is aborted,
        # reading an attribute on `run` that a failed flush expired requires
        # a fresh SELECT, and issuing one on a transaction that still needs a
        # rollback raises PendingRollbackError — which would skip this whole
        # rescue and leave the run "running" until the sweeper collects it.
        # Roll back before logging, for the same reason: the log call below
        # only touches `run_id`, a plain local, but nothing after it may run
        # if the rollback hasn't happened yet.
        try:
            await db.rollback()
        except Exception:
            pass
        logger.exception("Scenario run %s crashed", run_id)
        try:
            # Re-fetch rather than reuse the stale in-memory object: that
            # object still says "running", which would let finish_run's
            # terminal-status guard through even though the row may no
            # longer exist at all.
            fresh = await db.get(ScenarioRun, run_id)
            if fresh is not None:
                await finish_run(fresh, "error", str(exc) or exc.__class__.__name__, db)
                await db.commit()
        except Exception:
            logger.exception("Could not record the failure of run %s", run_id)
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
    if _task is not None and not _task.done():
        # A second call would otherwise orphan the first task: it keeps
        # polling forever with no handle left to cancel it.
        return
    _stopping = False
    _task = asyncio.create_task(_loop())


async def stop_worker() -> None:
    global _task, _stopping
    _stopping = True
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Scenario worker task raised during shutdown")
        _task = None
