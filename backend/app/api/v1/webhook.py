import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.endpoint import Endpoint
from app.models.webhook import WebhookCapture
from app.models.user import User
from app.schemas.webhook import WebhookCaptureResponse, CaptureListResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=CaptureListResponse)
async def list_captures(
    endpoint_id: uuid.UUID | None = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Build query - only show captures for user's endpoints
    query = (
        select(WebhookCapture)
        .join(Endpoint, WebhookCapture.endpoint_id == Endpoint.id)
        .where(Endpoint.user_id == current_user.id)
    )
    count_query = (
        select(func.count())
        .select_from(WebhookCapture)
        .join(Endpoint, WebhookCapture.endpoint_id == Endpoint.id)
        .where(Endpoint.user_id == current_user.id)
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
        select(WebhookCapture)
        .join(Endpoint, WebhookCapture.endpoint_id == Endpoint.id)
        .where(
            WebhookCapture.id == capture_id,
            Endpoint.user_id == current_user.id,
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
        select(WebhookCapture)
        .join(Endpoint, WebhookCapture.endpoint_id == Endpoint.id)
        .where(
            WebhookCapture.id == capture_id,
            Endpoint.user_id == current_user.id,
        )
    )
    capture = result.scalar_one_or_none()

    if not capture:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capture not found")

    await db.delete(capture)
    return {"status": "deleted"}
