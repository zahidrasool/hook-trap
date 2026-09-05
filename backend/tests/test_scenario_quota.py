import pytest

from app.models.scenario import Scenario, ScenarioRun
from app.services.billing_service import PLANS
from app.services.usage_service import QUOTA_KINDS, get_usage


def test_every_plan_meters_scenario_runs():
    for name, plan in PLANS.items():
        assert "scenario_runs" in plan["quotas"], f"{name} has no scenario_runs quota"


def test_scenario_runs_is_an_enforceable_kind():
    """consume_quota looks the kind up in QUOTA_KINDS and in the plan."""
    assert "scenario_runs" in QUOTA_KINDS


def test_plan_tiers_increase():
    free = PLANS["free"]["quotas"]["scenario_runs"]
    pro = PLANS["pro"]["quotas"]["scenario_runs"]
    team = PLANS["team"]["quotas"]["scenario_runs"]
    assert free < pro < team


@pytest.mark.asyncio
async def test_usage_counts_runs_in_the_current_period(db_session, test_user, test_workspace):
    scenario = Scenario(
        workspace_id=test_workspace.id,
        short_id="qta0000001",
        name="Checkout",
        slug="checkout",
    )
    db_session.add(scenario)
    await db_session.flush()

    for _ in range(3):
        db_session.add(
            ScenarioRun(
                scenario_id=scenario.id,
                workspace_id=test_workspace.id,
                status="passed",
            )
        )
    await db_session.flush()

    usage = await get_usage(test_user, db_session)

    assert usage["quotas"]["scenario_runs"]["used"] == 3
    assert usage["quotas"]["scenario_runs"]["limit"] == PLANS["free"]["quotas"]["scenario_runs"]


@pytest.mark.asyncio
async def test_usage_reports_zero_runs_for_a_user_with_none(db_session, test_user, test_workspace):
    usage = await get_usage(test_user, db_session)

    assert usage["quotas"]["scenario_runs"]["used"] == 0
    assert usage["quotas"]["scenario_runs"]["exceeded"] is False
