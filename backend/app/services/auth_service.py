import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError

from app.config import get_settings

settings = get_settings()


def create_magic_link_token(user_id: str) -> str:
    """Create a short-lived token for magic link authentication."""
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.magic_link_expiry_hours)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "magic_link",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def verify_magic_link_token(token: str) -> uuid.UUID | None:
    """Verify a magic link token and return the user ID."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        token_type = payload.get("type")

        if token_type != "magic_link" or not user_id:
            return None

        return uuid.UUID(user_id)
    except (JWTError, ValueError):
        return None


def create_session_token(user_id: str) -> str:
    """Create a long-lived session token."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.session_expiry_days)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "session",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
