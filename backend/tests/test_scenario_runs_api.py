import uuid

import pytest
from sqlalchemy import select

from app.models.scenario import Scenario
from app.services.scenario_run_service import create_run, record_step_result


async def _scenario(client, auth_headers, workspace, steps=None):
    created = await client.post(
        f"/api/v1/workspaces/{workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    if steps is not None:
        await client.patch(
            f"/api/v1/workspaces/{workspace.short_id}/scenarios/checkout",
            headers=auth_headers,
            json={"steps": steps},
        )
    return created.json()


@pytest.mark.asyncio
async def test_triggering_a_run_returns_202(client, auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={"variables": {"baseUrl": "https://x"}},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "pending"
    assert body["run_id"]


@pytest.mark.asyncio
async def test_fetching_a_run_returns_it_with_step_results(client, auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]

    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}", headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == run_id
    assert body["status"] == "pending"
    assert body["step_results"] == []


@pytest.mark.asyncio
async def test_cancelling_a_pending_run(client, auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}/cancel", headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancelling_a_finished_run_is_409(client, auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}/cancel", headers=auth_headers
    )

    again = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}/cancel", headers=auth_headers
    )

    assert again.status_code == 409


@pytest.mark.asyncio
async def test_running_a_scenario_requires_editor(client, auth_headers, other_auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=other_auth_headers,
        json={},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_a_genuine_viewer_cannot_trigger_a_run(
    client, db_session, other_user, other_auth_headers, test_workspace, auth_headers
):
    from app.models.workspace import WorkspaceMember

    db_session.add(
        WorkspaceMember(workspace_id=test_workspace.id, user_id=other_user.id, role="viewer")
    )
    await db_session.commit()

    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=other_auth_headers,
        json={},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_a_genuine_viewer_cannot_cancel_a_run(
    client, db_session, other_user, other_auth_headers, test_workspace, auth_headers
):
    from app.models.workspace import WorkspaceMember

    db_session.add(
        WorkspaceMember(workspace_id=test_workspace.id, user_id=other_user.id, role="viewer")
    )
    await db_session.commit()

    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}/cancel",
        headers=other_auth_headers,
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_a_genuine_viewer_can_fetch_a_run(
    client, db_session, other_user, other_auth_headers, test_workspace, auth_headers
):
    from app.models.workspace import WorkspaceMember

    db_session.add(
        WorkspaceMember(workspace_id=test_workspace.id, user_id=other_user.id, role="viewer")
    )
    await db_session.commit()

    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]

    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}",
        headers=other_auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["id"] == run_id


@pytest.mark.asyncio
async def test_triggering_a_run_with_no_body_defaults_to_empty_variables(
    client, auth_headers, test_workspace
):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
    )

    assert response.status_code == 202
    run_id = response.json()["run_id"]

    fetched = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}", headers=auth_headers
    )
    assert fetched.json()["variables"] == {}


@pytest.mark.asyncio
async def test_a_run_is_not_reachable_through_another_workspace(
    client, auth_headers, other_auth_headers, other_user, test_workspace, db_session
):
    from app.services.workspace_service import create_workspace

    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]

    other_ws = await create_workspace("Other", None, other_user, db_session)
    await db_session.commit()

    response = await client.get(
        f"/api/v1/workspaces/{other_ws.short_id}/runs/{run_id}", headers=other_auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_an_unknown_run_is_404(client, auth_headers, test_workspace):
    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/"
        "00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_fetched_step_results_expose_matched_id(
    client, auth_headers, test_workspace, db_session
):
    """`matched_id` records which capture or email satisfied a wait step. The
    run report is useless for identifying *which* webhook satisfied the wait
    unless this is surfaced through the API."""
    await _scenario(
        client, auth_headers, test_workspace, [{"type": "wait_for_webhook", "timeout_seconds": 1}]
    )
    scenario = (
        await db_session.execute(
            select(Scenario).where(Scenario.workspace_id == test_workspace.id)
        )
    ).scalars().one()

    run = await create_run(scenario, {}, "manual", db_session)
    matched_id = uuid.uuid4()
    await record_step_result(
        run,
        0,
        "wait_for_webhook",
        {"status": "passed", "matched_id": matched_id},
        db_session,
    )
    await db_session.commit()

    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run.id}", headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["step_results"][0]["matched_id"] == str(matched_id)


# --- run history ------------------------------------------------------------


@pytest.mark.asyncio
async def test_listing_runs_returns_them_newest_first(client, auth_headers, test_workspace):
    """A history list is only useful if the run you just triggered is at the top."""
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    url = f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout"

    first = (await client.post(f"{url}/run", headers=auth_headers, json={})).json()["run_id"]
    second = (await client.post(f"{url}/run", headers=auth_headers, json={})).json()["run_id"]

    response = await client.get(f"{url}/runs", headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert [r["id"] for r in body["runs"]] == [second, first]


@pytest.mark.asyncio
async def test_run_list_omits_step_results_but_reports_how_many(
    client, auth_headers, test_workspace, db_session
):
    """The list must stay light. Fifty runs carrying every request and response
    body would make the history page the heaviest in the product, and none of
    it is shown until a run is opened."""
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    url = f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout"
    run_id = (await client.post(f"{url}/run", headers=auth_headers, json={})).json()["run_id"]

    result = await db_session.execute(select(Scenario).where(Scenario.slug == "checkout"))
    scenario = result.scalar_one()
    run = await create_run(scenario, {}, "manual", db_session)
    for index in range(3):
        await record_step_result(run, index, "delay", {"status": "passed"}, db_session)
    await db_session.commit()

    body = (await client.get(f"{url}/runs", headers=auth_headers)).json()

    listed = {r["id"]: r for r in body["runs"]}
    assert "step_results" not in listed[run_id]
    assert listed[str(run.id)]["step_count"] == 3
    assert listed[run_id]["step_count"] == 0


@pytest.mark.asyncio
async def test_run_list_paginates(client, auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    url = f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout"
    for _ in range(3):
        await client.post(f"{url}/run", headers=auth_headers, json={})

    page = (await client.get(f"{url}/runs?limit=2&offset=0", headers=auth_headers)).json()
    rest = (await client.get(f"{url}/runs?limit=2&offset=2", headers=auth_headers)).json()

    assert page["total"] == 3 and rest["total"] == 3
    assert len(page["runs"]) == 2
    assert len(rest["runs"]) == 1
    assert {r["id"] for r in page["runs"]}.isdisjoint({r["id"] for r in rest["runs"]})


@pytest.mark.asyncio
async def test_runs_of_another_workspace_are_not_listed(
    client, auth_headers, other_auth_headers, test_workspace
):
    """Reading history is a viewer action, but only for members of that workspace."""
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    url = f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/runs"

    response = await client.get(url, headers=other_auth_headers)

    assert response.status_code in (403, 404)
