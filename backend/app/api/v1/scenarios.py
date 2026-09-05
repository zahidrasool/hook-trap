import uuid as uuid_module

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.mocks import _mock_to_response
from app.config import get_settings
from app.db.database import get_db
from app.models.mock_endpoint import MockEndpoint
from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult
from app.models.user import User
from app.schemas.mock import (
    MockEndpointCreate,
    MockEndpointListResponse,
    MockEndpointResponse,
)
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioResponse,
    ScenarioUpdate,
)
from app.schemas.scenario_run import (
    RunAcceptedResponse,
    RunListResponse,
    RunResponse,
    RunSummaryResponse,
    RunTrigger,
    StepResultResponse,
)
from app.services.scenario_run_service import cancel_run, create_run
from app.services.scenario_service import (
    allocate_slug,
    create_scenario,
    get_capture_endpoint,
    get_scenario_by_slug,
    slugify,
)
from app.services.usage_service import consume_quota
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
    except IntegrityError as exc:
        await db.rollback()
        # create_scenario also inserts a capture Endpoint whose short_id is
        # unique with no retry, and the FK to the workspace can fail too.
        # Only the scenario-slug race is something "try again" actually fixes;
        # anything else is a different failure and should surface as one.
        # exc.orig is SQLAlchemy's asyncpg DBAPI wrapper (AsyncAdapt_asyncpg_dbapi
        # .IntegrityError), which has no constraint_name of its own. The actual
        # asyncpg.exceptions.UniqueViolationError -- the one that carries
        # constraint_name -- is one level further down, on __cause__.
        cause = getattr(exc.orig, "__cause__", None)
        constraint = getattr(cause, "constraint_name", "") or ""
        if "slug" not in constraint:
            raise
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
        # allocate_slug reads every slug in the workspace, including this
        # row's own, so compare on the derived slug: a cosmetic rename that
        # slugifies to what we already have must not move the address.
        new_slug = slugify(fields["name"])
        if new_slug != scenario.slug:
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


