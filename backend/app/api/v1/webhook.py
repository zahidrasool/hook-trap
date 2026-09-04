import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.endpoint import Endpoint
from app.models.scenario import Scenario
from app.models.webhook import WebhookCapture
from app.models.workspace import WorkspaceMember
from app.models.user import User
from app.schemas.webhook import WebhookCaptureResponse, CaptureListResponse
from app.api.deps import get_current_user

router = APIRouter()


def _visible_endpoint_ids(user_id: uuid.UUID):
    """Endpoint ids `user_id` may read captures from.

    A personal endpoint (scenario_id IS NULL) stays creator-only, unchanged.
    A scenario-owned endpoint is readable by any member of the scenario's
    workspace (viewer or above -- any WorkspaceMember row already satisfies
    that, since viewer is the bottom of the role hierarchy), not just whoever
    happened to create the scenario.
    """
    return (
        select(Endpoint.id)
        .outerjoin(Scenario, Endpoint.scenario_id == Scenario.id)
        .outerjoin(
            WorkspaceMember,
            and_(
                WorkspaceMember.workspace_id == Scenario.workspace_id,
                WorkspaceMember.user_id == user_id,
            ),
        )
        .where(
            or_(
                and_(Endpoint.scenario_id.is_(None), Endpoint.user_id == user_id),
                and_(Endpoint.scenario_id.isnot(None), WorkspaceMember.id.isnot(None)),
            )
        )
    )


@router.get("", response_model=CaptureListResponse)
async def list_captures(
    endpoint_id: uuid.UUID | None = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Build query - only show captures for endpoints the user can read
    # (their own personal endpoints, plus any scenario-owned endpoint whose
    # workspace they're a member of).
    visible = _visible_endpoint_ids(current_user.id)
    query = select(WebhookCapture).where(WebhookCapture.endpoint_id.in_(visible))
    count_query = (
        select(func.count())
        .select_from(WebhookCapture)
        .where(WebhookCapture.endpoint_id.in_(visible))
    )

    if endpoint_id:
        query = query.where(WebhookCapture.endpoint_id == endpoint_id)
        count_query = count_query.where(WebhookCapture.endpoint_id == endpoint_id)

    total = await db.scalar(count_query)

    result = await db.execute(
        query.order_by(WebhookCapture.captured_at.desc())
        .limit(limit)
        .offset(offset)
    )
    captures = result.scalars().all()

    return CaptureListResponse(
        data=[WebhookCaptureResponse.model_validate(c) for c in captures],
        total=total or 0,
        limit=limit,
        offset=offset,
    )


@router.get("/{capture_id}", response_model=WebhookCaptureResponse)
async def get_capture(
    capture_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebhookCapture).where(
            WebhookCapture.id == capture_id,
            WebhookCapture.endpoint_id.in_(_visible_endpoint_ids(current_user.id)),
        )
    )
    capture = result.scalar_one_or_none()

    if not capture:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capture not found")

    return WebhookCaptureResponse.model_validate(capture)


@router.delete("/{capture_id}")
async def delete_capture(
    capture_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebhookCapture).where(
            WebhookCapture.id == capture_id,
            WebhookCapture.endpoint_id.in_(_visible_endpoint_ids(current_user.id)),
        )
    )
    capture = result.scalar_one_or_none()

    if not capture:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capture not found")

    await db.delete(capture)
    return {"status": "deleted"}
