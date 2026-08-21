# Email service - placeholder for production email sending
from app.config import get_settings


async def send_magic_link_email(email: str, token: str):
    """Send magic link email via SendGrid."""
    settings = get_settings()
    link = f"{settings.api_base_url}/api/v1/auth/callback?token={token}"

    if settings.environment == "development":
        print(f"[DEV EMAIL] To: {email}")
        print(f"[DEV EMAIL] Magic link: {link}")
        return

    # TODO: Implement SendGrid email sending
    pass


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

    await httpx.AsyncClient().post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={
            "Authorization": f"Bearer {settings.sendgrid_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "personalizations": [{"to": [{"email": email}]}],
            "from": {"email": settings.sendgrid_from_email, "name": "HookTrap"},
            "subject": f"You've been invited to {workspace_name} on HookTrap",
            "content": [
                {
                    "type": "text/html",
                    "value": (
                        f"<p>Hi,</p>"
                        f"<p><strong>{invited_by_email}</strong> has invited you to join "
                        f"the workspace <strong>{workspace_name}</strong> as <strong>{role}</strong>.</p>"
                        f'<p><a href="{login_link}">Log in to HookTrap</a> to access your workspace.</p>'
                        f"<p>— HookTrap</p>"
                    ),
                }
            ],
        },
    )
