# Sandbox Inboxes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add standalone, user-level sandbox inboxes with user-chosen email prefixes, dedicated SMTP credentials, and isolated email storage.

**Architecture:** New `Sandbox` and `SandboxEmail` models independent of workspaces. The SMTP server authenticator falls through from workspace lookup to sandbox lookup. Frontend gets three new pages under `/dashboard/sandboxes/` plus a sidebar nav link.

**Tech Stack:** FastAPI, SQLAlchemy (async), Alembic, aiosmtpd (sync auth), Next.js 14 App Router, Tailwind CSS, PostgreSQL (JSONB).

---

## File Structure

### Backend — New Files
- `backend/app/models/sandbox.py` — `Sandbox` model
- `backend/app/models/sandbox_email.py` — `SandboxEmail` model
- `backend/app/schemas/sandbox.py` — Pydantic request/response schemas
- `backend/app/services/sandbox_service.py` — Business logic (CRUD, credentials, email ops)
- `backend/app/api/v1/sandboxes.py` — API routes
- `backend/alembic/versions/xxxx_add_sandboxes.py` — Migration (auto-generated)

### Backend — Modified Files
- `backend/app/models/__init__.py` — Register new models
- `backend/app/api/v1/router.py` — Mount sandboxes router
- `backend/app/services/smtp_server.py` — Add sandbox auth + email storage path
- `backend/app/models/user.py` — Add sandboxes relationship

### Frontend — New Files
- `frontend/src/types/sandbox.ts` — TypeScript types
- `frontend/src/app/dashboard/sandboxes/page.tsx` — Sandbox list page
- `frontend/src/app/dashboard/sandboxes/new/page.tsx` — Create sandbox form
- `frontend/src/app/dashboard/sandboxes/[id]/page.tsx` — Sandbox inbox view

### Frontend — Modified Files
- `frontend/src/components/layout/Sidebar.tsx` — Add "Sandboxes" nav link

---

## Task 1: Sandbox Model

**Files:**
- Create: `backend/app/models/sandbox.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/user.py`

- [ ] **Step 1: Create the Sandbox model**

Create `backend/app/models/sandbox.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Sandbox(BaseModel):
    __tablename__ = "sandboxes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email_prefix: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email_address: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    smtp_username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    smtp_password: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sandboxes")
    emails = relationship("SandboxEmail", back_populates="sandbox", cascade="all, delete-orphan")
```

- [ ] **Step 2: Create the SandboxEmail model**

Create `backend/app/models/sandbox_email.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SandboxEmail(Base):
    __tablename__ = "sandbox_emails"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sandbox_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sandboxes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_id: Mapped[str | None] = mapped_column(String(500), nullable=True)
    from_address: Mapped[str] = mapped_column(String(500), nullable=False)
    to_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    cc_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    bcc_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    subject: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    text_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    html_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    headers: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    attachments: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    raw_size: Mapped[int] = mapped_column(Integer, default=0)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    sandbox = relationship("Sandbox", back_populates="emails")
```

- [ ] **Step 3: Add sandboxes relationship to User model**

In `backend/app/models/user.py`, add after the existing relationships:

```python
    sandboxes = relationship("Sandbox", back_populates="user", cascade="all, delete-orphan")
```

- [ ] **Step 4: Register models in `__init__.py`**

In `backend/app/models/__init__.py`, add imports and `__all__` entries:

```python
from app.models.sandbox import Sandbox
from app.models.sandbox_email import SandboxEmail
```

Add `"Sandbox"` and `"SandboxEmail"` to `__all__`.

- [ ] **Step 5: Generate and run Alembic migration**

```bash
cd backend
alembic revision --autogenerate -m "add sandboxes and sandbox_emails tables"
alembic upgrade head
```

Verify both tables exist:
```bash
python -c "from sqlalchemy import create_engine, inspect; e=create_engine('postgresql://postgres:postgres@localhost:5432/hooktrap'); print(inspect(e).get_table_names())"
```

Expected: output includes `sandboxes` and `sandbox_emails`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/sandbox.py backend/app/models/sandbox_email.py backend/app/models/__init__.py backend/app/models/user.py backend/alembic/versions/
git commit -m "feat: add Sandbox and SandboxEmail models with migration"
```

---

## Task 2: Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/sandbox.py`

- [ ] **Step 1: Create sandbox schemas**

Create `backend/app/schemas/sandbox.py`:

```python
import uuid
import re
from datetime import datetime

from pydantic import BaseModel, field_validator

RESERVED_PREFIXES = {
    "admin", "postmaster", "abuse", "noreply", "support",
    "test", "info", "help", "billing", "sales",
}

PREFIX_PATTERN = re.compile(r"^[a-z][a-z0-9-]*[a-z0-9]$")


class SandboxCreate(BaseModel):
    name: str
    email_prefix: str
    description: str | None = None
    tags: list[str] = []
    email_retention_days: int | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("Name must be 1-100 characters")
        return v

    @field_validator("email_prefix")
    @classmethod
    def validate_prefix(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Prefix must be 3-50 characters")
        if not PREFIX_PATTERN.match(v):
            raise ValueError("Prefix must start with a letter, contain only lowercase letters, numbers, and hyphens, and not end with a hyphen")
        if "--" in v:
            raise ValueError("Prefix cannot contain consecutive hyphens")
        if v in RESERVED_PREFIXES:
            raise ValueError(f"Prefix '{v}' is reserved")
        return v

    @field_validator("email_retention_days")
    @classmethod
    def validate_retention(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("Retention must be at least 1 day")
        return v


class SandboxUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    is_active: bool | None = None
    email_retention_days: int | None = None


class SandboxResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email_prefix: str
    email_address: str
    description: str | None
    tags: list[str]
    is_active: bool
    email_retention_days: int | None
    created_at: datetime
    updated_at: datetime
    email_count: int = 0
    unread_count: int = 0

    model_config = {"from_attributes": True}


class SandboxListResponse(BaseModel):
    data: list[SandboxResponse]
    total: int


class SandboxCredentialsResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    email_address: str
    connection_url: str


class SandboxEmailSummary(BaseModel):
    id: uuid.UUID
    from_address: str
    to_addresses: list[str]
    subject: str | None
    is_read: bool
    received_at: datetime
    raw_size: int
    has_attachments: bool

    model_config = {"from_attributes": True}


class SandboxEmailResponse(BaseModel):
    id: uuid.UUID
    sandbox_id: uuid.UUID
    message_id: str | None
    from_address: str
    to_addresses: list[str]
    cc_addresses: list[str]
    bcc_addresses: list[str]
    subject: str | None
    text_body: str | None
    html_body: str | None
    headers: dict
    attachments: list
    raw_size: int
    is_read: bool
    received_at: datetime

    model_config = {"from_attributes": True}


class SandboxEmailListResponse(BaseModel):
    data: list[SandboxEmailSummary]
    total: int
    unread_count: int


class PrefixCheckResponse(BaseModel):
    available: bool
    suggestion: str | None = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/sandbox.py
git commit -m "feat: add Pydantic schemas for sandbox CRUD and email operations"
```

