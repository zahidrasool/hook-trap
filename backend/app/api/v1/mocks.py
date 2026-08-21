import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.config import get_settings
from app.db.database import get_db
from app.models.mock_endpoint import MockEndpoint
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.mock import (
    MockEndpointCreate,
    MockEndpointUpdate,
    MockEndpointResponse,
    MockEndpointListResponse,
    MockEndpointDetailResponse,
    MockRuleResponse,
    MockSequenceResponse,
    SequenceStepResponse,
)
from app.services.workspace_service import (
    get_workspace_by_short_id,
    check_workspace_access,
)

router = APIRouter()


@router.get("/template-helpers")
async def list_template_helpers():
    from app.services.template_engine import get_available_generators
    return get_available_generators()


def _build_mock_url(short_id: str, path: str) -> str:
    settings = get_settings()
    return f"{settings.api_base_url}/m/{short_id}{path}"


def _mock_to_response(mock: MockEndpoint, workspace_short_id: str) -> MockEndpointResponse:
    return MockEndpointResponse(
        id=mock.id,
        workspace_id=mock.workspace_id,
        path=mock.path,
        method=mock.method,
        name=mock.name,
        description=mock.description,
        mock_url=_build_mock_url(workspace_short_id, mock.path),
        is_active=mock.is_active,
        priority=mock.priority,
        response_status=mock.response_status,
        response_headers=mock.response_headers,
        response_body=mock.response_body,
        response_delay_ms=mock.response_delay_ms,
        error_rate=mock.error_rate,
        error_status=mock.error_status,
        error_body=mock.error_body,
        request_count=mock.request_count,
        static_data=mock.static_data,
        is_immutable=mock.is_immutable,
        created_at=mock.created_at,
    )


@router.post(
    "/workspaces/{short_id}/mocks",
    status_code=status.HTTP_201_CREATED,
    response_model=MockEndpointResponse,
)
async def create_mock_endpoint(
    short_id: str,
    body: MockEndpointCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    # Normalize method
    method = body.method.upper()

    # Check for duplicate path+method
    existing = await db.execute(
        select(MockEndpoint).where(
            MockEndpoint.workspace_id == workspace.id,
            MockEndpoint.path == body.path,
            MockEndpoint.method == method,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Mock endpoint already exists for {method} {body.path}",
        )

    mock = MockEndpoint(
        workspace_id=workspace.id,
        created_by=user.id,
        path=body.path,
        method=method,
        name=body.name,
        description=body.description,
        response_status=body.response_status,
        response_headers=body.response_headers or {"Content-Type": "application/json"},
        response_body=body.response_body,
        response_delay_ms=body.response_delay_ms,
        error_rate=body.error_rate,
        error_status=body.error_status,
        error_body=body.error_body,
        static_data=body.static_data,
        is_immutable=body.is_immutable,
    )
    db.add(mock)
    await db.flush()
    await db.commit()
    await db.refresh(mock)

    return _mock_to_response(mock, workspace.short_id)


@router.get(
    "/workspaces/{short_id}/mocks",
    response_model=MockEndpointListResponse,
)
async def list_mock_endpoints(
    short_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MockEndpoint)
        .where(MockEndpoint.workspace_id == workspace.id)
        .order_by(MockEndpoint.created_at.desc())
    )
    mocks = list(result.scalars().all())

    total = await db.scalar(
        select(func.count())
        .select_from(MockEndpoint)
        .where(MockEndpoint.workspace_id == workspace.id)
    )

    return MockEndpointListResponse(
        data=[_mock_to_response(m, workspace.short_id) for m in mocks],
        total=total or 0,
    )


@router.get(
    "/workspaces/{short_id}/mocks/{mock_id}",
    response_model=MockEndpointDetailResponse,
)
async def get_mock_endpoint(
    short_id: str,
    mock_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MockEndpoint)
        .options(
            selectinload(MockEndpoint.rules),
            selectinload(MockEndpoint.sequences),
        )
        .where(
            MockEndpoint.id == mock_id,
            MockEndpoint.workspace_id == workspace.id,
        )
    )
    mock = result.scalar_one_or_none()
    if not mock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mock endpoint not found")

    # Build rules response
    rules_resp = [
        MockRuleResponse(
            id=r.id,
            mock_endpoint_id=r.mock_endpoint_id,
            name=r.name,
            description=r.description,
            priority=r.priority,
            is_active=r.is_active,
            match_conditions=r.match_conditions if isinstance(r.match_conditions, list) else [r.match_conditions],
            response_status=r.response_status,
            response_headers=r.response_headers,
            response_body=r.response_body,
            response_delay_ms=r.response_delay_ms,
            created_at=r.created_at,
        )
        for r in mock.rules
    ]

    # Build sequences response (without steps eagerly loaded here, just basic info)
    sequences_resp = [
        MockSequenceResponse(
            id=s.id,
            mock_endpoint_id=s.mock_endpoint_id,
            name=s.name,
            is_active=s.is_active,
            loop=s.loop,
            current_step=s.current_step,
            steps=[],
            created_at=s.created_at,
        )
        for s in mock.sequences
    ]

    base = _mock_to_response(mock, workspace.short_id)
    return MockEndpointDetailResponse(
        **base.model_dump(),
        rules=rules_resp,
        sequences=sequences_resp,
    )


@router.patch(
    "/workspaces/{short_id}/mocks/{mock_id}",
    response_model=MockEndpointResponse,
)
async def update_mock_endpoint(
    short_id: str,
    mock_id: uuid.UUID,
    body: MockEndpointUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    result = await db.execute(
        select(MockEndpoint).where(
            MockEndpoint.id == mock_id,
            MockEndpoint.workspace_id == workspace.id,
        )
    )
    mock = result.scalar_one_or_none()
    if not mock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mock endpoint not found")

    update_data = body.model_dump(exclude_unset=True)
    if "method" in update_data:
        update_data["method"] = update_data["method"].upper()

    for key, value in update_data.items():
        setattr(mock, key, value)

    await db.flush()
    await db.commit()
    await db.refresh(mock)

    return _mock_to_response(mock, workspace.short_id)


@router.delete(
    "/workspaces/{short_id}/mocks/{mock_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_mock_endpoint(
    short_id: str,
    mock_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    result = await db.execute(
        select(MockEndpoint).where(
            MockEndpoint.id == mock_id,
            MockEndpoint.workspace_id == workspace.id,
        )
    )
    mock = result.scalar_one_or_none()
    if not mock:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mock endpoint not found")

    await db.delete(mock)
    await db.commit()
