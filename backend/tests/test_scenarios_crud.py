import pytest


@pytest.mark.asyncio
async def test_create_scenario(client, auth_headers, test_workspace):
    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Successful Checkout", "description": "happy path"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Successful Checkout"
    assert data["slug"] == "successful-checkout"
    assert data["steps"] == []
    assert data["is_active"] is True
    assert data["scenario_url"].endswith(f"/s/{data['short_id']}")
    assert "/h/" in data["capture_url"]


@pytest.mark.asyncio
async def test_list_scenarios(client, auth_headers, test_workspace):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "One"},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Two"},
    )

    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert {s["slug"] for s in data["scenarios"]} == {"one", "two"}


@pytest.mark.asyncio
async def test_get_scenario_by_slug(client, auth_headers, test_workspace):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Checkout"


@pytest.mark.asyncio
async def test_update_scenario_steps(client, auth_headers, test_workspace):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    steps = [{"type": "delay", "seconds": 2}]
    response = await client.patch(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
        json={"steps": steps, "timeout_seconds": 60},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["steps"] == steps
    assert data["timeout_seconds"] == 60


@pytest.mark.asyncio
async def test_renaming_reassigns_the_slug_but_keeps_the_short_id(client, auth_headers, test_workspace):
    created = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    short_id = created.json()["short_id"]

    response = await client.patch(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
        json={"name": "Refund Flow"},
    )

    data = response.json()
    assert data["slug"] == "refund-flow"
    assert data["short_id"] == short_id


@pytest.mark.asyncio
async def test_delete_scenario(client, auth_headers, test_workspace):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    response = await client.delete(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
    )
    assert response.status_code == 204

    follow_up = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
    )
    assert follow_up.status_code == 404


@pytest.mark.asyncio
async def test_scenario_routes_require_authentication(client, test_workspace):
    response = await client.get(f"/api/v1/workspaces/{test_workspace.short_id}/scenarios")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unknown_scenario_is_404(client, auth_headers, test_workspace):
    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/nope", headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_non_member_cannot_list_scenarios(client, other_auth_headers, test_workspace):
    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios", headers=other_auth_headers
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_non_member_cannot_create_scenario(client, other_auth_headers, test_workspace):
    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=other_auth_headers,
        json={"name": "Intruder"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_viewer_can_list_but_not_mutate(
    client, db_session, other_user, other_auth_headers, test_workspace, auth_headers
):
    from app.models.workspace import WorkspaceMember

    db_session.add(
        WorkspaceMember(workspace_id=test_workspace.id, user_id=other_user.id, role="viewer")
    )
    await db_session.commit()

    list_response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios", headers=other_auth_headers
    )
    assert list_response.status_code == 200

    create_response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=other_auth_headers,
        json={"name": "Viewer Attempt"},
    )
    assert create_response.status_code == 403

    # A scenario needs to exist for patch/delete to have something to refuse.
    # test_workspace's owner is test_user, so auth_headers (test_user's token)
    # can create it.
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    patch_response = await client.patch(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=other_auth_headers,
        json={"name": "Renamed"},
    )
    assert patch_response.status_code == 403

    delete_response = await client.delete(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=other_auth_headers,
    )
    assert delete_response.status_code == 403


@pytest.mark.asyncio
async def test_scenario_unreachable_through_a_different_workspace(
    client, db_session, other_user, other_auth_headers, test_workspace, auth_headers
):
    from app.services.workspace_service import create_workspace

    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    other_workspace = await create_workspace("Other Workspace", None, other_user, db_session)
    await db_session.commit()

    response = await client.get(
        f"/api/v1/workspaces/{other_workspace.short_id}/scenarios/checkout",
        headers=other_auth_headers,
    )
    assert response.status_code == 404