---

## Task 3: Sandbox Service Layer

**Files:**
- Create: `backend/app/services/sandbox_service.py`

- [ ] **Step 1: Create sandbox service**

Create `backend/app/services/sandbox_service.py`:

```python
import secrets
import uuid

from sqlalchemy import select, func, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.sandbox import Sandbox
from app.models.sandbox_email import SandboxEmail


def _generate_smtp_username() -> str:
    """Generate a unique SMTP username like sb_xxxx."""
    return f"sb_{secrets.token_hex(6)}"


def _generate_smtp_password() -> str:
    """Generate a random SMTP password."""
    return secrets.token_urlsafe(24)


async def check_prefix_available(prefix: str, db: AsyncSession) -> bool:
    """Check if an email prefix is available."""
    result = await db.scalar(
        select(func.count()).select_from(Sandbox).where(Sandbox.email_prefix == prefix)
    )
    return result == 0


async def suggest_prefix(prefix: str, db: AsyncSession) -> str | None:
    """Suggest an alternative prefix if the requested one is taken."""
    for suffix in range(1, 100):
        candidate = f"{prefix}-{suffix}"
        if len(candidate) <= 50 and await check_prefix_available(candidate, db):
            return candidate
    return None


async def create_sandbox(
    user_id: uuid.UUID,
    name: str,
    email_prefix: str,
    description: str | None,
    tags: list[str],
    email_retention_days: int | None,
    db: AsyncSession,
) -> Sandbox:
    """Create a new sandbox with auto-generated SMTP credentials."""
    settings = get_settings()
    email_address = f"{email_prefix}@{settings.smtp_server_hostname}"
    smtp_username = _generate_smtp_username()
    smtp_password = _generate_smtp_password()

    sandbox = Sandbox(
        user_id=user_id,
        name=name,
        email_prefix=email_prefix,
        email_address=email_address,
        smtp_username=smtp_username,
        smtp_password=smtp_password,
        description=description,
        tags=tags,
        email_retention_days=email_retention_days,
    )
    db.add(sandbox)
    await db.commit()
    await db.refresh(sandbox)
    return sandbox


async def list_sandboxes(
    user_id: uuid.UUID,
    db: AsyncSession,
    tag: str | None = None,
) -> list[Sandbox]:
    """List all sandboxes for a user, optionally filtered by tag."""
    query = select(Sandbox).where(Sandbox.user_id == user_id).order_by(Sandbox.created_at.desc())
    if tag:
        query = query.where(Sandbox.tags.contains([tag]))
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_sandbox(
    sandbox_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Sandbox | None:
    """Get a single sandbox, verifying ownership."""
    result = await db.execute(
        select(Sandbox).where(Sandbox.id == sandbox_id, Sandbox.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_sandbox(
    sandbox: Sandbox,
    name: str | None,
    description: str | None,
    tags: list[str] | None,
    is_active: bool | None,
    email_retention_days: int | None,
    db: AsyncSession,
) -> Sandbox:
    """Update mutable sandbox fields."""
    if name is not None:
        sandbox.name = name
    if description is not None:
        sandbox.description = description
    if tags is not None:
        sandbox.tags = tags
    if is_active is not None:
        sandbox.is_active = is_active
    if email_retention_days is not None:
        sandbox.email_retention_days = email_retention_days
    await db.commit()
    await db.refresh(sandbox)
    return sandbox


async def delete_sandbox(
    sandbox_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """Delete a sandbox and all its emails (CASCADE)."""
    result = await db.execute(
        delete(Sandbox).where(Sandbox.id == sandbox_id, Sandbox.user_id == user_id)
    )
    await db.commit()
    return result.rowcount > 0


async def regenerate_sandbox_password(
    sandbox: Sandbox,
    db: AsyncSession,
) -> str:
    """Regenerate SMTP password, return new password."""
    new_password = _generate_smtp_password()
    sandbox.smtp_password = new_password
    await db.commit()
    await db.refresh(sandbox)
    return new_password


# ── Sandbox Email Operations ──


async def get_sandbox_email_counts(
    sandbox_id: uuid.UUID,
    db: AsyncSession,
) -> tuple[int, int]:
    """Return (total_count, unread_count) for a sandbox."""
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
    sandbox_id: uuid.UUID,
    limit: int,
    offset: int,
    db: AsyncSession,
    search: str | None = None,
) -> tuple[list[SandboxEmail], int, int]:
    """Return (emails, total_count, unread_count)."""
    base_filter = SandboxEmail.sandbox_id == sandbox_id

    total = await db.scalar(
        select(func.count()).select_from(SandboxEmail).where(base_filter)
    ) or 0

    unread = await db.scalar(
        select(func.count()).select_from(SandboxEmail).where(
            base_filter, SandboxEmail.is_read == False
        )
    ) or 0

    query = (
        select(SandboxEmail)
        .where(base_filter)
        .order_by(SandboxEmail.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if search:
        search_filter = (
            SandboxEmail.subject.ilike(f"%{search}%")
            | SandboxEmail.from_address.ilike(f"%{search}%")
        )
        query = query.where(search_filter)

    result = await db.execute(query)
    return list(result.scalars().all()), total, unread


async def get_sandbox_email(
    email_id: uuid.UUID,
    sandbox_id: uuid.UUID,
    db: AsyncSession,
) -> SandboxEmail | None:
    result = await db.execute(
        select(SandboxEmail).where(
            SandboxEmail.id == email_id, SandboxEmail.sandbox_id == sandbox_id
        )
    )
    return result.scalar_one_or_none()


async def mark_sandbox_email_read(
    email_id: uuid.UUID,
    sandbox_id: uuid.UUID,
    is_read: bool,
    db: AsyncSession,
) -> SandboxEmail | None:
    await db.execute(
        update(SandboxEmail)
        .where(SandboxEmail.id == email_id, SandboxEmail.sandbox_id == sandbox_id)
        .values(is_read=is_read)
    )
    await db.commit()
    return await get_sandbox_email(email_id, sandbox_id, db)


async def delete_sandbox_email(
    email_id: uuid.UUID,
    sandbox_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    result = await db.execute(
        delete(SandboxEmail).where(
            SandboxEmail.id == email_id, SandboxEmail.sandbox_id == sandbox_id
        )
    )
    await db.commit()
    return result.rowcount > 0


async def clear_sandbox_emails(
    sandbox_id: uuid.UUID,
    db: AsyncSession,
) -> int:
    result = await db.execute(
        delete(SandboxEmail).where(SandboxEmail.sandbox_id == sandbox_id)
    )
    await db.commit()
    return result.rowcount
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/sandbox_service.py
git commit -m "feat: add sandbox service layer with CRUD and email operations"
```

