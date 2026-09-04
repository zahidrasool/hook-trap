import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.mock_endpoint import MockEndpoint
from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult


async def _make_scenario(db, workspace, *, slug="checkout", short_id="scn0000001"):
    scenario = Scenario(
        workspace_id=workspace.id,
        short_id=short_id,
        name="Checkout",
        slug=slug,
        steps=[{"type": "delay", "seconds": 1}],
        variables={"baseUrl": "https://example.com"},
    )
    db.add(scenario)
    await db.flush()
    return scenario


@pytest.mark.asyncio
async def test_scenario_persists_steps_as_json(db_session, test_workspace):
    scenario = await _make_scenario(db_session, test_workspace)
    await db_session.refresh(scenario)

    assert scenario.steps == [{"type": "delay", "seconds": 1}]
    assert scenario.variables == {"baseUrl": "https://example.com"}
    assert scenario.timeout_seconds == 120
    assert scenario.is_active is True


@pytest.mark.asyncio
async def test_slug_is_unique_per_workspace(db_session, test_workspace):
    await _make_scenario(db_session, test_workspace, slug="dup", short_id="scn0000002")

    # _make_scenario flushes internally, so the violation surfaces from the
    # second call itself rather than from a later flush.
    with pytest.raises(IntegrityError):
        await _make_scenario(db_session, test_workspace, slug="dup", short_id="scn0000003")
    await db_session.rollback()


@pytest.mark.asyncio
async def test_two_workspace_mocks_cannot_share_path_and_method(db_session, test_workspace):
    for _ in range(2):
        db_session.add(
            MockEndpoint(workspace_id=test_workspace.id, path="/users", method="GET")
        )

    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_a_scenario_mock_may_shadow_a_workspace_mock(db_session, test_workspace):
    """The whole point of scenario scoping: same path, different owner."""
    scenario = await _make_scenario(db_session, test_workspace, short_id="scn0000004")

    db_session.add(MockEndpoint(workspace_id=test_workspace.id, path="/users", method="GET"))
    db_session.add(
        MockEndpoint(
            workspace_id=test_workspace.id,
            scenario_id=scenario.id,
            path="/users",
            method="GET",
        )
    )
    await db_session.flush()

    mocks = (await db_session.execute(select(MockEndpoint))).scalars().all()
    assert len(mocks) == 2


@pytest.mark.asyncio
async def test_two_mocks_in_one_scenario_cannot_share_path_and_method(db_session, test_workspace):
    scenario = await _make_scenario(db_session, test_workspace, short_id="scn0000005")

    for _ in range(2):
        db_session.add(
            MockEndpoint(
                workspace_id=test_workspace.id,
                scenario_id=scenario.id,
                path="/users",
                method="GET",
            )
        )

    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_deleting_a_run_deletes_its_step_results(db_session, test_workspace):
    scenario = await _make_scenario(db_session, test_workspace, short_id="scn0000006")
    run = ScenarioRun(
        scenario_id=scenario.id, workspace_id=test_workspace.id, status="pending"
    )
    db_session.add(run)
    await db_session.flush()

    db_session.add(
        ScenarioStepResult(
            run_id=run.id, step_index=0, step_type="delay", status="passed"
        )
    )
    await db_session.flush()

    await db_session.delete(run)
    await db_session.flush()

    remaining = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    assert remaining == []
