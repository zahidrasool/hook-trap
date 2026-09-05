"""Outbound transactional email.

Two backends are supported, selected by settings.email_provider:

  "ses"      Amazon SES via the instance's IAM role. Preferred in production:
             ~$0.10 per 1,000 messages and, more importantly, no API key to
             store or rotate — boto3 picks up the role from the instance
             metadata service.
  "sendgrid" HTTP API with a bearer token. Retained as a fallback.

With neither configured, messages are printed to the log so local development
works without credentials.
"""

import asyncio
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

FROM_NAME = "MockLane"


class PermanentDeliveryError(Exception):
    """Delivery failed in a way that retrying cannot fix.

    A suppressed recipient (SES suppresses hard bounces and complaints at the
    account level), a malformed address, or an unverified recipient while the
    account is in the sandbox are all permanent. Telling someone to "try again"
    in those cases sends them into a loop that can never terminate, which is
    the single most common way a sign-in page wastes a user's afternoon.
    """


# SES error codes that no amount of retrying will clear. Everything else —
# throttling, timeouts, 5xx — is transient and keeps the old retry advice.
_PERMANENT_SES_ERRORS = frozenset(
    {
        "MessageRejected",          # unverified recipient in sandbox; blocked content
        "AccountSuppressionList",   # we previously hard-bounced or they complained
        "InvalidParameterValue",    # malformed address
    }
)


def _send_via_ses(sender: str, to: str, subject: str, html: str, text: str) -> str:
    """Synchronous SES call. Executed off the event loop by _send()."""
    import boto3

    settings = get_settings()
    client = boto3.client("ses", region_name=settings.aws_region)
    resp = client.send_email(
        Source=f"{FROM_NAME} <{sender}>",
        Destination={"ToAddresses": [to]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            # Both parts, always. Supplying Html alone makes SES emit a
            # text/html singlepart, and HTML with no plain-text alternative is
            # a long-standing spam heuristic (SpamAssassin scores it directly
            # as MIME_HTML_ONLY). Genuine transactional mail is
            # multipart/alternative; a sign-in link is already shaped like
            # phishing, so it cannot afford to skip the easy signals.
            "Body": {
                "Html": {"Data": html, "Charset": "UTF-8"},
                "Text": {"Data": text, "Charset": "UTF-8"},
            },
        },
    )
    return resp["MessageId"]


async def _send_via_sendgrid(
    sender: str, to: str, subject: str, html: str, text: str
) -> None:
    import httpx

    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {settings.sendgrid_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to}]}],
                "from": {"email": sender, "name": FROM_NAME},
                "subject": subject,
                # Ascending preference order: RFC 2046 requires the
                # richest alternative last, and SendGrid rejects any other
                # ordering outright.
                "content": [
                    {"type": "text/plain", "value": text},
                    {"type": "text/html", "value": html},
                ],
            },
        )
    if resp.status_code >= 400:
        raise Exception(f"SendGrid error {resp.status_code}: {resp.text}")


async def _send(
    to: str, subject: str, html: str, text: str, *, required: bool
) -> bool:
    """Deliver one message. Returns True if it was actually sent.

    `required` distinguishes mail the product cannot function without (the
    sign-in link) from mail that is merely nice to have (workspace invites).
    Failures on the former propagate so the endpoint can return an error rather
    than silently claiming success.
    """
    settings = get_settings()
    sender = settings.email_from_address
    provider = settings.email_provider.lower()

    if provider == "ses":
        configured = True
    elif provider == "sendgrid":
        configured = bool(settings.sendgrid_api_key)
    else:
        configured = False

    if not configured:
        logger.warning("Email provider %r not configured; logging instead", provider)
        # The plain part, not the HTML: in dev this is read in a terminal,
        # and the sign-in link has to be findable by eye.
        print(f"[DEV EMAIL] To: {to}\n[DEV EMAIL] Subject: {subject}\n{text}")
        return False

    try:
        if provider == "ses":
            # boto3 is blocking, so keep it off the event loop.
            message_id = await asyncio.to_thread(
                _send_via_ses, sender, to, subject, html, text
            )
            logger.info("SES accepted mail to %s (MessageId %s)", to, message_id)
        else:
            await _send_via_sendgrid(sender, to, subject, html, text)
            logger.info("SendGrid accepted mail to %s", to)
        return True
    except Exception as exc:
        logger.exception("Failed to send %r to %s via %s", subject, to, provider)
        if required:
            raise _classify(exc)
        return False


def _classify(exc: Exception) -> Exception:
    """Re-raise permanent failures as PermanentDeliveryError, pass the rest through.

    botocore raises ClientError for everything, with the distinction buried in
    response["Error"]["Code"], so the caller cannot tell a suppressed recipient
    from a throttle without unpacking it here.
    """
    code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
    if code in _PERMANENT_SES_ERRORS:
        return PermanentDeliveryError(code)
    return exc


async def send_magic_link_email(email: str, token: str):
    settings = get_settings()
    # The apex, not api_base_url. The callback is a backend route, but Caddy
    # routes /api/v1/* on the apex to the backend, and the Next.js dev server
    # rewrites it the same way, so this resolves identically. What it buys is a
    # single-host journey: a link whose hostname differs from the brand shown in
    # the body is a documented phishing heuristic, and a sign-in email is the
    # worst possible place to trip it.
    link = f"{settings.frontend_base_url}/api/v1/auth/callback?token={token}"

    html = (
        f"<p>Hi,</p>"
        f"<p>Click the link below to sign in to MockLane:</p>"
        f'<p><a href="{link}" style="display:inline-block;padding:12px 24px;'
        f"background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;"
        f'text-decoration:none;border-radius:8px;font-weight:600;">'
        f"Sign in to MockLane</a></p>"
        f"<p>Or copy this link: {link}</p>"
        f"<p>This link expires in {settings.magic_link_expiry_hours} hours.</p>"
        f"<p>If you didn't request this, you can safely ignore this email.</p>"
        f"<p>&mdash; MockLane</p>"
    )
    text = (
        "Hi,\n\n"
        "Click the link below to sign in to MockLane:\n\n"
        f"{link}\n\n"
        f"This link expires in {settings.magic_link_expiry_hours} hours.\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "-- MockLane"
    )
    await _send(email, "Your MockLane sign-in link", html, text, required=True)


async def send_workspace_invite_email(
    email: str, workspace_name: str, invited_by_email: str, role: str
):
    settings = get_settings()
    login_link = f"{settings.frontend_base_url}/auth/login"

    html = (
        f"<p>Hi,</p>"
        f"<p><strong>{invited_by_email}</strong> has invited you to join "
        f"the workspace <strong>{workspace_name}</strong> as <strong>{role}</strong>.</p>"
        f'<p><a href="{login_link}">Log in to MockLane</a> to access your workspace.</p>'
        f"<p>&mdash; MockLane</p>"
    )
    text = (
        "Hi,\n\n"
        f"{invited_by_email} has invited you to join the workspace "
        f"{workspace_name} as {role}.\n\n"
        f"Log in to MockLane to access your workspace:\n\n{login_link}\n\n"
        "-- MockLane"
    )
    # An invite failing should not break the API call that triggered it.
    await _send(
        email,
        f"You've been invited to {workspace_name} on MockLane",
        html,
        text,
        required=False,
    )
