import pytest


@pytest.mark.asyncio
async def test_unknown_workspace_short_id_is_404(client):
    response = await client.get("/m/doesnotexist/anything")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_mock_url_answers_cors_preflight(client, test_workspace):
    response = await client.request(
        "OPTIONS",
        f"/m/{test_workspace.short_id}/payments",
        headers={"Origin": "https://example.com", "Access-Control-Request-Method": "POST"},
    )

    assert response.status_code == 204
    assert response.headers["Access-Control-Allow-Origin"] == "*"


@pytest.mark.asyncio
async def test_workspace_mock_serves_on_the_workspace_url(client, auth_headers, test_workspace):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json={"path": "/payments", "method": "GET", "response_body": '{"scope": "workspace"}'},
    )

    response = await client.get(f"/m/{test_workspace.short_id}/payments")

    assert response.status_code == 200
    assert response.json() == {"scope": "workspace"}
