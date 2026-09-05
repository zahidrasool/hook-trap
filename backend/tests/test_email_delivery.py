"""Deliverability contracts for outbound transactional mail.

These are not tests of "does mail arrive" — that depends on receivers we do not
control. They pin the three things we *can* control, each of which was a real
defect that put the sign-in email in the junk folder:

  - both MIME parts are always built (HTML-only is a scored spam heuristic)
  - the plain part carries the sign-in link, so a text-only client can sign in
  - the link stays on the brand host, so the visible brand and the link target
    agree

The transport functions are exercised directly rather than through the API,
because conftest's autouse fixture stubs `_send` out for every other test.
"""

import pytest

from app.config import get_settings
from app.services import email_service


class _FakeSes:
    """Captures the SES call instead of making it."""

    def __init__(self):
        self.kwargs = None

    def send_email(self, **kwargs):
        self.kwargs = kwargs
        return {"MessageId": "test-message-id"}


@pytest.fixture
def fake_ses(monkeypatch):
    client = _FakeSes()
    monkeypatch.setattr("boto3.client", lambda *a, **kw: client)
    return client


def test_ses_sends_both_mime_parts(fake_ses):
    """HTML-only mail scores as spam. Both parts, every time."""
    email_service._send_via_ses(
        "info@mocklane.com", "someone@example.com", "Subject", "<p>rich</p>", "plain"
    )

    body = fake_ses.kwargs["Message"]["Body"]
    assert set(body) == {"Html", "Text"}, (
        "SES emits a text/html singlepart when Body has no Text key, which is "
        "exactly the MIME_HTML_ONLY shape spam filters score against"
    )
    assert body["Html"]["Data"] == "<p>rich</p>"
    assert body["Text"]["Data"] == "plain"
    assert body["Text"]["Charset"] == "UTF-8"


def test_ses_message_id_is_returned(fake_ses):
    """The caller logs this; losing it would make sends unauditable."""
    assert (
        email_service._send_via_ses(
            "info@mocklane.com", "to@example.com", "S", "<p>h</p>", "t"
        )
        == "test-message-id"
    )


@pytest.mark.asyncio
async def test_magic_link_email_carries_both_parts_and_the_link(monkeypatch):
    captured = {}

    async def _capture(to, subject, html, text, *, required):
        captured.update(to=to, subject=subject, html=html, text=text, required=required)
        return True

    monkeypatch.setattr(email_service, "_send", _capture)
    await email_service.send_magic_link_email("someone@example.com", "TOKEN123")

    assert captured["required"] is True
    # A recipient reading the plain part must be able to sign in from it alone.
    assert "TOKEN123" in captured["text"]
    assert "TOKEN123" in captured["html"]
    assert captured["text"].strip(), "an empty plain part is as bad as none"


@pytest.mark.asyncio
async def test_magic_link_stays_on_the_brand_host(monkeypatch):
    """The link host must match the brand in the body, not the API subdomain.

    Caddy routes /api/v1/* on the apex to the backend, so this resolves to the
    same handler; the point is that the recipient never sees a hostname that
    disagrees with the brand they are being asked to trust.
    """
    captured = {}

    async def _capture(to, subject, html, text, *, required):
        captured.update(html=html, text=text)
        return True

    monkeypatch.setattr(email_service, "_send", _capture)
    await email_service.send_magic_link_email("someone@example.com", "TOKEN123")

    settings = get_settings()
    expected = f"{settings.frontend_base_url}/api/v1/auth/callback?token=TOKEN123"
    assert expected in captured["text"]
    assert expected in captured["html"]
    assert settings.api_base_url not in captured["text"] or (
        settings.api_base_url == settings.frontend_base_url
    ), "the sign-in link should not point at the API subdomain"


@pytest.mark.asyncio
async def test_invite_email_carries_a_plain_part(monkeypatch):
    """The invite path shares the transport, so it shares the requirement."""
    captured = {}

    async def _capture(to, subject, html, text, *, required):
        captured.update(text=text, html=html, required=required)
        return True

    monkeypatch.setattr(email_service, "_send", _capture)
    await email_service.send_workspace_invite_email(
        "invitee@example.com", "Acme", "owner@example.com", "editor"
    )

    assert captured["required"] is False, "an invite must not break its API call"
    assert "Acme" in captured["text"]
    assert "owner@example.com" in captured["text"]
    assert "editor" in captured["text"]


# --- permanent vs transient failure -----------------------------------------


def _client_error(code: str):
    """A botocore ClientError shaped the way SES actually raises it."""
    from botocore.exceptions import ClientError

    return ClientError({"Error": {"Code": code, "Message": code}}, "SendEmail")


@pytest.mark.parametrize(
    "code", ["MessageRejected", "AccountSuppressionList", "InvalidParameterValue"]
)
def test_permanent_ses_failures_are_classified_as_permanent(code):
    """These never clear on retry, so they must not be reported as retryable.

    `_classify` is exercised directly rather than through `_send`: conftest's
    autouse fixture replaces `_send` for every test so nothing can reach SES,
    which makes the wrapper untestable by design. The classifier is the unit
    that holds the knowledge anyway.
    """
    from app.services.email_service import PermanentDeliveryError, _classify

    assert isinstance(_classify(_client_error(code)), PermanentDeliveryError)


@pytest.mark.parametrize("code", ["Throttling", "ServiceUnavailable", "RequestTimeout"])
def test_transient_ses_failures_stay_transient(code):
    """Throttling is the case where 'try again' is genuinely the right advice."""
    from app.services.email_service import PermanentDeliveryError, _classify

    assert not isinstance(_classify(_client_error(code)), PermanentDeliveryError)


def test_a_non_botocore_exception_is_passed_through_untouched():
    """A connection error has no response dict; classifying must not crash."""
    from app.services.email_service import PermanentDeliveryError, _classify

    original = OSError("connection reset")
    assert _classify(original) is original
    assert not isinstance(_classify(original), PermanentDeliveryError)


@pytest.mark.asyncio
async def test_magic_link_reports_an_undeliverable_address_without_saying_retry(
    client, monkeypatch
):
    """The endpoint contract, not just the classifier.

    A user whose address is suppressed used to get "Please try again", which is
    the one action that could never work — they would retry forever.
    """
    from app.services import email_service

    async def _permanent(*a, **kw):
        raise email_service.PermanentDeliveryError("AccountSuppressionList")

    monkeypatch.setattr("app.api.v1.auth.send_magic_link_email", _permanent)

    response = await client.post(
        "/api/v1/auth/magic-link", json={"email": "bounced@example.com"}
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "try again" not in detail.lower(), "still telling the user to retry a permanent failure"
    assert "info@mocklane.com" in detail, "no way forward offered"
