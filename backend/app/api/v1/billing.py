import logging
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.config import get_settings
from app.services.billing_service import (
    create_checkout_session,
    create_portal_session,
    get_or_create_customer,
    handle_webhook_event,
    PLANS,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class CheckoutRequest(BaseModel):
    price_id: str
    success_url: str | None = None
    cancel_url: str | None = None


class PortalRequest(BaseModel):
    return_url: str | None = None


@router.get("/plans")
async def get_plans():
    return {"plans": PLANS}


@router.get("/status")
async def billing_status(current_user: User = Depends(get_current_user)):
    return {
        "plan": current_user.plan or "free",
        "has_billing": bool(current_user.stripe_customer_id),
    }


@router.post("/checkout")
async def create_checkout(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Billing not configured")

    success_url = payload.success_url or f"{settings.frontend_base_url}/dashboard/settings?billing=success"
    cancel_url = payload.cancel_url or f"{settings.frontend_base_url}/dashboard/settings?billing=cancelled"

    try:
        customer_id = await get_or_create_customer(current_user)
        if not current_user.stripe_customer_id:
            current_user.stripe_customer_id = customer_id
            await db.flush()

        url = await create_checkout_session(current_user, payload.price_id, success_url, cancel_url)
        return {"url": url}
    except Exception as e:
        logger.exception("Checkout session creation failed")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/portal")
async def create_portal(
    payload: PortalRequest,
    current_user: User = Depends(get_current_user),
):
    settings = get_settings()
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No billing account found")

    return_url = payload.return_url or f"{settings.frontend_base_url}/dashboard/settings"

    try:
        url = await create_portal_session(current_user, return_url)
        return {"url": url}
    except Exception as e:
        logger.exception("Portal session creation failed")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = handle_webhook_event(payload, sig)
    except Exception as e:
        logger.error("Webhook verification failed: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook")

    event_type = event["type"]
    logger.info("Stripe webhook: %s", event_type)

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        customer_id = session.get("customer")
        if customer_id:
            from sqlalchemy import select
            result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
            user = result.scalar_one_or_none()
            if user:
                user.plan = "pro"
                await db.flush()
                logger.info("User %s upgraded to pro", user.email)

    elif event_type == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        if customer_id:
            from sqlalchemy import select
            result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
            user = result.scalar_one_or_none()
            if user:
                user.plan = "free"
                await db.flush()
                logger.info("User %s downgraded to free", user.email)

    elif event_type == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        sub_status = sub.get("status")
        if customer_id:
            from sqlalchemy import select
            result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
            user = result.scalar_one_or_none()
            if user:
                if sub_status in ("active", "trialing"):
                    user.plan = "pro"
                elif sub_status in ("canceled", "unpaid", "past_due"):
                    user.plan = "free"
                await db.flush()

    return {"status": "ok"}
