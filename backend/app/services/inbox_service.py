import secrets
import uuid

from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inbox_email import InboxEmail
from app.models.workspace import Workspace


async def get_inbox_emails(
    workspace_id: uuid.UUID,
    limit: int,
    offset: int,
    db: AsyncSession,
) -> tuple[list[InboxEmail], int, int]:
    """Return (emails, total_count, unread_count)."""
    total = await db.scalar(
        select(func.count())
        .select_from(InboxEmail)
        .where(InboxEmail.workspace_id == workspace_id)
    )

    unread_count = await db.scalar(
        select(func.count())
        .select_from(InboxEmail)
        .where(InboxEmail.workspace_id == workspace_id, InboxEmail.is_read == False)
    )

    result = await db.execute(
        select(InboxEmail)
        .where(InboxEmail.workspace_id == workspace_id)
        .order_by(InboxEmail.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    emails = result.scalars().all()

    return list(emails), total or 0, unread_count or 0


async def get_inbox_email(
    email_id: uuid.UUID,
    workspace_id: uuid.UUID,
    db: AsyncSession,
) -> InboxEmail | None:
    result = await db.execute(
        select(InboxEmail).where(
            InboxEmail.id == email_id,
            InboxEmail.workspace_id == workspace_id,
        )
    )
    return result.scalar_one_or_none()


async def mark_as_read(
    email_id: uuid.UUID,
    workspace_id: uuid.UUID,
    db: AsyncSession,
) -> InboxEmail | None:
    await db.execute(
        update(InboxEmail)
        .where(InboxEmail.id == email_id, InboxEmail.workspace_id == workspace_id)
        .values(is_read=True)
    )
    await db.commit()
    return await get_inbox_email(email_id, workspace_id, db)


async def delete_inbox_email(
    email_id: uuid.UUID,
    workspace_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    result = await db.execute(
        delete(InboxEmail).where(
            InboxEmail.id == email_id,
            InboxEmail.workspace_id == workspace_id,
        )
    )
    await db.commit()
    return result.rowcount > 0


async def clear_inbox(
    workspace_id: uuid.UUID,
    db: AsyncSession,
) -> int:
    result = await db.execute(
        delete(InboxEmail).where(InboxEmail.workspace_id == workspace_id)
    )
    await db.commit()
    return result.rowcount


async def generate_smtp_credentials(
    workspace: Workspace,
    db: AsyncSession,
) -> tuple[str, str]:
    """Generate SMTP username/password for a workspace. Returns (username, password)."""
    if workspace.smtp_username and workspace.smtp_password:
        return workspace.smtp_username, workspace.smtp_password

    username = f"ws_{workspace.short_id}"
    password = secrets.token_urlsafe(24)

    workspace.smtp_username = username
    workspace.smtp_password = password
    await db.commit()
    await db.refresh(workspace)

    return username, password


async def regenerate_smtp_password(
    workspace: Workspace,
    db: AsyncSession,
) -> tuple[str, str]:
    """Regenerate SMTP password, keeping username. Returns (username, new_password)."""
    if not workspace.smtp_username:
        return await generate_smtp_credentials(workspace, db)

    password = secrets.token_urlsafe(24)
    workspace.smtp_password = password
    await db.commit()
    await db.refresh(workspace)

    return workspace.smtp_username, password


async def get_workspace_by_smtp_username(
    username: str,
    db: AsyncSession,
) -> Workspace | None:
    result = await db.execute(
        select(Workspace).where(Workspace.smtp_username == username)
    )
    return result.scalar_one_or_none()
