import secrets
import uuid

from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.sandbox import Sandbox
from app.models.sandbox_email import SandboxEmail


def _generate_smtp_username() -> str:
    return f"sb_{secrets.token_hex(6)}"

def _generate_smtp_password() -> str:
    return secrets.token_urlsafe(24)


async def check_prefix_available(prefix: str, db: AsyncSession) -> bool:
    result = await db.scalar(
        select(func.count()).select_from(Sandbox).where(Sandbox.email_prefix == prefix)
    )
    return result == 0


async def suggest_prefix(prefix: str, db: AsyncSession) -> str | None:
    for suffix in range(1, 100):
        candidate = f"{prefix}-{suffix}"
        if len(candidate) <= 50 and await check_prefix_available(candidate, db):
            return candidate
    return None


async def create_sandbox(
    user_id: uuid.UUID, name: str, email_prefix: str,
    description: str | None, tags: list[str],
    email_retention_days: int | None, db: AsyncSession,
) -> Sandbox:
    settings = get_settings()
    email_address = f"{email_prefix}@{settings.smtp_server_hostname}"
    smtp_username = _generate_smtp_username()
    smtp_password = _generate_smtp_password()

    sandbox = Sandbox(
        user_id=user_id, name=name, email_prefix=email_prefix,
        email_address=email_address, smtp_username=smtp_username,
        smtp_password=smtp_password, description=description,
        tags=tags, email_retention_days=email_retention_days,
    )
    db.add(sandbox)
    await db.commit()
    await db.refresh(sandbox)
    return sandbox


async def list_sandboxes(user_id: uuid.UUID, db: AsyncSession, tag: str | None = None) -> list[Sandbox]:
    query = select(Sandbox).where(Sandbox.user_id == user_id).order_by(Sandbox.created_at.desc())
    if tag:
        query = query.where(Sandbox.tags.contains([tag]))
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_sandbox(sandbox_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Sandbox | None:
    result = await db.execute(
        select(Sandbox).where(Sandbox.id == sandbox_id, Sandbox.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_sandbox(
    sandbox: Sandbox, name: str | None, description: str | None,
    tags: list[str] | None, is_active: bool | None,
    email_retention_days: int | None, db: AsyncSession,
) -> Sandbox:
    if name is not None: sandbox.name = name
    if description is not None: sandbox.description = description
    if tags is not None: sandbox.tags = tags
    if is_active is not None: sandbox.is_active = is_active
    if email_retention_days is not None: sandbox.email_retention_days = email_retention_days
    await db.commit()
    await db.refresh(sandbox)
    return sandbox


async def delete_sandbox(sandbox_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> bool:
    result = await db.execute(
        delete(Sandbox).where(Sandbox.id == sandbox_id, Sandbox.user_id == user_id)
    )
    await db.commit()
    return result.rowcount > 0


async def regenerate_sandbox_password(sandbox: Sandbox, db: AsyncSession) -> str:
    new_password = _generate_smtp_password()
    sandbox.smtp_password = new_password
    await db.commit()
    await db.refresh(sandbox)
    return new_password


async def get_sandbox_email_counts(sandbox_id: uuid.UUID, db: AsyncSession) -> tuple[int, int]:
    total = await db.scalar(
        select(func.count()).select_from(SandboxEmail).where(SandboxEmail.sandbox_id == sandbox_id)
    ) or 0
    unread = await db.scalar(
        select(func.count()).select_from(SandboxEmail).where(
            SandboxEmail.sandbox_id == sandbox_id, SandboxEmail.is_read == False
        )
    ) or 0
    return total, unread


async def list_sandbox_emails(
    sandbox_id: uuid.UUID, limit: int, offset: int, db: AsyncSession, search: str | None = None,
) -> tuple[list[SandboxEmail], int, int]:
    base_filter = SandboxEmail.sandbox_id == sandbox_id
    total = await db.scalar(select(func.count()).select_from(SandboxEmail).where(base_filter)) or 0
    unread = await db.scalar(
        select(func.count()).select_from(SandboxEmail).where(base_filter, SandboxEmail.is_read == False)
    ) or 0

    query = select(SandboxEmail).where(base_filter).order_by(SandboxEmail.received_at.desc()).limit(limit).offset(offset)
    if search:
        query = query.where(
            SandboxEmail.subject.ilike(f"%{search}%") | SandboxEmail.from_address.ilike(f"%{search}%")
        )
    result = await db.execute(query)
    return list(result.scalars().all()), total, unread


async def get_sandbox_email(email_id: uuid.UUID, sandbox_id: uuid.UUID, db: AsyncSession) -> SandboxEmail | None:
    result = await db.execute(
        select(SandboxEmail).where(SandboxEmail.id == email_id, SandboxEmail.sandbox_id == sandbox_id)
    )
    return result.scalar_one_or_none()


async def mark_sandbox_email_read(
    email_id: uuid.UUID, sandbox_id: uuid.UUID, is_read: bool, db: AsyncSession,
) -> SandboxEmail | None:
    await db.execute(
        update(SandboxEmail).where(SandboxEmail.id == email_id, SandboxEmail.sandbox_id == sandbox_id).values(is_read=is_read)
    )
    await db.commit()
    return await get_sandbox_email(email_id, sandbox_id, db)


async def delete_sandbox_email(email_id: uuid.UUID, sandbox_id: uuid.UUID, db: AsyncSession) -> bool:
    result = await db.execute(
        delete(SandboxEmail).where(SandboxEmail.id == email_id, SandboxEmail.sandbox_id == sandbox_id)
    )
    await db.commit()
    return result.rowcount > 0


async def clear_sandbox_emails(sandbox_id: uuid.UUID, db: AsyncSession) -> int:
    result = await db.execute(delete(SandboxEmail).where(SandboxEmail.sandbox_id == sandbox_id))
    await db.commit()
    return result.rowcount
