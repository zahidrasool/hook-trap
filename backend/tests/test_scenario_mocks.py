import pytest


@pytest.fixture
def make_mock():
    def _payload(path="/users", method="GET", body='{"scope": "workspace"}'):
        return {"path": path, "method": method, "response_body": body}

    return _payload


@pytest.mark.asyncio
async def test_create_a_scenario_scoped_mock(client, auth_headers, test_workspace, make_mock):
    created = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    scenario_short_id = created.json()["short_id"]

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(body='{"scope": "scenario"}'),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["scenario_id"] is not None
    assert f"/s/{scenario_short_id}/users" in data["mock_url"]


@pytest.mark.asyncio
async def test_scenario_mock_may_shadow_a_workspace_mock(client, auth_headers, test_workspace, make_mock):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json=make_mock(),
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(body='{"scope": "scenario"}'),
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_scenario_mocks_stay_out_of_the_workspace_list(client, auth_headers, test_workspace, make_mock):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json=make_mock(path="/shared"),
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(path="/scoped"),
    )

    workspace_list = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks", headers=auth_headers
    )
    scenario_list = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
    )

    assert [m["path"] for m in workspace_list.json()["data"]] == ["/shared"]
    assert [m["path"] for m in scenario_list.json()["data"]] == ["/scoped"]


@pytest.mark.asyncio
async def test_duplicate_path_within_one_scenario_is_409(client, auth_headers, test_workspace, make_mock):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(),
    )

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(),
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_deleting_a_scenario_deletes_its_mocks(client, auth_headers, test_workspace, make_mock):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json=make_mock(path="/shared"),
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(path="/scoped"),
    )

    await client.delete(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
    )

    workspace_list = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks", headers=auth_headers
    )
    assert [m["path"] for m in workspace_list.json()["data"]] == ["/shared"]


@pytest.mark.asyncio
async def test_workspace_mock_count_excludes_scenario_mocks(client, auth_headers, test_workspace, make_mock):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json=make_mock(path="/one"),
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json=make_mock(path="/two"),
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(path="/scoped"),
    )

    workspace_response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}", headers=auth_headers
    )
    mocks_response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks", headers=auth_headers
    )

    assert workspace_response.json()["mock_count"] == mocks_response.json()["total"]
    assert workspace_response.json()["mock_count"] == 2
    assert mocks_response.json()["total"] == 2
