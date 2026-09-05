from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult
from app.services.scenario_run_service import (
    cancel_run,
    claim_next_run,
    create_run,
    finish_run,
    mark_running,
    record_step_result,
    sweep_timed_out_runs,
)


async def _scenario(db, workspace, *, slug, short_id, timeout_seconds=120):
    scenario = Scenario(
        workspace_id=workspace.id,
        short_id=short_id,
        name=slug.title(),
        slug=slug,
        steps=[{"type": "delay", "seconds": 0}],
        timeout_seconds=timeout_seconds,
    )
    db.add(scenario)
    await db.flush()
    return scenario


@pytest.mark.asyncio
async def test_create_run_starts_pending(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000001")

    run = await create_run(scenario, {"baseUrl": "https://x"}, "manual", db_session)

    assert run.status == "pending"
    assert run.trigger == "manual"
    assert run.variables == {"baseUrl": "https://x"}
    assert run.workspace_id == test_workspace.id
    assert run.started_at is None


@pytest.mark.asyncio
async def test_claim_returns_the_oldest_pending_run(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000002")
    first = await create_run(scenario, {}, "manual", db_session)
    await create_run(scenario, {}, "manual", db_session)

    claimed = await claim_next_run(db_session)

    assert claimed is not None
    assert claimed.id == first.id


@pytest.mark.asyncio
async def test_claim_returns_none_when_nothing_is_pending(db_session):
    assert await claim_next_run(db_session) is None


@pytest.mark.asyncio
async def test_runs_of_one_scenario_serialise(db_session, test_workspace):
    """Steps in a run are interdependent and runs share the scenario's
    namespace, so a second run must wait for the first to finish."""
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000003")
    first = await create_run(scenario, {}, "manual", db_session)
    await create_run(scenario, {}, "manual", db_session)

    claimed = await claim_next_run(db_session)
    await mark_running(claimed, db_session)

    assert await claim_next_run(db_session) is None

    await finish_run(first, "passed", None, db_session)
    assert await claim_next_run(db_session) is not None


@pytest.mark.asyncio
async def test_different_scenarios_run_in_parallel(db_session, test_workspace):
    """The parallelism that matters — a CI job running many scenarios."""
    one = await _scenario(db_session, test_workspace, slug="a", short_id="run0000004")
    two = await _scenario(db_session, test_workspace, slug="b", short_id="run0000005")
    await create_run(one, {}, "manual", db_session)
    await create_run(two, {}, "manual", db_session)

    first = await claim_next_run(db_session)
    await mark_running(first, db_session)
    second = await claim_next_run(db_session)

    assert second is not None
    assert second.scenario_id != first.scenario_id


@pytest.mark.asyncio
async def test_mark_running_stamps_started_at(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000006")
    run = await create_run(scenario, {}, "manual", db_session)

    await mark_running(run, db_session)

    assert run.status == "running"
    assert run.started_at is not None


@pytest.mark.asyncio
async def test_finish_run_records_duration(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000007")
    run = await create_run(scenario, {}, "manual", db_session)
    await mark_running(run, db_session)

    await finish_run(run, "failed", None, db_session)

    assert run.status == "failed"
    assert run.finished_at is not None
    assert run.duration_ms is not None and run.duration_ms >= 0


@pytest.mark.asyncio
async def test_cancel_only_applies_to_unfinished_runs(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000008")
    pending = await create_run(scenario, {}, "manual", db_session)

    assert await cancel_run(pending, db_session) is True
    assert pending.status == "cancelled"

    # Cancelling again is a no-op, not an error.
    assert await cancel_run(pending, db_session) is False


@pytest.mark.asyncio
async def test_sweep_times_out_runs_past_their_ceiling(db_session, test_workspace):
    """A crashed worker must not block a scenario forever."""
    scenario = await _scenario(
        db_session, test_workspace, slug="a", short_id="run0000009", timeout_seconds=1
    )
    run = await create_run(scenario, {}, "manual", db_session)
    await mark_running(run, db_session)
    run.started_at = datetime.now(timezone.utc) - timedelta(seconds=30)
    await db_session.flush()

    swept = await sweep_timed_out_runs(db_session)

    assert swept == 1
    await db_session.refresh(run)
    assert run.status == "timeout"


@pytest.mark.asyncio
async def test_sweep_leaves_runs_inside_their_ceiling_alone(db_session, test_workspace):
    scenario = await _scenario(
        db_session, test_workspace, slug="a", short_id="run0000010", timeout_seconds=600
    )
    run = await create_run(scenario, {}, "manual", db_session)
    await mark_running(run, db_session)

    assert await sweep_timed_out_runs(db_session) == 0
    assert run.status == "running"


@pytest.mark.asyncio
async def test_the_timeout_clock_starts_at_started_at_not_creation(db_session, test_workspace):
    """A queue backlog must not read as a test failure."""
    scenario = await _scenario(
        db_session, test_workspace, slug="a", short_id="run0000011", timeout_seconds=60
    )
    run = await create_run(scenario, {}, "manual", db_session)
    run.created_at = datetime.now(timezone.utc) - timedelta(hours=2)
    await db_session.flush()
    await mark_running(run, db_session)

    assert await sweep_timed_out_runs(db_session) == 0


@pytest.mark.asyncio
async def test_record_step_result_stores_the_payloads(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000012")
    run = await create_run(scenario, {}, "manual", db_session)

    await record_step_result(
        run,
        0,
        "http_request",
        {
            "status": "passed",
            "request": {"method": "POST", "url": "https://x"},
            "response": {"status_code": 200},
            "assertions": [{"assertion": "status == 200", "passed": True}],
            "captured": {"id": "p_1"},
        },
        db_session,
    )

    stored = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    assert len(stored) == 1
    assert stored[0].step_index == 0
    assert stored[0].request["method"] == "POST"
    assert stored[0].captured == {"id": "p_1"}
