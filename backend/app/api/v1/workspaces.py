import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.db.database import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceListResponse,
    MemberInvite,
    MemberUpdate,
    MemberResponse,
    MemberListResponse,
)
from app.services.workspace_service import (
    create_workspace,
    get_user_workspaces,
    get_workspace_by_short_id,
    check_workspace_access,
    get_workspace_member_count,
    get_workspace_mock_count,
    invite_member,
)
from app.services.email_service import send_workspace_invite_email

router = APIRouter()


def _build_mock_base_url(short_id: str) -> str:
    settings = get_settings()
    return f"{settings.api_base_url}/mock/{short_id}"


async def _workspace_to_response(workspace, db: AsyncSession, role: str | None = None) -> WorkspaceResponse:
    member_count = await get_workspace_member_count(workspace.id, db)
    mock_count = await get_workspace_mock_count(workspace.id, db)
    return WorkspaceResponse(
        id=workspace.id,
        short_id=workspace.short_id,
        name=workspace.name,
        description=workspace.description,
        mock_base_url=_build_mock_base_url(workspace.short_id),
        owner_id=workspace.owner_id,
        created_at=workspace.created_at,
        member_count=member_count,
        mock_count=mock_count,
        role=role,
        is_public=workspace.is_public,
        api_key=workspace.api_key,
    )


# ── Workspace CRUD ──────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED, response_model=WorkspaceResponse)
async def create_workspace_endpoint(
    body: WorkspaceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await create_workspace(body.name, body.description, user, db)
    await db.commit()
    return await _workspace_to_response(workspace, db, role="owner")


@router.get("", response_model=WorkspaceListResponse)
async def list_workspaces(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await get_user_workspaces(user.id, db)
    data = []
    for workspace, role in rows:
        resp = await _workspace_to_response(workspace, db, role=role)
        data.append(resp)
    return WorkspaceListResponse(data=data)


@router.get("/{short_id}", response_model=WorkspaceResponse)
async def get_workspace(
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

    return await _workspace_to_response(workspace, db, role=member.role)


@router.patch("/{short_id}", response_model=WorkspaceResponse)
async def update_workspace(
    short_id: str,
    body: WorkspaceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="admin")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(workspace, key, value)

    await db.flush()
    await db.commit()
    await db.refresh(workspace)
    return await _workspace_to_response(workspace, db, role=member.role)


@router.delete("/{short_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    short_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="owner")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner access required")

    await db.delete(workspace)
    await db.commit()


@router.post("/{short_id}/regenerate-api-key")
async def regenerate_workspace_api_key(
    short_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    member = await check_workspace_access(workspace.id, user.id, db, min_role="admin")
    if not member:
        raise HTTPException(status_code=403, detail="Admin access required")
    from app.services.workspace_service import regenerate_api_key
    new_key = await regenerate_api_key(workspace, db)
    await db.commit()
    return {"api_key": new_key}


# ── Member management ───────────────────────────────────────────


@router.post("/{short_id}/members", status_code=status.HTTP_201_CREATED, response_model=MemberResponse)
async def invite_workspace_member(
    short_id: str,
    body: MemberInvite,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="admin")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if body.role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    try:
        new_member, invited_user = await invite_member(workspace, body.email, body.role, user.id, db)
        await db.commit()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    # Send invite email
    await send_workspace_invite_email(
        email=invited_user.email,
        workspace_name=workspace.name,
        invited_by_email=user.email,
        role=body.role,
    )

    return MemberResponse(
        id=new_member.id,
        user_id=new_member.user_id,
        workspace_id=new_member.workspace_id,
        email=invited_user.email,
        role=new_member.role,
        joined_at=new_member.joined_at,
    )


@router.get("/{short_id}/members", response_model=MemberListResponse)
async def list_workspace_members(
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
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace.id)
        .order_by(WorkspaceMember.joined_at)
    )
    rows = result.all()

    data = [
        MemberResponse(
            id=m.id,
            user_id=m.user_id,
            workspace_id=m.workspace_id,
            email=u.email,
            role=m.role,
            joined_at=m.joined_at,
        )
        for m, u in rows
    ]
    return MemberListResponse(data=data)


@router.patch("/{short_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role(
    short_id: str,
    user_id: uuid.UUID,
    body: MemberUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    caller = await check_workspace_access(workspace.id, user.id, db, min_role="admin")
    if not caller:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    if body.role not in ("admin", "editor", "viewer"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    # Cannot change owner's role
    if user_id == workspace.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change owner's role")

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == user_id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    target.role = body.role
    await db.flush()
    await db.commit()
    await db.refresh(target)

    # Fetch email
    user_result = await db.execute(select(User).where(User.id == user_id))
    target_user = user_result.scalar_one_or_none()

    return MemberResponse(
        id=target.id,
        user_id=target.user_id,
        workspace_id=target.workspace_id,
        email=target_user.email if target_user else None,
        role=target.role,
        joined_at=target.joined_at,
    )


@router.delete("/{short_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    short_id: str,
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    caller = await check_workspace_access(workspace.id, user.id, db, min_role="owner")
    if not caller:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner access required")

    # Cannot remove yourself as owner
    if user_id == workspace.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove workspace owner")

    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == user_id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    await db.delete(target)
    await db.commit()
