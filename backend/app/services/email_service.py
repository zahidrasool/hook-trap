import logging
from app.config import get_settings

logger = logging.getLogger(__name__)


async def send_magic_link_email(email: str, token: str):
    """Send magic link email via SendGrid."""
    settings = get_settings()
    link = f"{settings.api_base_url}/api/v1/auth/callback?token={token}"

    if not settings.sendgrid_api_key or settings.sendgrid_api_key == "sg_placeholder":
        print(f"[DEV EMAIL] To: {email}")
        print(f"[DEV EMAIL] Magic link: {link}")
        return

    import httpx

    logger.info("Sending magic link email to %s via SendGrid", email)

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {settings.sendgrid_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": email}]}],
                    "from": {"email": settings.sendgrid_from_email, "name": "MockLane"},
                    "subject": "Your MockLane sign-in link",
                    "content": [
                        {
                            "type": "text/html",
                            "value": (
                                f"<p>Hi,</p>"
                                f"<p>Click the link below to sign in to MockLane:</p>"
                                f'<p><a href="{link}" style="display:inline-block;padding:12px 24px;'
                                f'background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;'
                                f'text-decoration:none;border-radius:8px;font-weight:600;">'
                                f"Sign in to MockLane</a></p>"
                                f"<p>Or copy this link: {link}</p>"
                                f"<p>This link expires in {settings.magic_link_expiry_hours} hours.</p>"
                                f"<p>If you didn't request this, you can safely ignore this email.</p>"
                                f"<p>— MockLane</p>"
                            ),
                        }
                    ],
                },
            )
        if resp.status_code >= 400:
            logger.error("SendGrid returned %s: %s", resp.status_code, resp.text)
            raise Exception(f"SendGrid error {resp.status_code}: {resp.text}")
        logger.info("SendGrid accepted email to %s (status %s)", email, resp.status_code)
    except Exception:
        logger.exception("Failed to send magic link email to %s", email)
        raise


async def send_workspace_invite_email(
    email: str, workspace_name: str, invited_by_email: str, role: str
):
    """Send workspace invitation email."""
    settings = get_settings()
    login_link = f"{settings.frontend_base_url}/auth/login"

    if settings.environment == "development":
        print(f"[DEV EMAIL] Workspace invite to: {email}")
        print(f"[DEV EMAIL] Workspace: {workspace_name}")
        print(f"[DEV EMAIL] Invited by: {invited_by_email}")
        print(f"[DEV EMAIL] Role: {role}")
        print(f"[DEV EMAIL] Login link: {login_link}")
        return

    if not settings.sendgrid_api_key:
        print(f"[WARN] SendGrid not configured — skipping invite email to {email}")
        return

    import httpx

    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {settings.sendgrid_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": email}]}],
                "from": {"email": settings.sendgrid_from_email, "name": "MockLane"},
                "subject": f"You've been invited to {workspace_name} on MockLane",
                "content": [
                    {
                        "type": "text/html",
                        "value": (
                            f"<p>Hi,</p>"
                            f"<p><strong>{invited_by_email}</strong> has invited you to join "
                            f"the workspace <strong>{workspace_name}</strong> as <strong>{role}</strong>.</p>"
                            f'<p><a href="{login_link}">Log in to MockLane</a> to access your workspace.</p>'
                            f"<p>— MockLane</p>"
                        ),
                    }
                ],
            },
        )
