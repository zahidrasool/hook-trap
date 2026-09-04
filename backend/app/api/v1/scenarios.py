from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.db.database import get_db
from app.models.scenario import Scenario
from app.models.user import User
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioResponse,
    ScenarioUpdate,
)
from app.services.scenario_service import (
    allocate_slug,
    create_scenario,
    get_capture_endpoint,
    get_scenario_by_slug,
)
from app.services.workspace_service import (
    check_workspace_access,
    get_workspace_by_short_id,
)

router = APIRouter()


async def _to_response(scenario: Scenario, db: AsyncSession) -> ScenarioResponse:
    settings = get_settings()
    capture_endpoint = await get_capture_endpoint(scenario.id, db)
    return ScenarioResponse(
        id=scenario.id,
        workspace_id=scenario.workspace_id,
        short_id=scenario.short_id,
        name=scenario.name,
        slug=scenario.slug,
        description=scenario.description,
        steps=scenario.steps or [],
        variables=scenario.variables or {},
        timeout_seconds=scenario.timeout_seconds,
        is_active=scenario.is_active,
        scenario_url=f"{settings.api_base_url}/s/{scenario.short_id}",
        capture_url=(
            f"{settings.api_base_url}/h/{capture_endpoint.short_id}"
            if capture_endpoint
            else None
        ),
        created_at=scenario.created_at,
    )


async def _load(short_id: str, user: User, db: AsyncSession, *, min_role: str):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role=min_role)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=f"{min_role.title()} access required"
        )
    return workspace


async def _load_scenario(short_id: str, slug: str, user: User, db: AsyncSession, *, min_role: str):
    workspace = await _load(short_id, user, db, min_role=min_role)
    scenario = await get_scenario_by_slug(workspace.id, slug, db)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    return workspace, scenario


@router.post(
    "/workspaces/{short_id}/scenarios",
    status_code=status.HTTP_201_CREATED,
    response_model=ScenarioResponse,
)
async def create_scenario_endpoint(
    short_id: str,
    body: ScenarioCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await _load(short_id, user, db, min_role="editor")

    # allocate_slug reads the taken slugs and then inserts, so two concurrent
    # creates of the same name in one workspace can both pick the same slug —
    # a double-clicked submit button is enough. The unique constraint catches
    # it; without this the caller would see a 500 instead of an honest 409.
    try:
        scenario = await create_scenario(workspace, body.name, body.description, user, db)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That scenario name was just taken. Try again.",
        )

    await db.refresh(scenario)
    return await _to_response(scenario, db)


@router.get("/workspaces/{short_id}/scenarios", response_model=ScenarioListResponse)
async def list_scenarios(
    short_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await _load(short_id, user, db, min_role="viewer")
    result = await db.execute(
        select(Scenario)
        .where(Scenario.workspace_id == workspace.id)
        .order_by(Scenario.created_at.desc())
    )
    scenarios = list(result.scalars().all())
    return ScenarioListResponse(
        scenarios=[await _to_response(s, db) for s in scenarios],
        total=len(scenarios),
    )


@router.get("/workspaces/{short_id}/scenarios/{slug}", response_model=ScenarioResponse)
async def get_scenario(
    short_id: str,
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, scenario = await _load_scenario(short_id, slug, user, db, min_role="viewer")
    return await _to_response(scenario, db)


@router.patch("/workspaces/{short_id}/scenarios/{slug}", response_model=ScenarioResponse)
async def update_scenario(
    short_id: str,
    slug: str,
    body: ScenarioUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace, scenario = await _load_scenario(short_id, slug, user, db, min_role="editor")

    fields = body.model_dump(exclude_unset=True)
    # Renaming re-derives the slug, which is the CLI's address for this
    # scenario. The short_id never changes, so any URL already in use keeps
    # working.
    if "name" in fields and fields["name"] != scenario.name:
        scenario.slug = await allocate_slug(workspace.id, fields["name"], db)

    for field, value in fields.items():
        setattr(scenario, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(scenario)
    return await _to_response(scenario, db)


@router.delete(
    "/workspaces/{short_id}/scenarios/{slug}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_scenario(
    short_id: str,
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, scenario = await _load_scenario(short_id, slug, user, db, min_role="editor")
    await db.delete(scenario)
    await db.commit()
