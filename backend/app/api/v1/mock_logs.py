import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.mock_endpoint import MockEndpoint
from app.models.mock_request_log import MockRequestLog
from app.models.user import User
from app.schemas.mock import MockLogResponse, MockLogListResponse
from app.services.workspace_service import (
    get_workspace_by_short_id,
    check_workspace_access,
)

router = APIRouter()


@router.get(
    "/workspaces/{short_id}/logs",
    response_model=MockLogListResponse,
)
async def list_workspace_mock_logs(
    short_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    total = await db.scalar(
        select(func.count())
        .select_from(MockRequestLog)
        .where(MockRequestLog.workspace_id == workspace.id)
    )

    result = await db.execute(
        select(MockRequestLog)
        .where(MockRequestLog.workspace_id == workspace.id)
        .order_by(MockRequestLog.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = list(result.scalars().all())

    return MockLogListResponse(
        data=[
            MockLogResponse(
                id=log.id,
                mock_endpoint_id=log.mock_endpoint_id,
                method=log.method,
                path=log.path,
                query_params=log.query_params,
                headers=log.headers,
                body=log.body,
                matched_rule_id=log.matched_rule_id,
                matched_sequence_id=log.matched_sequence_id,
                response_status=log.response_status,
                response_delay_ms=log.response_delay_ms,
                contract_valid=log.contract_valid,
                received_at=log.received_at,
            )
            for log in logs
        ],
        total=total or 0,
    )


@router.get(
    "/mocks/{mock_id}/logs",
    response_model=MockLogListResponse,
)
async def list_mock_endpoint_logs(
    mock_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find mock and check access
    result = await db.execute(
        select(MockEndpoint).where(MockEndpoint.id == mock_id)
    )
    mock = result.scalar_one_or_none()
    if not mock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mock endpoint not found")

    member = await check_workspace_access(mock.workspace_id, user.id, db)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    total = await db.scalar(
        select(func.count())
        .select_from(MockRequestLog)
        .where(MockRequestLog.mock_endpoint_id == mock_id)
    )

    result = await db.execute(
        select(MockRequestLog)
        .where(MockRequestLog.mock_endpoint_id == mock_id)
        .order_by(MockRequestLog.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = list(result.scalars().all())

    return MockLogListResponse(
        data=[
            MockLogResponse(
                id=log.id,
                mock_endpoint_id=log.mock_endpoint_id,
                method=log.method,
                path=log.path,
                query_params=log.query_params,
                headers=log.headers,
                body=log.body,
                matched_rule_id=log.matched_rule_id,
                matched_sequence_id=log.matched_sequence_id,
                response_status=log.response_status,
                response_delay_ms=log.response_delay_ms,
                contract_valid=log.contract_valid,
                received_at=log.received_at,
            )
            for log in logs
        ],
        total=total or 0,
    )
