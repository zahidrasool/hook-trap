import pytest
from sqlalchemy import select

from app.models.endpoint import Endpoint
from app.services.scenario_service import (
    create_scenario,
    get_capture_endpoint,
    get_scenario_by_short_id,
    get_scenario_by_slug,
    slugify,
)


def test_slugify_lowercases_and_hyphenates():
    assert slugify("Successful Checkout") == "successful-checkout"
    assert slugify("Payment  //  Retry!") == "payment-retry"
    assert slugify("---Edge---") == "edge"


def test_slugify_falls_back_when_nothing_survives():
    assert slugify("!!!") == "scenario"


@pytest.mark.asyncio
async def test_create_scenario_allocates_identity(db_session, test_workspace, test_user):
    scenario = await create_scenario(
        test_workspace, "Successful Checkout", "happy path", test_user, db_session
    )

    assert scenario.slug == "successful-checkout"
    assert len(scenario.short_id) == 10
    assert scenario.workspace_id == test_workspace.id
    assert scenario.created_by == test_user.id
    assert scenario.steps == []
    assert scenario.variables == {}


@pytest.mark.asyncio
async def test_duplicate_names_get_distinct_slugs(db_session, test_workspace, test_user):
    first = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)
    second = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)
    third = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)

    assert [first.slug, second.slug, third.slug] == ["checkout", "checkout-2", "checkout-3"]


@pytest.mark.asyncio
async def test_create_scenario_allocates_a_capture_endpoint(db_session, test_workspace, test_user):
    scenario = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)

    endpoint = await get_capture_endpoint(scenario.id, db_session)
    assert endpoint is not None
    assert endpoint.scenario_id == scenario.id
    assert endpoint.user_id == test_user.id
    assert len(endpoint.short_id) == 10


@pytest.mark.asyncio
async def test_lookup_by_slug_and_short_id(db_session, test_workspace, test_user):
    scenario = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)

    by_slug = await get_scenario_by_slug(test_workspace.id, "checkout", db_session)
    by_short_id = await get_scenario_by_short_id(scenario.short_id, db_session)

    assert by_slug.id == scenario.id
    assert by_short_id.id == scenario.id
    assert await get_scenario_by_slug(test_workspace.id, "nope", db_session) is None
    assert await get_scenario_by_short_id("nope", db_session) is None


@pytest.mark.asyncio
async def test_deleting_a_scenario_removes_its_capture_endpoint(db_session, test_workspace, test_user):
    scenario = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)

    await db_session.delete(scenario)
    await db_session.flush()

    endpoints = (await db_session.execute(select(Endpoint))).scalars().all()
    assert endpoints == []


@pytest.mark.asyncio
async def test_long_scenario_name_does_not_overflow_endpoint_name(db_session, test_workspace, test_user):
    # Endpoint.name is VARCHAR(200); derived names must not overflow
    long_name = "A" * 200  # Maximum length for Scenario.name column
    scenario = await create_scenario(test_workspace, long_name, None, test_user, db_session)

    endpoint = await get_capture_endpoint(scenario.id, db_session)
    assert endpoint is not None
    assert len(endpoint.name) <= 200