---

## Task 4: API Routes

**Files:**
- Create: `backend/app/api/v1/sandboxes.py`
- Modify: `backend/app/api/v1/router.py`

- [ ] **Step 1: Create sandboxes API routes**

Create `backend/app/api/v1/sandboxes.py`:

```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.db.database import get_db
from app.models.user import User
from app.schemas.sandbox import (
    SandboxCreate,
    SandboxUpdate,
    SandboxResponse,
    SandboxListResponse,
    SandboxCredentialsResponse,
    SandboxEmailSummary,
    SandboxEmailResponse,
    SandboxEmailListResponse,
    PrefixCheckResponse,
)
from app.services.sandbox_service import (
    check_prefix_available,
    suggest_prefix,
    create_sandbox,
    list_sandboxes,
    get_sandbox,
    update_sandbox,
    delete_sandbox,
    regenerate_sandbox_password,
    get_sandbox_email_counts,
    list_sandbox_emails,
    get_sandbox_email,
    mark_sandbox_email_read,
    delete_sandbox_email,
    clear_sandbox_emails,
)

router = APIRouter()


# ── Prefix check (must be above {sandbox_id} routes) ──

@router.get("/sandboxes/check-prefix/{prefix}", response_model=PrefixCheckResponse)
async def check_prefix(
    prefix: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if an email prefix is available."""
    available = await check_prefix_available(prefix.lower(), db)
    suggestion = None
    if not available:
        suggestion = await suggest_prefix(prefix.lower(), db)
    return PrefixCheckResponse(available=available, suggestion=suggestion)


# ── Sandbox CRUD ──

@router.post("/sandboxes", response_model=SandboxResponse, status_code=status.HTTP_201_CREATED)
async def create_sandbox_endpoint(
    body: SandboxCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new sandbox inbox."""
    available = await check_prefix_available(body.email_prefix, db)
    if not available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Prefix '{body.email_prefix}' is already taken",
        )

    sandbox = await create_sandbox(
        user_id=user.id,
        name=body.name,
        email_prefix=body.email_prefix,
        description=body.description,
        tags=body.tags,
        email_retention_days=body.email_retention_days,
        db=db,
    )
    return SandboxResponse.model_validate(sandbox)


@router.get("/sandboxes", response_model=SandboxListResponse)
async def list_sandboxes_endpoint(
    tag: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all sandboxes for the current user."""
    sandboxes = await list_sandboxes(user.id, db, tag=tag)
    items = []
    for sb in sandboxes:
        total, unread = await get_sandbox_email_counts(sb.id, db)
        resp = SandboxResponse.model_validate(sb)
        resp.email_count = total
        resp.unread_count = unread
        items.append(resp)
    return SandboxListResponse(data=items, total=len(items))


@router.get("/sandboxes/{sandbox_id}", response_model=SandboxResponse)
async def get_sandbox_endpoint(
    sandbox_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get sandbox details."""
    sandbox = await get_sandbox(sandbox_id, user.id, db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")
    total, unread = await get_sandbox_email_counts(sandbox.id, db)
    resp = SandboxResponse.model_validate(sandbox)
    resp.email_count = total
    resp.unread_count = unread
    return resp


@router.patch("/sandboxes/{sandbox_id}", response_model=SandboxResponse)
async def update_sandbox_endpoint(
    sandbox_id: uuid.UUID,
    body: SandboxUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update sandbox settings."""
    sandbox = await get_sandbox(sandbox_id, user.id, db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    updated = await update_sandbox(
        sandbox,
        name=body.name,
        description=body.description,
        tags=body.tags,
        is_active=body.is_active,
        email_retention_days=body.email_retention_days,
        db=db,
    )
    return SandboxResponse.model_validate(updated)


@router.delete("/sandboxes/{sandbox_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sandbox_endpoint(
    sandbox_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a sandbox and all its emails."""
    deleted = await delete_sandbox(sandbox_id, user.id, db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")


# ── SMTP Credentials ──

@router.get("/sandboxes/{sandbox_id}/credentials", response_model=SandboxCredentialsResponse)
async def get_sandbox_credentials(
    sandbox_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get SMTP credentials for a sandbox."""
    sandbox = await get_sandbox(sandbox_id, user.id, db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    settings = get_settings()
    return SandboxCredentialsResponse(
        smtp_host=settings.smtp_server_hostname,
        smtp_port=settings.smtp_server_port,
        smtp_username=sandbox.smtp_username,
        smtp_password=sandbox.smtp_password,
        email_address=sandbox.email_address,
        connection_url=f"smtp://{sandbox.smtp_username}:{sandbox.smtp_password}@{settings.smtp_server_hostname}:{settings.smtp_server_port}",
    )


@router.post("/sandboxes/{sandbox_id}/credentials/regenerate", response_model=SandboxCredentialsResponse)
async def regenerate_sandbox_credentials(
    sandbox_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate SMTP password for a sandbox."""
    sandbox = await get_sandbox(sandbox_id, user.id, db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    new_password = await regenerate_sandbox_password(sandbox, db)
    settings = get_settings()
    return SandboxCredentialsResponse(
        smtp_host=settings.smtp_server_hostname,
        smtp_port=settings.smtp_server_port,
        smtp_username=sandbox.smtp_username,
        smtp_password=new_password,
        email_address=sandbox.email_address,
        connection_url=f"smtp://{sandbox.smtp_username}:{new_password}@{settings.smtp_server_hostname}:{settings.smtp_server_port}",
    )


# ── Sandbox Emails ──

@router.get("/sandboxes/{sandbox_id}/emails", response_model=SandboxEmailListResponse)
async def list_sandbox_emails_endpoint(
    sandbox_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List emails in a sandbox inbox."""
    sandbox = await get_sandbox(sandbox_id, user.id, db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    emails, total, unread = await list_sandbox_emails(sandbox.id, limit, offset, db, search=search)
    summaries = [
        SandboxEmailSummary(
            id=e.id,
            from_address=e.from_address,
            to_addresses=e.to_addresses,
            subject=e.subject,
            is_read=e.is_read,
            received_at=e.received_at,
            raw_size=e.raw_size,
            has_attachments=bool(e.attachments),
        )
        for e in emails
    ]
    return SandboxEmailListResponse(data=summaries, total=total, unread_count=unread)


@router.get("/sandboxes/{sandbox_id}/emails/{email_id}", response_model=SandboxEmailResponse)
async def get_sandbox_email_detail(
    sandbox_id: uuid.UUID,
    email_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single sandbox email with full content. Auto-marks as read."""
    sandbox = await get_sandbox(sandbox_id, user.id, db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    email_obj = await mark_sandbox_email_read(email_id, sandbox.id, True, db)
    if not email_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")
    return email_obj


@router.patch("/sandboxes/{sandbox_id}/emails/{email_id}")
async def update_sandbox_email_read_status(
    sandbox_id: uuid.UUID,
    email_id: uuid.UUID,
    is_read: bool = True,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a sandbox email as read or unread."""
    sandbox = await get_sandbox(sandbox_id, user.id, db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    email_obj = await mark_sandbox_email_read(email_id, sandbox.id, is_read, db)
    if not email_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")
    return {"ok": True}


@router.delete("/sandboxes/{sandbox_id}/emails/{email_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sandbox_email_endpoint(
    sandbox_id: uuid.UUID,
    email_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single sandbox email."""
    sandbox = await get_sandbox(sandbox_id, user.id, db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    deleted = await delete_sandbox_email(email_id, sandbox.id, db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")


@router.delete("/sandboxes/{sandbox_id}/emails", status_code=status.HTTP_204_NO_CONTENT)
async def clear_sandbox_emails_endpoint(
    sandbox_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear all emails in a sandbox."""
    sandbox = await get_sandbox(sandbox_id, user.id, db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")
    await clear_sandbox_emails(sandbox.id, db)
```

