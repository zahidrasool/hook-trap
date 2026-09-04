import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, case, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin_user
from app.db.database import get_db
from app.models.user import User

router = APIRouter()


# --- Schemas ---

class DashboardStats(BaseModel):
    total_users: int
    active_users_30d: int
    blocked_users: int
    plan_breakdown: dict[str, int]
    signups_last_7_days: list[dict]
    recent_signups: list[dict]


class UserListItem(BaseModel):
    id: str
    email: str
    email_verified: bool
    plan: str
    is_admin: bool
    is_blocked: bool
    stripe_customer_id: str | None
    created_at: str
    updated_at: str


class UserListResponse(BaseModel):
    data: list[UserListItem]
    total: int
    page: int
    per_page: int


class UserUpdateRequest(BaseModel):
    plan: str | None = None
    is_admin: bool | None = None
    is_blocked: bool | None = None


class UserDetail(UserListItem):
    workspace_count: int
    endpoint_count: int
    sandbox_count: int


class PaymentItem(BaseModel):
    id: str
    amount: float
    currency: str
    status: str
    customer_email: str | None
    description: str | None
    created_at: str


class SubscriptionItem(BaseModel):
    id: str
    customer_email: str | None
    plan_name: str | None
    amount: float
    currency: str
    status: str
    current_period_end: str | None
    created_at: str


class PaymentsResponse(BaseModel):
    payments: list[PaymentItem]
    subscriptions: list[SubscriptionItem]
    total_revenue: float
    active_subscription_count: int
    currency: str
    stripe_configured: bool


# --- Endpoints ---

@router.get("/dashboard", response_model=DashboardStats)
async def admin_dashboard(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin dashboard with key metrics."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    # Total users
    total_result = await db.execute(select(func.count(User.id)))
    total_users = total_result.scalar() or 0

    # Active users (created or updated in last 30 days — proxy for activity)
    active_result = await db.execute(
        select(func.count(User.id)).where(User.updated_at >= thirty_days_ago)
    )
    active_users_30d = active_result.scalar() or 0

    # Blocked users
    blocked_result = await db.execute(
        select(func.count(User.id)).where(User.is_blocked == True)
    )
    blocked_users = blocked_result.scalar() or 0

    # Plan breakdown
    plan_result = await db.execute(
        select(User.plan, func.count(User.id)).group_by(User.plan)
    )
    plan_breakdown = {row[0]: row[1] for row in plan_result.all()}

    # Signups last 7 days (day by day)
    signups_7d = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count_result = await db.execute(
            select(func.count(User.id)).where(
                and_(User.created_at >= day_start, User.created_at < day_end)
            )
        )
        signups_7d.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "count": count_result.scalar() or 0,
        })

    # Recent signups (last 10)
    recent_result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(10)
    )
    recent_users = recent_result.scalars().all()
    recent_signups = [
        {
            "id": str(u.id),
            "email": u.email,
            "plan": u.plan,
            "created_at": u.created_at.isoformat(),
        }
        for u in recent_users
    ]

    return DashboardStats(
        total_users=total_users,
        active_users_30d=active_users_30d,
        blocked_users=blocked_users,
        plan_breakdown=plan_breakdown,
        signups_last_7_days=signups_7d,
        recent_signups=recent_signups,
    )


