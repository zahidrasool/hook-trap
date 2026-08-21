import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.endpoint import Endpoint
from app.models.session import ReplaySession, ReplayRequest
from app.models.user import User
from app.models.webhook import WebhookCapture
from app.schemas.webhook import (
    ReplaySessionCreate,
    ReplaySessionResponse,
    ReplaySessionDetailResponse,
    ReplayRequestCreate,
    ReplayRequestResponse,
)
from app.services.replay_service import replay_capture

router = APIRouter()


@router.post("/replay-sessions", response_model=ReplaySessionResponse, status_code=status.HTTP_201_CREATED)
async def create_replay_session(
    payload: ReplaySessionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new replay session."""
    # Verify endpoint exists and belongs to user
    result = await db.execute(
        select(Endpoint).where(Endpoint.id == payload.endpoint_id, Endpoint.user_id == user.id)
    )
    endpoint = result.scalar_one_or_none()
    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    session = ReplaySession(
        user_id=user.id,
        endpoint_id=payload.endpoint_id,
        name=payload.name,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)

    return session


@router.get("/replay-sessions", response_model=list[ReplaySessionResponse])
async def list_replay_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all replay sessions for the current user."""
    result = await db.execute(
        select(ReplaySession)
        .where(ReplaySession.user_id == user.id)
        .order_by(ReplaySession.created_at.desc())
    )
    return result.scalars().all()


@router.get("/replay-sessions/{session_id}", response_model=ReplaySessionDetailResponse)
async def get_replay_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get replay session detail with its requests."""
    result = await db.execute(
        select(ReplaySession)
        .options(selectinload(ReplaySession.requests))
        .where(ReplaySession.id == session_id, ReplaySession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Replay session not found")

    return session


@router.post(
    "/replay-sessions/{session_id}/requests",
    response_model=ReplayRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def execute_replay_request(
    session_id: uuid.UUID,
    payload: ReplayRequestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a replay request within a session."""
    # Verify session belongs to user
    result = await db.execute(
        select(ReplaySession).where(ReplaySession.id == session_id, ReplaySession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Replay session not found")

    # Load capture
    result = await db.execute(
        select(WebhookCapture).where(WebhookCapture.id == payload.capture_id)
    )
    capture = result.scalar_one_or_none()
    if not capture:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capture not found")

    # Verify capture belongs to the same endpoint as the session
    if capture.endpoint_id != session.endpoint_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Capture does not belong to the session's endpoint",
        )

    replay_request = await replay_capture(
        capture=capture,
        target_url=payload.target_url,
        modifications=payload.modifications,
        session_id=session_id,
        db=db,
    )

    return replay_request


@router.get("/replay-requests/{request_id}", response_model=ReplayRequestResponse)
async def get_replay_request(
    request_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get replay request detail."""
    result = await db.execute(
        select(ReplayRequest)
        .join(ReplaySession)
        .where(ReplayRequest.id == request_id, ReplaySession.user_id == user.id)
    )
    replay_request = result.scalar_one_or_none()
    if not replay_request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Replay request not found")

    return replay_request
