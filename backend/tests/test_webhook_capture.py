import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_capture_webhook_json(client: AsyncClient, auth_headers: dict):
    # Create endpoint first
    ep_response = await client.post(
        "/api/v1/endpoints",
        json={"name": "Test Webhook"},
        headers=auth_headers,
    )
    assert ep_response.status_code == 201
    short_id = ep_response.json()["short_id"]

    # Send webhook
    response = await client.post(
        f"/h/{short_id}",
        json={"event": "test", "data": {"key": "value"}},
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "captured"


@pytest.mark.asyncio
async def test_capture_webhook_not_found(client: AsyncClient):
    response = await client.post("/h/nonexistent")
    assert response.status_code == 404
