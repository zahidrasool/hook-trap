import socket

import pytest

from app.models.endpoint import Endpoint
from app.models.session import ReplaySession
from app.models.webhook import WebhookCapture
from app.services.replay_service import replay_capture


@pytest.mark.asyncio
async def test_replaying_to_a_private_address_is_recorded_as_an_error(
    db_session, test_user, monkeypatch
):
    """The SSRF hole this closes: replay used to send anywhere the user named."""

    def _getaddrinfo(host, port, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", port or 0))]

    monkeypatch.setattr(socket, "getaddrinfo", _getaddrinfo)

    endpoint = Endpoint(user_id=test_user.id, short_id="rep0000001")
    db_session.add(endpoint)
    await db_session.flush()

    capture = WebhookCapture(
        endpoint_id=endpoint.id, http_method="POST", headers={}, body='{"a":1}'
    )
    db_session.add(capture)
    await db_session.flush()

    session = ReplaySession(user_id=test_user.id, endpoint_id=endpoint.id, name="t")
    db_session.add(session)
    await db_session.flush()

    result = await replay_capture(
        capture, "http://169.254.169.254/latest/", None, session.id, db_session
    )

    assert result.response_status is None
    assert "not a public address" in (result.error_message or "")
