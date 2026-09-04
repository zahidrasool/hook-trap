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


async def _create_scenario_and_capture(client, headers, workspace_short_id, name="Checkout"):
    """Create a scenario, post one webhook to its capture endpoint, return
    (capture_short_id, capture_id) as read back by `headers`' owner."""
    created = await client.post(
        f"/api/v1/workspaces/{workspace_short_id}/scenarios",
        headers=headers,
        json={"name": name},
    )
    assert created.status_code == 201
    capture_url = created.json()["capture_url"]
    endpoint_short_id = capture_url.rsplit("/h/", 1)[1]

    webhook_response = await client.post(
        f"/h/{endpoint_short_id}",
        json={"event": "test"},
        headers={"content-type": "application/json"},
    )
    assert webhook_response.status_code == 200

    listed = await client.get("/api/v1/captures", headers=headers)
    assert listed.status_code == 200
    matches = [c for c in listed.json()["data"] if c["path"] == f"/h/{endpoint_short_id}"]
    assert len(matches) == 1
    return endpoint_short_id, matches[0]["id"]


@pytest.mark.asyncio
async def test_workspace_member_who_did_not_create_the_scenario_can_read_its_captures(
    client, db_session, test_user, auth_headers, other_user, other_auth_headers, test_workspace
):
    from app.models.workspace import WorkspaceMember

    db_session.add(
        WorkspaceMember(workspace_id=test_workspace.id, user_id=other_user.id, role="viewer")
    )
    await db_session.commit()

    _, capture_id = await _create_scenario_and_capture(client, auth_headers, test_workspace.short_id)

    # Non-creator workspace member can list it...
    listed = await client.get("/api/v1/captures", headers=other_auth_headers)
    assert listed.status_code == 200
    assert any(c["id"] == capture_id for c in listed.json()["data"])

    # ...and read it directly.
    detail = await client.get(f"/api/v1/captures/{capture_id}", headers=other_auth_headers)
    assert detail.status_code == 200


@pytest.mark.asyncio
async def test_non_workspace_member_cannot_read_scenario_captures(
    client, db_session, auth_headers, other_auth_headers, test_workspace
):
    _, capture_id = await _create_scenario_and_capture(client, auth_headers, test_workspace.short_id)

    listed = await client.get("/api/v1/captures", headers=other_auth_headers)
    assert listed.status_code == 200
    assert all(c["id"] != capture_id for c in listed.json()["data"])

    detail = await client.get(f"/api/v1/captures/{capture_id}", headers=other_auth_headers)
    assert detail.status_code == 404

    deleted = await client.delete(f"/api/v1/captures/{capture_id}", headers=other_auth_headers)
    assert deleted.status_code == 404


@pytest.mark.asyncio
async def test_personal_endpoint_captures_remain_creator_only(
    client, db_session, test_user, auth_headers, other_user, other_auth_headers, test_workspace
):
    # Even a fellow workspace member of test_user must not read captures from
    # a personal (non-scenario) endpoint test_user created -- only the
    # scenario-owned capture-sharing rule changed, not this one.
    from app.models.workspace import WorkspaceMember

    db_session.add(
        WorkspaceMember(workspace_id=test_workspace.id, user_id=other_user.id, role="viewer")
    )
    await db_session.commit()

    ep_response = await client.post(
        "/api/v1/endpoints", json={"name": "Personal"}, headers=auth_headers
    )
    assert ep_response.status_code == 201
    short_id = ep_response.json()["short_id"]

    await client.post(
        f"/h/{short_id}",
        json={"event": "test"},
        headers={"content-type": "application/json"},
    )

    listed_owner = await client.get("/api/v1/captures", headers=auth_headers)
    matches = [c for c in listed_owner.json()["data"] if c["path"] == f"/h/{short_id}"]
    assert len(matches) == 1
    capture_id = matches[0]["id"]

    detail = await client.get(f"/api/v1/captures/{capture_id}", headers=other_auth_headers)
    assert detail.status_code == 404

    listed_other = await client.get("/api/v1/captures", headers=other_auth_headers)
    assert all(c["id"] != capture_id for c in listed_other.json()["data"])
