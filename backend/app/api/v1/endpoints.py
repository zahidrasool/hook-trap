import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.user import User
from app.models.endpoint import Endpoint
from app.schemas.endpoint import EndpointCreate, EndpointResponse, EndpointListResponse
from app.api.deps import get_current_user
from app.utils.short_id import generate_short_id
from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.post("", response_model=EndpointResponse, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: EndpointCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    short_id = generate_short_id()

    endpoint = Endpoint(
        user_id=current_user.id,
        short_id=short_id,
        name=payload.name,
        description=payload.description,
    )
    db.add(endpoint)
    await db.flush()
    await db.refresh(endpoint)

    return EndpointResponse(
        id=endpoint.id,
        short_id=endpoint.short_id,
        name=endpoint.name,
        description=endpoint.description,
        endpoint_url=f"{settings.api_base_url}/h/{endpoint.short_id}",
        created_at=endpoint.created_at,
    )


@router.get("", response_model=EndpointListResponse)
async def list_endpoints(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Endpoint)
        .where(Endpoint.user_id == current_user.id, Endpoint.scenario_id.is_(None))
        .order_by(Endpoint.created_at.desc())
    )
    endpoints = result.scalars().all()

    return EndpointListResponse(
        data=[
            EndpointResponse(
                id=ep.id,
                short_id=ep.short_id,
                name=ep.name,
                description=ep.description,
                endpoint_url=f"{settings.api_base_url}/h/{ep.short_id}",
                created_at=ep.created_at,
            )
            for ep in endpoints
        ],
        total=len(endpoints),
    )


@router.get("/{endpoint_id}", response_model=EndpointResponse)
async def get_endpoint(
    endpoint_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Endpoint).where(
            Endpoint.id == endpoint_id,
            Endpoint.user_id == current_user.id,
        )
    )
    endpoint = result.scalar_one_or_none()

    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    return EndpointResponse(
        id=endpoint.id,
        short_id=endpoint.short_id,
        name=endpoint.name,
        description=endpoint.description,
        endpoint_url=f"{settings.api_base_url}/h/{endpoint.short_id}",
        created_at=endpoint.created_at,
    )