@router.post(
    "/workspaces/{short_id}/scenarios/{slug}/mocks",
    status_code=status.HTTP_201_CREATED,
    response_model=MockEndpointResponse,
)
async def create_scenario_mock(
    short_id: str,
    slug: str,
    body: MockEndpointCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace, scenario = await _load_scenario(short_id, slug, user, db, min_role="editor")
    method = body.method.upper()

    existing = await db.execute(
        select(MockEndpoint).where(
            MockEndpoint.scenario_id == scenario.id,
            MockEndpoint.path == body.path,
            MockEndpoint.method == method,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This scenario already defines {method} {body.path}",
        )

    mock = MockEndpoint(
        workspace_id=workspace.id,
        scenario_id=scenario.id,
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
    return _mock_to_response(mock, scenario.short_id, scenario=True)


@router.get(
    "/workspaces/{short_id}/scenarios/{slug}/mocks",
    response_model=MockEndpointListResponse,
)
async def list_scenario_mocks(
    short_id: str,
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, scenario = await _load_scenario(short_id, slug, user, db, min_role="viewer")
    result = await db.execute(
        select(MockEndpoint)
        .where(MockEndpoint.scenario_id == scenario.id)
        .order_by(MockEndpoint.created_at.desc())
    )
    mocks = list(result.scalars().all())
    return MockEndpointListResponse(
        data=[_mock_to_response(m, scenario.short_id, scenario=True) for m in mocks],
        total=len(mocks),
    )


@router.post(
    "/workspaces/{short_id}/scenarios/{slug}/run",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=RunAcceptedResponse,
)
async def trigger_run(
    short_id: str,
    slug: str,
    body: RunTrigger | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace, scenario = await _load_scenario(short_id, slug, user, db, min_role="editor")

    if not scenario.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This scenario is not active"
        )

    owner = await db.get(User, workspace.owner_id)
    if owner is not None:
        allowed, used, limit = await consume_quota(owner, "scenario_runs", db)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Monthly scenario run quota exceeded ({used}/{limit})",
            )

    run = await create_run(scenario, body.variables if body else {}, "api", db)
    await db.commit()
    return RunAcceptedResponse(run_id=run.id, status=run.status)


@router.get(
    "/workspaces/{short_id}/scenarios/{slug}/runs", response_model=RunListResponse
)
async def list_runs(
    short_id: str,
    slug: str,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run history for one scenario, newest first.

    Paginated because run history is unbounded — the retention sweep is
    optional and disabled by default, so this list only ever grows.
    """
    _, scenario = await _load_scenario(short_id, slug, user, db, min_role="viewer")

    total = await db.scalar(
        select(func.count())
        .select_from(ScenarioRun)
        .where(ScenarioRun.scenario_id == scenario.id)
    )

    # One grouped query for the step counts rather than a query per run: a
    # 25-row page would otherwise issue 26.
    step_counts = dict(
        (
            await db.execute(
                select(ScenarioStepResult.run_id, func.count())
                .join(ScenarioRun, ScenarioRun.id == ScenarioStepResult.run_id)
                .where(ScenarioRun.scenario_id == scenario.id)
                .group_by(ScenarioStepResult.run_id)
            )
        ).all()
    )

    result = await db.execute(
        select(ScenarioRun)
        .where(ScenarioRun.scenario_id == scenario.id)
        .order_by(ScenarioRun.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    return RunListResponse(
        runs=[
            RunSummaryResponse(
                id=run.id,
                scenario_id=run.scenario_id,
                status=run.status,
                trigger=run.trigger,
                started_at=run.started_at,
                finished_at=run.finished_at,
                duration_ms=run.duration_ms,
                error=run.error,
                created_at=run.created_at,
                step_count=step_counts.get(run.id, 0),
            )
            for run in result.scalars().all()
        ],
        total=total or 0,
    )


async def _load_run(short_id: str, run_id: uuid_module.UUID, user: User, db: AsyncSession):
    workspace = await _load(short_id, user, db, min_role="viewer")
    result = await db.execute(
        select(ScenarioRun).where(
            ScenarioRun.id == run_id,
            # Scoped to the workspace in the path, so a run id from another
            # workspace is not reachable by guessing.
            ScenarioRun.workspace_id == workspace.id,
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return workspace, run


@router.get("/workspaces/{short_id}/runs/{run_id}", response_model=RunResponse)
async def get_run(
    short_id: str,
    run_id: uuid_module.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, run = await _load_run(short_id, run_id, user, db)

    results = await db.execute(
        select(ScenarioStepResult)
        .where(ScenarioStepResult.run_id == run.id)
        .order_by(ScenarioStepResult.step_index)
    )

    return RunResponse(
        id=run.id,
        scenario_id=run.scenario_id,
        status=run.status,
        trigger=run.trigger,
        variables=run.variables or {},
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_ms=run.duration_ms,
        error=run.error,
        created_at=run.created_at,
        step_results=[
            StepResultResponse(
                step_index=r.step_index,
                step_type=r.step_type,
                status=r.status,
                started_at=r.started_at,
                finished_at=r.finished_at,
                request=r.request,
                response=r.response,
                assertions=r.assertions or [],
                captured=r.captured or {},
                error=r.error,
                matched_id=r.matched_id,
            )
            for r in results.scalars().all()
        ],
    )


@router.post("/workspaces/{short_id}/runs/{run_id}/cancel")
async def cancel_run_endpoint(
    short_id: str,
    run_id: uuid_module.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await _load(short_id, user, db, min_role="editor")
    result = await db.execute(
        select(ScenarioRun).where(
            ScenarioRun.id == run_id, ScenarioRun.workspace_id == workspace.id
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    if not await cancel_run(run, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run has already finished with status {run.status!r}",
        )

    await db.commit()
    return {"status": run.status}
