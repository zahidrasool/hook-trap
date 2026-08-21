import uuid
import secrets
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workspace import Workspace, WorkspaceMember
from app.models.user import User
from app.utils.short_id import generate_workspace_short_id


async def create_workspace(name: str, description: str | None, owner: User, db: AsyncSession) -> Workspace:
    short_id = generate_workspace_short_id()
    workspace = Workspace(
        short_id=short_id,
        name=name,
        description=description,
        owner_id=owner.id,
        api_key=secrets.token_urlsafe(32),
    )
    db.add(workspace)
    await db.flush()

    # Add owner as member
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=owner.id,
        role="owner",
    )
    db.add(member)
    await db.flush()
    await db.refresh(workspace)
    return workspace


async def get_user_workspaces(user_id: uuid.UUID, db: AsyncSession) -> list:
    result = await db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user_id)
        .order_by(Workspace.created_at.desc())
    )
    return result.all()


async def get_workspace_by_short_id(short_id: str, db: AsyncSession) -> Workspace | None:
    result = await db.execute(select(Workspace).where(Workspace.short_id == short_id))
    return result.scalar_one_or_none()


async def check_workspace_access(workspace_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession, min_role: str = "viewer") -> WorkspaceMember | None:
    role_hierarchy = {"owner": 4, "admin": 3, "editor": 2, "viewer": 1}
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        return None
    if role_hierarchy.get(member.role, 0) < role_hierarchy.get(min_role, 0):
        return None
    return member


async def get_workspace_member_count(workspace_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.scalar(
        select(func.count()).select_from(WorkspaceMember).where(WorkspaceMember.workspace_id == workspace_id)
    )
    return result or 0


async def get_workspace_mock_count(workspace_id: uuid.UUID, db: AsyncSession) -> int:
    from app.models.mock_endpoint import MockEndpoint
    result = await db.scalar(
        select(func.count()).select_from(MockEndpoint).where(MockEndpoint.workspace_id == workspace_id)
    )
    return result or 0


async def regenerate_api_key(workspace: Workspace, db: AsyncSession) -> str:
    new_key = secrets.token_urlsafe(32)
    workspace.api_key = new_key
    await db.flush()
    return new_key


async def invite_member(workspace: Workspace, email: str, role: str, invited_by: uuid.UUID, db: AsyncSession) -> WorkspaceMember:
    # Find or create user
    result = await db.execute(select(User).where(User.email == email.lower().strip()))
    user = result.scalar_one_or_none()

    if not user:
        user = User(email=email.lower().strip())
        db.add(user)
        await db.flush()

    # Check if already a member
    existing = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("User is already a member of this workspace")

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role=role,
        invited_by=invited_by,
    )
    db.add(member)
    await db.flush()
    await db.refresh(member)
    return member, user
