from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.schemas.user import MagicLinkRequest, MagicLinkResponse, MeResponse, TokenResponse
from app.services.auth_service import create_magic_link_token, verify_magic_link_token, create_session_token
from app.services.email_service import PermanentDeliveryError, send_magic_link_email
from app.api.deps import get_current_user
from app.config import get_settings
from app.services.rate_limit import check_rate_limit, client_ip

router = APIRouter()
settings = get_settings()


@router.post("/magic-link", response_model=MagicLinkResponse)
async def request_magic_link(
    payload: MagicLinkRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.lower().strip()

    # This endpoint is unauthenticated and sends mail to an address the caller
    # chooses, so it is the one route where abuse costs real money and sending
    # reputation. Limit by address and by source separately: the first stops one
    # inbox being flooded, the second stops one script enumerating many.
    allowed, retry = await check_rate_limit(f"magiclink:email:{email}", limit=5, window=3600)
    if allowed:
        allowed, retry = await check_rate_limit(
            f"magiclink:ip:{client_ip(request)}", limit=20, window=3600
        )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in requests. Please try again later.",
            headers={"Retry-After": str(retry)},
        )

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
    except PermanentDeliveryError:
        # "Please try again" is the one instruction that cannot work here. The
        # address is suppressed, malformed, or unverified under an SES sandbox,
        # and every retry fails identically — so say what actually has to
        # happen instead of inviting a loop. 422 rather than 502: the fault is
        # in the request, not upstream.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "We cannot deliver mail to that address. It may be misspelled, or "
                "it may have previously bounced or been marked as spam. Try a "
                "different address, or contact info@mocklane.com."
            ),
        )
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
