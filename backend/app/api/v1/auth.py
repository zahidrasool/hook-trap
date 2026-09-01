from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import MagicLinkRequest, MagicLinkResponse, MeResponse, TokenResponse
from app.services.auth_service import create_magic_link_token, verify_magic_link_token, create_session_token
from app.services.email_service import send_magic_link_email
from app.api.deps import get_current_user
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("/magic-link", response_model=MagicLinkResponse)
async def request_magic_link(
    payload: MagicLinkRequest,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.lower().strip()

    # Create user if not exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(email=email)
        db.add(user)
        await db.flush()

    # Generate magic link token
    token = create_magic_link_token(str(user.id))

    try:
        await send_magic_link_email(email, token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send magic link email. Please try again.",
        )

    return MagicLinkResponse(email=email)


@router.get("/callback")
async def auth_callback(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    user_id = verify_magic_link_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    # Mark user as verified
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user.email_verified = True
    await db.flush()

    # Create session token
    session_token = create_session_token(str(user.id))

    # Redirect to frontend with token
    from fastapi.responses import RedirectResponse
    return RedirectResponse(
        url=f"{settings.frontend_base_url}/api/auth/callback?token={session_token}"
    )


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    # Token-based auth doesn't need server-side logout for now.
    # Future: maintain a token blacklist in Redis.
    return {"status": "logged_out"}