- [ ] **Step 2: Register the sandboxes router**

In `backend/app/api/v1/router.py`, add:

```python
from app.api.v1.sandboxes import router as sandboxes_router
```

And add this line after the existing `include_router` calls:

```python
api_router.include_router(sandboxes_router, tags=["sandboxes"])
```

- [ ] **Step 3: Test the API starts without errors**

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` and verify the sandboxes endpoints appear.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/sandboxes.py backend/app/api/v1/router.py
git commit -m "feat: add sandbox API routes (CRUD, credentials, emails)"
```

---

## Task 5: SMTP Server — Sandbox Auth + Storage

**Files:**
- Modify: `backend/app/services/smtp_server.py`

- [ ] **Step 1: Update the authenticator to check sandboxes**

In `backend/app/services/smtp_server.py`, add the Sandbox import at the top alongside the existing imports:

```python
from app.models.sandbox import Sandbox
from app.models.sandbox_email import SandboxEmail
```

- [ ] **Step 2: Update `HookTrapAuthenticator.__call__`**

Replace the `__call__` method body to add sandbox fallback after the workspace check:

```python
    def __call__(self, server, session, envelope, mechanism, auth_data):
        if not isinstance(auth_data, LoginPassword):
            return AuthResult(success=False, handled=False)

        username = auth_data.login.decode() if isinstance(auth_data.login, bytes) else auth_data.login
        password = auth_data.password.decode() if isinstance(auth_data.password, bytes) else auth_data.password

        try:
            with _get_sync_session() as db:
                # 1. Try workspace lookup first
                workspace = db.execute(
                    select(Workspace).where(Workspace.smtp_username == username)
                ).scalar_one_or_none()

                if workspace and workspace.smtp_password == password:
                    workspace_id = str(workspace.id)
                    session.workspace_id = workspace_id
                    if not hasattr(server, "_auth_map"):
                        server._auth_map = {}
                    peer = session.peer
                    if peer:
                        server._auth_map[f"{peer[0]}:{peer[1]}"] = {"workspace_id": workspace_id}
                    logger.info("SMTP auth successful for workspace: %s (user: %s)", workspace_id, username)
                    return AuthResult(success=True)

                # 2. Try sandbox lookup
                sandbox = db.execute(
                    select(Sandbox).where(Sandbox.smtp_username == username)
                ).scalar_one_or_none()

                if sandbox and sandbox.smtp_password == password and sandbox.is_active:
                    sandbox_id = str(sandbox.id)
                    session.sandbox_id = sandbox_id
                    if not hasattr(server, "_auth_map"):
                        server._auth_map = {}
                    peer = session.peer
                    if peer:
                        server._auth_map[f"{peer[0]}:{peer[1]}"] = {"sandbox_id": sandbox_id}
                    logger.info("SMTP auth successful for sandbox: %s (user: %s)", sandbox_id, username)
                    return AuthResult(success=True)

        except Exception as e:
            logger.exception("SMTP auth DB error: %s", e)

        logger.warning("SMTP auth failed for user: %s", username)
        return AuthResult(success=False, handled=False)
```

