import pytest


async def _make_scenario(client, auth_headers, workspace):
    created = await client.post(
        f"/api/v1/workspaces/{workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    return created.json()["short_id"]


@pytest.mark.asyncio
async def test_scenario_mock_serves_on_its_own_url(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json={"path": "/payments", "method": "GET", "response_body": '{"scope": "scenario"}'},
    )

    response = await client.get(f"/s/{scenario_short_id}/payments")

    assert response.status_code == 200
    assert response.json() == {"scope": "scenario"}


@pytest.mark.asyncio
async def test_scenario_falls_back_to_workspace_mocks(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json={"path": "/shared", "method": "GET", "response_body": '{"scope": "workspace"}'},
    )

    response = await client.get(f"/s/{scenario_short_id}/shared")

    assert response.status_code == 200
    assert response.json() == {"scope": "workspace"}


@pytest.mark.asyncio
async def test_scenario_mock_overrides_the_workspace_mock(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json={"path": "/payments", "method": "GET", "response_body": '{"scope": "workspace"}'},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json={"path": "/payments", "method": "GET", "response_body": '{"scope": "scenario"}'},
    )

    on_scenario = await client.get(f"/s/{scenario_short_id}/payments")
    on_workspace = await client.get(f"/m/{test_workspace.short_id}/payments")

    assert on_scenario.json() == {"scope": "scenario"}
    # The workspace URL is untouched. This is the isolation guarantee.
    assert on_workspace.json() == {"scope": "workspace"}


@pytest.mark.asyncio
async def test_scenario_mock_is_not_served_on_the_workspace_url(client, auth_headers, test_workspace):
    await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json={"path": "/scoped", "method": "GET", "response_body": '{"scope": "scenario"}'},
    )

    response = await client.get(f"/m/{test_workspace.short_id}/scoped")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_unknown_scenario_short_id_is_404(client):
    response = await client.get("/s/doesnotexist/anything")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_undefined_path_on_a_scenario_is_404(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)

    response = await client.get(f"/s/{scenario_short_id}/nothing-here")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_scenario_url_answers_cors_preflight(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)

    response = await client.request(
        "OPTIONS",
        f"/s/{scenario_short_id}/payments",
        headers={"Origin": "https://example.com", "Access-Control-Request-Method": "POST"},
    )

    assert response.status_code == 204
    assert response.headers["Access-Control-Allow-Origin"] == "*"


@pytest.mark.asyncio
async def test_private_workspace_requires_an_api_key_on_the_scenario_url(
    client, auth_headers, test_workspace, db_session
):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json={"path": "/payments", "method": "GET", "response_body": '{"ok": true}'},
    )

    test_workspace.is_public = False
    await db_session.commit()

    denied = await client.get(f"/s/{scenario_short_id}/payments")
    allowed = await client.get(
        f"/s/{scenario_short_id}/payments",
        headers={"X-API-Key": test_workspace.api_key},
    )

    assert denied.status_code == 401
    assert allowed.status_code == 200
