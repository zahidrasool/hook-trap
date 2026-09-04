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
