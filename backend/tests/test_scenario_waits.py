import json
from datetime import datetime, timedelta, timezone

import pytest

from app.models.endpoint import Endpoint
from app.models.inbox_email import InboxEmail
from app.models.webhook import WebhookCapture
from app.services.scenario_waits import find_capture, find_email, poll_until


@pytest.mark.asyncio
async def test_poll_until_returns_the_first_match():
    calls = {"n": 0}

    async def fetch():
        calls["n"] += 1
        return "found" if calls["n"] >= 2 else None

    match, elapsed = await poll_until(fetch, timeout_seconds=5, poll_interval=0.01)

    assert match == "found"
    assert calls["n"] == 2
    assert elapsed >= 0


@pytest.mark.asyncio
async def test_poll_until_gives_up_at_the_deadline():
    async def fetch():
        return None

    match, elapsed = await poll_until(fetch, timeout_seconds=0.05, poll_interval=0.01)

    assert match is None
    assert elapsed >= 0.05


@pytest.mark.asyncio
async def test_poll_until_checks_once_even_with_a_zero_timeout():
    """A wait whose budget is already spent still gets one look."""
    calls = {"n": 0}

    async def fetch():
        calls["n"] += 1
        return "found"

    match, _ = await poll_until(fetch, timeout_seconds=0, poll_interval=0.01)

    assert match == "found"
    assert calls["n"] == 1


async def _endpoint(db, user):
    endpoint = Endpoint(user_id=user.id, short_id="wai0000001")
    db.add(endpoint)
    await db.flush()
    return endpoint


@pytest.mark.asyncio
async def test_find_capture_ignores_rows_from_before_the_step_started(db_session, test_user):
    """A webhook from an earlier run must not satisfy a later wait."""
    endpoint = await _endpoint(db_session, test_user)
    old = WebhookCapture(
        endpoint_id=endpoint.id, http_method="POST", headers={}, body='{"event":"x"}'
    )
    db_session.add(old)
    await db_session.flush()

    since = datetime.now(timezone.utc) + timedelta(seconds=1)
    assert await find_capture(endpoint.id, since, {}, db_session) is None


@pytest.mark.asyncio
async def test_find_capture_excludes_a_row_at_the_exact_boundary(db_session, test_user):
    """Strict `>`, not `>=`. A capture stamped exactly when the step began
    belongs to whatever happened before it, not to this wait."""
    endpoint = await _endpoint(db_session, test_user)
    stamp = datetime.now(timezone.utc)
    db_session.add(
        WebhookCapture(
            endpoint_id=endpoint.id,
            http_method="POST",
            headers={},
            body="{}",
            captured_at=stamp,
        )
    )
    await db_session.flush()

    assert await find_capture(endpoint.id, stamp, {}, db_session) is None


@pytest.mark.asyncio
async def test_find_capture_matches_a_dotted_body_path(db_session, test_user):
    endpoint = await _endpoint(db_session, test_user)
    since = datetime.now(timezone.utc) - timedelta(seconds=5)

    db_session.add(
        WebhookCapture(
            endpoint_id=endpoint.id,
            http_method="POST",
            headers={},
            body=json.dumps({"event": "payment.failed"}),
        )
    )
    wanted = WebhookCapture(
        endpoint_id=endpoint.id,
        http_method="POST",
        headers={},
        body=json.dumps({"event": "payment.completed"}),
    )
    db_session.add(wanted)
    await db_session.flush()

    found = await find_capture(
        endpoint.id, since, {"body.event": "payment.completed"}, db_session
    )

    assert found is not None
    assert found.id == wanted.id


@pytest.mark.asyncio
async def test_find_capture_with_no_match_spec_takes_the_first_arrival(db_session, test_user):
    endpoint = await _endpoint(db_session, test_user)
    since = datetime.now(timezone.utc) - timedelta(seconds=5)
    first = WebhookCapture(endpoint_id=endpoint.id, http_method="POST", headers={}, body="{}")
    db_session.add(first)
    await db_session.flush()

    found = await find_capture(endpoint.id, since, {}, db_session)

    assert found is not None
    assert found.id == first.id


@pytest.mark.asyncio
async def test_find_capture_tolerates_a_non_json_body(db_session, test_user):
    """A capture whose body is not JSON must not break matching for others."""
    endpoint = await _endpoint(db_session, test_user)
    since = datetime.now(timezone.utc) - timedelta(seconds=5)
    db_session.add(
        WebhookCapture(endpoint_id=endpoint.id, http_method="POST", headers={}, body="not json")
    )
    await db_session.flush()

    assert await find_capture(endpoint.id, since, {"body.event": "x"}, db_session) is None


@pytest.mark.asyncio
async def test_find_email_matches_a_recipient(db_session, test_workspace):
    since = datetime.now(timezone.utc) - timedelta(seconds=5)
    db_session.add(
        InboxEmail(
            workspace_id=test_workspace.id,
            from_address="noreply@shop.test",
            to_addresses=["someone.else@example.com"],
            subject="Other",
        )
    )
    wanted = InboxEmail(
        workspace_id=test_workspace.id,
        from_address="noreply@shop.test",
        to_addresses=["buyer@example.com"],
        subject="Payment confirmed",
    )
    db_session.add(wanted)
    await db_session.flush()

    found = await find_email(test_workspace.id, since, "buyer@example.com", db_session)

    assert found is not None
    assert found.id == wanted.id


@pytest.mark.asyncio
async def test_find_email_ignores_rows_from_before_the_step_started(db_session, test_workspace):
    db_session.add(
        InboxEmail(
            workspace_id=test_workspace.id,
            from_address="a@b.test",
            to_addresses=["buyer@example.com"],
            subject="Old",
        )
    )
    await db_session.flush()

    since = datetime.now(timezone.utc) + timedelta(seconds=1)
    assert await find_email(test_workspace.id, since, "buyer@example.com", db_session) is None


@pytest.mark.asyncio
async def test_find_email_excludes_a_row_at_the_exact_boundary(db_session, test_workspace):
    """Strict `>`, not `>=`. An email stamped exactly when the step began
    belongs to whatever happened before it, not to this wait."""
    stamp = datetime.now(timezone.utc)
    db_session.add(
        InboxEmail(
            workspace_id=test_workspace.id,
            from_address="a@b.test",
            to_addresses=["buyer@example.com"],
            subject="Boundary",
            received_at=stamp,
        )
    )
    await db_session.flush()

    assert await find_email(test_workspace.id, stamp, "buyer@example.com", db_session) is None
