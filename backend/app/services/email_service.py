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
