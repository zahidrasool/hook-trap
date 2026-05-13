import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_magic_link_request(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/magic-link",
        json={"email": "newuser@example.com"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "link_sent"
    assert data["email"] == "newuser@example.com"


@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401
