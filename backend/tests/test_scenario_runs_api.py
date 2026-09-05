import pytest


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