- [ ] **Step 3: Extract shared email parsing helper**

Add this function before the `HookTrapSMTPHandler` class:

```python
def _parse_email_content(envelope):
    """Parse raw email data into structured fields. Returns a dict."""
    raw_data = envelope.content
    if isinstance(raw_data, bytes):
        raw_str = raw_data.decode("utf-8", errors="replace")
    else:
        raw_str = raw_data

    msg = email.message_from_string(raw_str, policy=email.policy.default)

    from_addr = str(msg.get("From", envelope.mail_from or ""))
    to_addrs = [str(a).strip() for a in (msg.get("To", "") or "").split(",") if a.strip()]
    if not to_addrs:
        to_addrs = list(envelope.rcpt_tos)
    cc_addrs = [str(a).strip() for a in (msg.get("Cc", "") or "").split(",") if a.strip()]
    bcc_addrs = [str(a).strip() for a in (msg.get("Bcc", "") or "").split(",") if a.strip()]
    subject = str(msg.get("Subject", ""))
    message_id = str(msg.get("Message-ID", ""))

    text_body = None
    html_body = None
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain" and text_body is None:
                text_body = part.get_content()
            elif ct == "text/html" and html_body is None:
                html_body = part.get_content()
    else:
        ct = msg.get_content_type()
        content = msg.get_content()
        if ct == "text/html":
            html_body = content
        else:
            text_body = content

    headers = {k: str(v) for k, v in msg.items()}

    attachments = []
    if msg.is_multipart():
        for part in msg.iter_attachments():
            filename = part.get_filename() or "untitled"
            content_type = part.get_content_type()
            payload = part.get_payload(decode=True) or b""
            if len(payload) > 10 * 1024 * 1024:
                payload = payload[:10 * 1024 * 1024]
            attachments.append({
                "filename": filename,
                "content_type": content_type,
                "size": len(payload),
                "content_base64": base64.b64encode(payload).decode("ascii"),
            })

    return {
        "message_id": message_id or None,
        "from_address": from_addr,
        "to_addresses": to_addrs,
        "cc_addresses": cc_addrs,
        "bcc_addresses": bcc_addrs,
        "subject": subject or None,
        "text_body": text_body,
        "html_body": html_body,
        "headers": headers,
        "attachments": attachments,
        "raw_size": len(raw_str),
    }
```

- [ ] **Step 4: Update `handle_DATA` to support sandboxes**

Replace the `handle_DATA` method:

```python
    async def handle_DATA(self, server, session, envelope):
        # Resolve auth identity: workspace or sandbox
        workspace_id = getattr(session, "workspace_id", None)
        sandbox_id = getattr(session, "sandbox_id", None)

        # Fallback to peer-based auth map
        if not workspace_id and not sandbox_id:
            auth_map = getattr(server, "_auth_map", {})
            peer = getattr(session, "peer", None)
            if peer:
                auth_info = auth_map.pop(f"{peer[0]}:{peer[1]}", {})
                workspace_id = auth_info.get("workspace_id")
                sandbox_id = auth_info.get("sandbox_id")

        if not workspace_id and not sandbox_id:
            return "550 Authentication required"

        try:
            parsed = _parse_email_content(envelope)

            with _get_sync_session() as db:
                if workspace_id:
                    record = InboxEmail(workspace_id=workspace_id, **parsed)
                    db.add(record)
                    db.commit()
                    logger.info(
                        "Captured email for workspace %s: %s -> %s (%s)",
                        workspace_id, parsed["from_address"], parsed["to_addresses"], parsed["subject"],
                    )
                elif sandbox_id:
                    record = SandboxEmail(sandbox_id=sandbox_id, **parsed)
                    db.add(record)
                    db.commit()
                    logger.info(
                        "Captured email for sandbox %s: %s -> %s (%s)",
                        sandbox_id, parsed["from_address"], parsed["to_addresses"], parsed["subject"],
                    )

            return "250 Message accepted for delivery"

        except Exception as e:
            logger.exception("Failed to process incoming email: %s", e)
            return "451 Temporary error processing message"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/smtp_server.py
git commit -m "feat: SMTP server authenticates sandboxes and routes emails to sandbox_emails table"
```

---

## Task 6: Frontend Types

**Files:**
- Create: `frontend/src/types/sandbox.ts`

- [ ] **Step 1: Create TypeScript types**

Create `frontend/src/types/sandbox.ts`:

