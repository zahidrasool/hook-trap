"""Run lifecycle and the Postgres run queue.

The queue is a table rather than Redis because a run must survive a restart,
and Redis is optional everywhere else in this codebase. Claiming uses
FOR UPDATE SKIP LOCKED so several workers can share the table without
coordinating.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult
from app.models.workspace import Workspace

TERMINAL_STATUSES = frozenset({"passed", "failed", "error", "timeout", "cancelled"})


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create_run(scenario: Scenario, variables: dict, trigger: str, db: AsyncSession) -> ScenarioRun:
    run = ScenarioRun(
        scenario_id=scenario.id,
        workspace_id=scenario.workspace_id,
        status="pending",
        trigger=trigger,
        variables=variables or {},
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def claim_next_run(db: AsyncSession) -> ScenarioRun | None:
    """Oldest pending run whose WORKSPACE has nothing already running.

    Serialisation is per workspace, not per scenario, and that is deliberate.
    Per-scenario would be enough to keep one scenario's interdependent runs in
    order, but `wait_for_email` matches on the workspace inbox — an email
    carries no scenario or run marker, so two runs overlapping inside one
    workspace would race for the same message and each could take the other's.
    Serialising the workspace removes that race by construction rather than by
    correlation, which no amount of matching on recency can do.

    The parallelism that actually matters is untouched: different workspaces
    run concurrently, so one tenant's slow scenario cannot delay another's CI.
    What is given up is two scenarios of the SAME workspace overlapping, which
    is the exact case that cannot be made safe today.

    The NOT EXISTS subquery must reference a separate alias of scenario_runs
    and correlate to the outer row's workspace_id — an un-aliased self
    reference resolves to a tautology (matches every row against itself) and
    silently stops correlating to the outer query at all, which would block
    every workspace whenever any run anywhere was running.

    SKIP LOCKED alone only stops two workers claiming the same row — it does
    nothing about two workers claiming two *different* pending rows of the
    same workspace, since under READ COMMITTED a second worker's snapshot
    still shows the first worker's claimed row as `pending` until that worker
    commits, so its NOT EXISTS still passes and it claims the other row
    unlocked. Locking the joined `workspaces` row (`of=[ScenarioRun,
    Workspace]`) closes that: a second worker's SKIP LOCKED then skips every
    candidate belonging to that workspace, not just the one row a first worker
    already holds. Locking the workspace rather than the scenario is what
    makes this hold for two DIFFERENT scenarios of one workspace.

    That lock is held only for the claim — `run_once` commits immediately
    after marking the run running — so it is a sub-millisecond hold, not one
    that spans the run. Workspace rows are written only by SMTP-credential and
    API-key rotation, and plain SELECTs never block on FOR UPDATE, so mock
    serving is unaffected.
    """
    running = aliased(ScenarioRun)
    claimed = await db.execute(
        select(ScenarioRun)
        .join(Workspace, Workspace.id == ScenarioRun.workspace_id)
        .where(
            ScenarioRun.status == "pending",
            ~select(running.id)
            .where(running.status == "running", running.workspace_id == ScenarioRun.workspace_id)
            .exists(),
        )
        .order_by(ScenarioRun.created_at)
        .limit(1)
        .with_for_update(skip_locked=True, of=[ScenarioRun, Workspace])
    )
    return claimed.scalar_one_or_none()


async def mark_running(run: ScenarioRun, db: AsyncSession) -> None:
    run.status = "running"
    run.started_at = _now()
    await db.flush()


async def finish_run(run: ScenarioRun, status: str, error: str | None, db: AsyncSession) -> bool:
    """Move a run to a terminal status. Returns False if it was already there.

    A run that has been cancelled by a user, or timed out by the sweeper, must
    not be quietly overwritten by a worker that is still finishing it — a run
    reporting `passed` after someone cancelled it is the worst kind of bug to
    receive.
    """
    if run.status in TERMINAL_STATUSES:
        return False
    run.status = status
    run.error = error
    run.finished_at = _now()
    if run.started_at is not None:
        run.duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)
    await db.flush()
    return True


async def cancel_run(run: ScenarioRun, db: AsyncSession) -> bool:
    """Cancel an unfinished run. Returns False if it had already finished."""
    if run.status in TERMINAL_STATUSES:
        return False
    return await finish_run(run, "cancelled", None, db)


async def sweep_timed_out_runs(db: AsyncSession) -> int:
    """Time out runs that have been running past their scenario's ceiling.

    A worker that dies mid-run leaves its row `running` forever, and because
    runs of one workspace serialise, that would block the whole workspace
    permanently — not just the one scenario.
    The ceiling is measured from started_at, never created_at: time spent
    queued is not the customer's test being slow.
    """
    stale = await db.execute(
        select(ScenarioRun, Scenario.timeout_seconds)
        .join(Scenario, Scenario.id == ScenarioRun.scenario_id)
        .where(ScenarioRun.status == "running", ScenarioRun.started_at.isnot(None))
    )

    swept = 0
    now = _now()
    for run, ceiling in stale.all():
        if (now - run.started_at).total_seconds() > (ceiling or 120):
            await finish_run(run, "timeout", "Run exceeded its timeout", db)
            swept += 1
    return swept


async def record_step_result(
    run: ScenarioRun, index: int, step_type: str, result: dict, db: AsyncSession
) -> ScenarioStepResult:
    stored = ScenarioStepResult(
        run_id=run.id,
        step_index=index,
        step_type=step_type,
        status=result.get("status", "error"),
        started_at=result.get("started_at"),
        finished_at=result.get("finished_at"),
        request=result.get("request"),
        response=result.get("response"),
        matched_id=result.get("matched_id"),
        assertions=result.get("assertions") or [],
        captured=result.get("captured") or {},
        error=result.get("error"),
    )
    db.add(stored)
    await db.flush()
    return stored