@router.get("/users", response_model=UserListResponse)
async def list_users(
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=255),
    plan: str = Query("", max_length=50),
    status: str = Query("", max_length=20),
):
    """List all users with search, filtering, and pagination."""
    query = select(User)
    count_query = select(func.count(User.id))

    if search:
        query = query.where(User.email.ilike(f"%{search}%"))
        count_query = count_query.where(User.email.ilike(f"%{search}%"))

    if plan:
        query = query.where(User.plan == plan)
        count_query = count_query.where(User.plan == plan)

    if status == "blocked":
        query = query.where(User.is_blocked == True)
        count_query = count_query.where(User.is_blocked == True)
    elif status == "active":
        query = query.where(User.is_blocked == False)
        count_query = count_query.where(User.is_blocked == False)
    elif status == "admin":
        query = query.where(User.is_admin == True)
        count_query = count_query.where(User.is_admin == True)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(User.created_at.desc()).offset(offset).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    return UserListResponse(
        data=[
            UserListItem(
                id=str(u.id),
                email=u.email,
                email_verified=u.email_verified,
                plan=u.plan,
                is_admin=u.is_admin,
                is_blocked=u.is_blocked,
                stripe_customer_id=u.stripe_customer_id,
                created_at=u.created_at.isoformat(),
                updated_at=u.updated_at.isoformat(),
            )
            for u in users
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/users/{user_id}", response_model=UserDetail)
async def get_user(
    user_id: uuid.UUID,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed user info including resource counts."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Count workspaces (through workspace_members table)
    from app.models.workspace import WorkspaceMember
    ws_count_result = await db.execute(
        select(func.count(WorkspaceMember.id)).where(WorkspaceMember.user_id == user_id)
    )
    workspace_count = ws_count_result.scalar() or 0

    # Count endpoints
    from app.models.endpoint import Endpoint
    ep_count_result = await db.execute(
        select(func.count(Endpoint.id)).where(
            Endpoint.user_id == user_id, Endpoint.scenario_id.is_(None)
        )
    )
    endpoint_count = ep_count_result.scalar() or 0

    # Count sandboxes
    from app.models.sandbox import Sandbox
    sb_count_result = await db.execute(
        select(func.count(Sandbox.id)).where(Sandbox.user_id == user_id)
    )
    sandbox_count = sb_count_result.scalar() or 0

    return UserDetail(
        id=str(user.id),
        email=user.email,
        email_verified=user.email_verified,
        plan=user.plan,
        is_admin=user.is_admin,
        is_blocked=user.is_blocked,
        stripe_customer_id=user.stripe_customer_id,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat(),
        workspace_count=workspace_count,
        endpoint_count=endpoint_count,
        sandbox_count=sandbox_count,
    )


@router.patch("/users/{user_id}", response_model=UserListItem)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdateRequest,
    admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user plan, admin status, or blocked status."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admins from removing their own admin status
    if user.id == admin.id and body.is_admin is False:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin status")

    # Prevent admins from blocking themselves
    if user.id == admin.id and body.is_blocked is True:
        raise HTTPException(status_code=400, detail="Cannot block your own account")

    if body.plan is not None:
        user.plan = body.plan
    if body.is_admin is not None:
        user.is_admin = body.is_admin
    if body.is_blocked is not None:
        user.is_blocked = body.is_blocked

    return UserListItem(
        id=str(user.id),
        email=user.email,
        email_verified=user.email_verified,
        plan=user.plan,
        is_admin=user.is_admin,
        is_blocked=user.is_blocked,
        stripe_customer_id=user.stripe_customer_id,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat(),
    )


@router.get("/payments", response_model=PaymentsResponse)
async def list_payments(
    admin: User = Depends(get_current_admin_user),
    limit: int = Query(25, ge=1, le=100),
):
    """Recent Stripe charges and subscriptions for payment tracking."""
    from app.config import get_settings
    from app.services.billing_service import get_stripe

    settings = get_settings()
    if not settings.stripe_secret_key:
        return PaymentsResponse(
            payments=[], subscriptions=[], total_revenue=0.0,
            active_subscription_count=0, currency="usd", stripe_configured=False,
        )

    s = get_stripe()
    try:
        charges = s.Charge.list(limit=limit, expand=["data.customer"])
        subs = s.Subscription.list(limit=limit, status="all", expand=["data.customer"])
    except Exception as e:  # pragma: no cover - network / auth failure
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

    def _email(obj) -> str | None:
        cust = getattr(obj, "customer", None)
        if cust is None:
            return None
        if isinstance(cust, str):
            return None
        return getattr(cust, "email", None)

    payments: list[PaymentItem] = []
    total_revenue = 0.0
    currency = "usd"
    for c in charges.data:
        amount = (c.amount or 0) / 100.0
        currency = c.currency or currency
        if c.status == "succeeded" and not c.refunded:
            total_revenue += amount
        payments.append(PaymentItem(
            id=c.id,
            amount=amount,
            currency=c.currency,
            status="refunded" if c.refunded else c.status,
            customer_email=_email(c) or getattr(c, "receipt_email", None),
            description=c.description,
            created_at=datetime.fromtimestamp(c.created, tz=timezone.utc).isoformat(),
        ))

    subscriptions: list[SubscriptionItem] = []
    active_count = 0
    for sub in subs.data:
        item = sub["items"]["data"][0] if sub["items"]["data"] else None
        price = item["price"] if item else None
        amount = ((price["unit_amount"] or 0) / 100.0) if price else 0.0
        plan_name = None
        if price:
            prod = price.get("product")
            plan_name = price.get("nickname") or (prod if isinstance(prod, str) else None)
        if sub.status in ("active", "trialing"):
            active_count += 1
        period_end = sub.get("current_period_end")
        subscriptions.append(SubscriptionItem(
            id=sub.id,
            customer_email=_email(sub),
            plan_name=plan_name,
            amount=amount,
            currency=(price["currency"] if price else "usd"),
            status=sub.status,
            current_period_end=(
                datetime.fromtimestamp(period_end, tz=timezone.utc).isoformat() if period_end else None
            ),
            created_at=datetime.fromtimestamp(sub.created, tz=timezone.utc).isoformat(),
        ))

    return PaymentsResponse(
        payments=payments,
        subscriptions=subscriptions,
        total_revenue=round(total_revenue, 2),
        active_subscription_count=active_count,
        currency=currency,
        stripe_configured=True,
    )