```typescript
export interface Sandbox {
  id: string;
  user_id: string;
  name: string;
  email_prefix: string;
  email_address: string;
  description: string | null;
  tags: string[];
  is_active: boolean;
  email_retention_days: number | null;
  created_at: string;
  updated_at: string;
  email_count: number;
  unread_count: number;
}

export interface SandboxListResponse {
  data: Sandbox[];
  total: number;
}

export interface SandboxCredentials {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  email_address: string;
  connection_url: string;
}

export interface SandboxEmailSummary {
  id: string;
  from_address: string;
  to_addresses: string[];
  subject: string | null;
  is_read: boolean;
  received_at: string;
  raw_size: number;
  has_attachments: boolean;
}

export interface SandboxEmail {
  id: string;
  sandbox_id: string;
  message_id: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  headers: Record<string, string>;
  attachments: { filename: string; content_type: string; size: number; content_base64?: string }[];
  raw_size: number;
  is_read: boolean;
  received_at: string;
}

export interface SandboxEmailListResponse {
  data: SandboxEmailSummary[];
  total: number;
  unread_count: number;
}

export interface PrefixCheckResponse {
  available: boolean;
  suggestion: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/sandbox.ts
git commit -m "feat: add TypeScript types for sandbox feature"
```

---

## Task 7: Sidebar Navigation

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Sandboxes link to the sidebar**

In `frontend/src/components/layout/Sidebar.tsx`, add a "Sandboxes" link inside the `<nav className="space-y-1">` block, after the "Captures" link and before the "Settings" link. Use the envelope icon:

```tsx
          {/* Sandboxes */}
          <Link
            href="/dashboard/sandboxes"
            onClick={() => onClose?.()}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[15px] transition-colors relative",
              pathname.startsWith("/dashboard/sandboxes")
                ? "bg-white/10 text-white font-medium"
                : "hover:bg-white/10 text-slate-300"
            )}
          >
            {pathname.startsWith("/dashboard/sandboxes") && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-indigo-400" />
            )}
            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Sandboxes
          </Link>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add Sandboxes link to dashboard sidebar"
```

---

## Task 8: Sandbox List Page

**Files:**
- Create: `frontend/src/app/dashboard/sandboxes/page.tsx`

- [ ] **Step 1: Create the sandbox list page**

Create `frontend/src/app/dashboard/sandboxes/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Sandbox } from "@/types/sandbox";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SandboxListPage() {
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const url = tagFilter
      ? `/api/v1/sandboxes?tag=${encodeURIComponent(tagFilter)}`
      : "/api/v1/sandboxes";
    api.get(url)
      .then((data) => setSandboxes(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tagFilter]);

  const allTags = [...new Set(sandboxes.flatMap((s) => s.tags))].sort();

  const copyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleActive = async (sandbox: Sandbox) => {
    try {
      await api.patch(`/api/v1/sandboxes/${sandbox.id}`, { is_active: !sandbox.is_active });
      setSandboxes((prev) =>
        prev.map((s) => (s.id === sandbox.id ? { ...s, is_active: !s.is_active } : s))
      );
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sandbox Inboxes</h1>
          <p className="text-slate-500 mt-1">Isolated email inboxes for testing. Each sandbox gets its own SMTP credentials.</p>
        </div>
        <Link
          href="/dashboard/sandboxes/new"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Sandbox
        </Link>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-slate-500">Filter:</span>
          <button
            onClick={() => setTagFilter("")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !tagFilter ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                tagFilter === tag ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Sandbox grid */}
      {sandboxes.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl">
          <svg className="w-12 h-12 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No sandboxes yet</h3>
          <p className="text-slate-500 mb-6">Create your first sandbox inbox to start capturing test emails.</p>
          <Link
            href="/dashboard/sandboxes/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Create Sandbox
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sandboxes.map((sb) => (
            <Link
              key={sb.id}
              href={`/dashboard/sandboxes/${sb.id}`}
              className="block border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                    {sb.name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      sb.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {sb.is_active ? "Active" : "Paused"}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleActive(sb);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  title={sb.is_active ? "Pause inbox" : "Activate inbox"}
                >
                  {sb.is_active ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Email address */}
              <div className="flex items-center gap-2 mb-3">
                <code className="text-xs text-slate-500 font-mono truncate flex-1">{sb.email_address}</code>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    copyEmail(sb.email_address, sb.id);
                  }}
                  className="text-slate-400 hover:text-indigo-600 flex-shrink-0"
                >
                  {copied === sb.id ? (
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Tags */}
              {sb.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {sb.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{sb.email_count} email{sb.email_count !== 1 ? "s" : ""}</span>
                {sb.unread_count > 0 && (
                  <span className="text-indigo-600 font-medium">{sb.unread_count} unread</span>
                )}
                <span className="ml-auto">{timeAgo(sb.updated_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/dashboard/sandboxes/page.tsx
git commit -m "feat: add sandbox list page with tag filtering and quick actions"
```

---

## Task 9: Create Sandbox Page

**Files:**
- Create: `frontend/src/app/dashboard/sandboxes/new/page.tsx`

- [ ] **Step 1: Create the new sandbox form page**

Create `frontend/src/app/dashboard/sandboxes/new/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { PrefixCheckResponse } from "@/types/sandbox";

export default function NewSandboxPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [retentionDays, setRetentionDays] = useState<string>("");
  const [prefixStatus, setPrefixStatus] = useState<PrefixCheckResponse | null>(null);
  const [checkingPrefix, setCheckingPrefix] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced prefix check
  useEffect(() => {
    if (prefix.length < 3) {
      setPrefixStatus(null);
      return;
    }
    setCheckingPrefix(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.get(`/api/v1/sandboxes/check-prefix/${prefix}`);
        setPrefixStatus(data);
      } catch {
        setPrefixStatus(null);
      } finally {
        setCheckingPrefix(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [prefix]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        email_prefix: prefix.trim().toLowerCase(),
      };
      if (description.trim()) body.description = description.trim();
      if (tags.trim()) body.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (retentionDays) body.email_retention_days = parseInt(retentionDays, 10);

      const sandbox = await api.post("/api/v1/sandboxes", body);
      router.push(`/dashboard/sandboxes/${sandbox.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create sandbox";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Create Sandbox</h1>
      <p className="text-slate-500 mb-8">Set up a new isolated email inbox for testing.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Staging QA"
            required
            maxLength={100}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
        </div>

        {/* Email Prefix */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Prefix</label>
          <div className="flex items-center gap-0">
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="myapp-staging"
              required
              maxLength={50}
              className="flex-1 rounded-l-lg border border-r-0 border-slate-300 px-4 py-2.5 text-sm font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            />
            <span className="bg-slate-100 border border-slate-300 text-slate-500 text-sm px-3 py-2.5 rounded-r-lg font-mono">
              @inbox.hooktrap.dev
            </span>
          </div>
          {/* Status indicator */}
          {prefix.length >= 3 && (
            <div className="mt-1.5 text-xs">
              {checkingPrefix ? (
                <span className="text-slate-400">Checking availability...</span>
              ) : prefixStatus?.available ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Available
                </span>
              ) : (
                <span className="text-red-600">
                  Taken{prefixStatus?.suggestion && ` — try "${prefixStatus.suggestion}"`}
                </span>
              )}
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1">3-50 chars, lowercase letters, numbers, hyphens. Must start with a letter.</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Description <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this sandbox for?"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Tags <span className="text-slate-400 font-normal">(comma-separated, optional)</span>
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="staging, qa, notifications"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
        </div>

        {/* Retention */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Email Retention <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          >
            <option value="">Keep forever</option>
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || !name.trim() || !prefix.trim() || prefix.length < 3 || (prefixStatus !== null && !prefixStatus.available)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating..." : "Create Sandbox"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/dashboard/sandboxes/new/page.tsx
git commit -m "feat: add create sandbox form with live prefix availability check"
```

---

## Task 10: Sandbox Inbox Page

**Files:**
- Create: `frontend/src/app/dashboard/sandboxes/[id]/page.tsx`

- [ ] **Step 1: Create the sandbox inbox page**

This page reuses the same inbox UI pattern as the workspace inbox. Create `frontend/src/app/dashboard/sandboxes/[id]/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type {
  Sandbox,
  SandboxCredentials,
  SandboxEmailSummary,
  SandboxEmail,
} from "@/types/sandbox";

/* ─── helpers ─── */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extractName(addr: string) {
  const match = addr.match(/^(.+?)\s*<.*>$/);
  return match ? match[1].trim().replace(/^"|"$/g, "") : addr.split("@")[0];
}

/* ─── SMTP Credentials Banner ─── */
function SmtpBanner({ sandboxId }: { sandboxId: string }) {
  const [creds, setCreds] = useState<SandboxCredentials | null>(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchCreds = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/api/v1/sandboxes/${sandboxId}/credentials`);
      setCreds(data);
      setShown(true);
    } catch {} finally {
      setLoading(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (shown && creds) {
    return (
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 text-sm">SMTP Configuration</h3>
          <button onClick={() => setShown(false)} className="text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Host", value: creds.smtp_host },
            { label: "Port", value: String(creds.smtp_port) },
            { label: "Username", value: creds.smtp_username },
            { label: "Password", value: creds.smtp_password },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
              <span className="text-xs font-medium text-slate-400 uppercase w-16 flex-shrink-0">{item.label}</span>
              <code className="text-sm text-slate-700 font-mono flex-1 truncate">{item.value}</code>
              <button onClick={() => copy(item.value, item.label)} className="text-slate-400 hover:text-indigo-600 flex-shrink-0">
                {copied === item.label ? (
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <code className="text-xs text-slate-500 font-mono flex-1 truncate">Email: {creds.email_address}</code>
          <button onClick={() => copy(creds.email_address, "email")} className="text-slate-400 hover:text-indigo-600">
            {copied === "email" ? (
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={fetchCreds} disabled={loading} className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium mb-4">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
      </svg>
      {loading ? "Loading..." : "Show SMTP Credentials"}
    </button>
  );
}

/* ─── Main Sandbox Inbox Page ─── */
export default function SandboxInboxPage() {
  const params = useParams();
  const router = useRouter();
  const sandboxId = params.id as string;

  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [emails, setEmails] = useState<SandboxEmailSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<SandboxEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"html" | "text" | "headers">("html");

  const fetchSandbox = useCallback(async () => {
    try {
      const data = await api.get(`/api/v1/sandboxes/${sandboxId}`);
      setSandbox(data);
    } catch {
      router.push("/dashboard/sandboxes");
    }
  }, [sandboxId, router]);

  const fetchEmails = useCallback(async () => {
    try {
      const data = await api.get(`/api/v1/sandboxes/${sandboxId}/emails`);
      setEmails(data.data || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unread_count || 0);
    } catch {} finally {
      setLoading(false);
    }
  }, [sandboxId]);

  useEffect(() => {
    fetchSandbox();
    fetchEmails();
    const interval = setInterval(fetchEmails, 5000);
    return () => clearInterval(interval);
  }, [fetchSandbox, fetchEmails]);

  const selectEmail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const data = await api.get(`/api/v1/sandboxes/${sandboxId}/emails/${id}`);
      setSelectedEmail(data);
      setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
      setActiveTab(data.html_body ? "html" : "text");
    } catch {} finally {
      setDetailLoading(false);
    }
  };

  const deleteEmail = async (id: string) => {
    await api.delete(`/api/v1/sandboxes/${sandboxId}/emails/${id}`);
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) { setSelectedId(null); setSelectedEmail(null); }
  };

  const clearAll = async () => {
    if (!confirm("Delete all emails in this sandbox?")) return;
    await api.delete(`/api/v1/sandboxes/${sandboxId}/emails`);
    setEmails([]);
    setSelectedId(null);
    setSelectedEmail(null);
    setTotal(0);
    setUnreadCount(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/dashboard/sandboxes")} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-slate-900">{sandbox?.name || "Sandbox"}</h1>
            {sandbox?.is_active ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">Active</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500">Paused</span>
            )}
          </div>
          <p className="text-sm text-slate-500 ml-8">{sandbox?.email_address}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{total} emails, {unreadCount} unread</span>
          {emails.length > 0 && (
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 font-medium ml-2">
              Clear All
            </button>
          )}
        </div>
      </div>

      <SmtpBanner sandboxId={sandboxId} />

      {/* Inbox layout */}
      {emails.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <svg className="w-12 h-12 mx-auto text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">Inbox is empty</h3>
          <p className="text-slate-500">Send an email to this sandbox to see it here. Emails are polled every 5 seconds.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 min-h-[600px]">
          {/* Email list */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
              {emails.map((e) => (
                <button
                  key={e.id}
                  onClick={() => selectEmail(e.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                    selectedId === e.id ? "bg-indigo-50 border-l-2 border-indigo-500" : ""
                  } ${!e.is_read ? "bg-white" : "bg-slate-50/50"}`}
                >
                  <div className="flex items-center gap-2">
                    {!e.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />}
                    <span className={`text-sm truncate ${!e.is_read ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                      {extractName(e.from_address)}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">{timeAgo(e.received_at)}</span>
                  </div>
                  <p className={`text-sm truncate mt-0.5 ${!e.is_read ? "text-slate-800" : "text-slate-500"}`}>
                    {e.subject || "(no subject)"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-400 truncate">{e.to_addresses[0]}</span>
                    {e.has_attachments && (
                      <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                      </svg>
                    )}
                    <span className="text-[11px] text-slate-400 ml-auto">{formatSize(e.raw_size)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Email detail */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {!selectedEmail ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Select an email to view
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Email header */}
                <div className="px-5 py-4 border-b border-slate-200 bg-white">
                  <div className="flex items-start justify-between">
                    <h2 className="font-semibold text-slate-900 text-lg">{selectedEmail.subject || "(no subject)"}</h2>
                    <button onClick={() => deleteEmail(selectedEmail.id)} className="text-slate-400 hover:text-red-500 p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    From: {selectedEmail.from_address}
                  </div>
                  <div className="text-sm text-slate-500">
                    To: {selectedEmail.to_addresses.join(", ")}
                  </div>
                  {selectedEmail.cc_addresses.length > 0 && (
                    <div className="text-sm text-slate-500">CC: {selectedEmail.cc_addresses.join(", ")}</div>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50 px-5">
                  {(["html", "text", "headers"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === tab
                          ? "border-indigo-500 text-indigo-700"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {tab === "html" ? "HTML Preview" : tab === "text" ? "Plain Text" : "Headers"}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-auto">
                  {activeTab === "html" && selectedEmail.html_body ? (
                    <iframe
                      srcDoc={selectedEmail.html_body}
                      className="w-full h-full min-h-[400px] border-0"
                      sandbox="allow-same-origin"
                      title="Email HTML Preview"
                    />
                  ) : activeTab === "html" && !selectedEmail.html_body ? (
                    <div className="p-5 text-sm text-slate-500">No HTML content</div>
                  ) : activeTab === "text" ? (
                    <pre className="p-5 text-sm text-slate-700 whitespace-pre-wrap font-mono">
                      {selectedEmail.text_body || "No plain text content"}
                    </pre>
                  ) : (
                    <div className="p-5">
                      <table className="w-full text-sm">
                        <tbody>
                          {Object.entries(selectedEmail.headers).map(([key, val]) => (
                            <tr key={key} className="border-b border-slate-100">
                              <td className="py-1.5 pr-4 font-medium text-slate-600 whitespace-nowrap align-top">{key}</td>
                              <td className="py-1.5 text-slate-500 break-all font-mono text-xs">{val}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/dashboard/sandboxes/[id]/page.tsx
git commit -m "feat: add sandbox inbox page with email list, detail view, and SMTP credentials"
```

---

## Task 11: Integration Test

- [ ] **Step 1: Verify backend starts cleanly**

```bash
cd backend
python -m uvicorn app.main:app --port 8000
```

Check `http://localhost:8000/docs` — all sandbox endpoints should appear.

- [ ] **Step 2: Verify frontend builds**

```bash
cd frontend
npm run build
```

Expected: no build errors.

- [ ] **Step 3: End-to-end manual test**

1. Log in and navigate to `/dashboard/sandboxes`
2. Click "Create Sandbox", enter name "My Test Sandbox", prefix "my-test", submit
3. On the sandbox inbox page, click "Show SMTP Credentials"
4. Copy the credentials and send a test email using the Python test script (update credentials):

```bash
cd backend
python test_smtp.py  # (update credentials to sandbox SMTP creds)
```

5. Verify the email appears in the sandbox inbox within 5 seconds
6. Verify HTML Preview, Plain Text, and Headers tabs work

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete sandbox inboxes feature — models, API, SMTP routing, and frontend"
```

---

## Summary of all files

| Action | Path |
|--------|------|
| Create | `backend/app/models/sandbox.py` |
| Create | `backend/app/models/sandbox_email.py` |
| Create | `backend/app/schemas/sandbox.py` |
| Create | `backend/app/services/sandbox_service.py` |
| Create | `backend/app/api/v1/sandboxes.py` |
| Create | `frontend/src/types/sandbox.ts` |
| Create | `frontend/src/app/dashboard/sandboxes/page.tsx` |
| Create | `frontend/src/app/dashboard/sandboxes/new/page.tsx` |
| Create | `frontend/src/app/dashboard/sandboxes/[id]/page.tsx` |
| Modify | `backend/app/models/__init__.py` |
| Modify | `backend/app/models/user.py` |
| Modify | `backend/app/api/v1/router.py` |
| Modify | `backend/app/services/smtp_server.py` |
| Modify | `frontend/src/components/layout/Sidebar.tsx` |
| Generate | `backend/alembic/versions/xxxx_add_sandboxes.py` |
