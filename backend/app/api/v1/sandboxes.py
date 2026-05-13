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


# CRITICAL: check-prefix route MUST come before any {sandbox_id} routes
@router.get("/sandboxes/check-prefix/{prefix}", response_model=PrefixCheckResponse)
async def check_prefix_endpoint(
    prefix: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if an email prefix is available."""
    available = await check_prefix_available(prefix, db)
    suggestion = None
    if not available:
        suggestion = await suggest_prefix(prefix, db)
    return PrefixCheckResponse(available=available, suggestion=suggestion)


@router.post("/sandboxes", response_model=SandboxResponse, status_code=status.HTTP_201_CREATED)
async def create_sandbox_endpoint(
    body: SandboxCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new sandbox."""
    available = await check_prefix_available(body.email_prefix, db)
    if not available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Prefix '{body.email_prefix}' is already taken",
        )

    sandbox = await create_sandbox(
        user_id=current_user.id,
        name=body.name,
        email_prefix=body.email_prefix,
        description=body.description,
        tags=body.tags,
        email_retention_days=body.email_retention_days,
        db=db,
    )
    return SandboxResponse(
        **sandbox.__dict__,
        email_count=0,
        unread_count=0,
    )


@router.get("/sandboxes", response_model=SandboxListResponse)
async def list_sandboxes_endpoint(
    tag: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all sandboxes for the current user, with optional tag filter."""
    sandboxes = await list_sandboxes(user_id=current_user.id, db=db, tag=tag)

    items = []
    for sandbox in sandboxes:
        email_count, unread_count = await get_sandbox_email_counts(sandbox.id, db)
        items.append(
            SandboxResponse(
                **sandbox.__dict__,
                email_count=email_count,
                unread_count=unread_count,
            )
        )

    return SandboxListResponse(data=items, total=len(items))


@router.get("/sandboxes/{sandbox_id}", response_model=SandboxResponse)
async def get_sandbox_endpoint(
    sandbox_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details for a specific sandbox."""
    sandbox = await get_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    email_count, unread_count = await get_sandbox_email_counts(sandbox.id, db)
    return SandboxResponse(
        **sandbox.__dict__,
        email_count=email_count,
        unread_count=unread_count,
    )


@router.patch("/sandboxes/{sandbox_id}", response_model=SandboxResponse)
async def update_sandbox_endpoint(
    sandbox_id: uuid.UUID,
    body: SandboxUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a sandbox's metadata."""
    sandbox = await get_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    sandbox = await update_sandbox(
        sandbox=sandbox,
        name=body.name,
        description=body.description,
        tags=body.tags,
        is_active=body.is_active,
        email_retention_days=body.email_retention_days,
        db=db,
    )
    email_count, unread_count = await get_sandbox_email_counts(sandbox.id, db)
    return SandboxResponse(
        **sandbox.__dict__,
        email_count=email_count,
        unread_count=unread_count,
    )


@router.delete("/sandboxes/{sandbox_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sandbox_endpoint(
    sandbox_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a sandbox and all its emails."""
    deleted = await delete_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")


@router.get("/sandboxes/{sandbox_id}/credentials", response_model=SandboxCredentialsResponse)
async def get_sandbox_credentials(
    sandbox_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get SMTP credentials for a sandbox."""
    sandbox = await get_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    settings = get_settings()
    return SandboxCredentialsResponse(
        smtp_host=settings.smtp_server_hostname,
        smtp_port=settings.smtp_server_port,
        smtp_username=sandbox.smtp_username,
        smtp_password=sandbox.smtp_password,
        email_address=sandbox.email_address,
        connection_url=(
            f"smtp://{sandbox.smtp_username}:{sandbox.smtp_password}"
            f"@{settings.smtp_server_hostname}:{settings.smtp_server_port}"
        ),
    )


@router.post("/sandboxes/{sandbox_id}/credentials/regenerate", response_model=SandboxCredentialsResponse)
async def regenerate_sandbox_credentials(
    sandbox_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate the SMTP password for a sandbox."""
    sandbox = await get_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    new_password = await regenerate_sandbox_password(sandbox=sandbox, db=db)
    settings = get_settings()
    return SandboxCredentialsResponse(
        smtp_host=settings.smtp_server_hostname,
        smtp_port=settings.smtp_server_port,
        smtp_username=sandbox.smtp_username,
        smtp_password=new_password,
        email_address=sandbox.email_address,
        connection_url=(
            f"smtp://{sandbox.smtp_username}:{new_password}"
            f"@{settings.smtp_server_hostname}:{settings.smtp_server_port}"
        ),
    )


@router.get("/sandboxes/{sandbox_id}/emails", response_model=SandboxEmailListResponse)
async def list_sandbox_emails_endpoint(
    sandbox_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List emails in a sandbox, paginated with optional search."""
    sandbox = await get_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    emails, total, unread_count = await list_sandbox_emails(
        sandbox_id=sandbox.id, limit=limit, offset=offset, db=db, search=search
    )

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

    return SandboxEmailListResponse(data=summaries, total=total, unread_count=unread_count)


@router.get("/sandboxes/{sandbox_id}/emails/{email_id}", response_model=SandboxEmailResponse)
async def get_sandbox_email_detail(
    sandbox_id: uuid.UUID,
    email_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single email with full body. Auto-marks as read."""
    sandbox = await get_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    email_obj = await mark_sandbox_email_read(email_id, sandbox.id, True, db)
    if not email_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    return email_obj


@router.patch("/sandboxes/{sandbox_id}/emails/{email_id}", response_model=SandboxEmailResponse)
async def mark_sandbox_email_read_endpoint(
    sandbox_id: uuid.UUID,
    email_id: uuid.UUID,
    is_read: bool = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a sandbox email as read or unread."""
    sandbox = await get_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    email_obj = await mark_sandbox_email_read(email_id, sandbox.id, is_read, db)
    if not email_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    return email_obj


@router.delete("/sandboxes/{sandbox_id}/emails/{email_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sandbox_email_endpoint(
    sandbox_id: uuid.UUID,
    email_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single email from a sandbox."""
    sandbox = await get_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    deleted = await delete_sandbox_email(email_id=email_id, sandbox_id=sandbox.id, db=db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")


@router.delete("/sandboxes/{sandbox_id}/emails", status_code=status.HTTP_204_NO_CONTENT)
async def clear_sandbox_emails_endpoint(
    sandbox_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear all emails from a sandbox."""
    sandbox = await get_sandbox(sandbox_id=sandbox_id, user_id=current_user.id, db=db)
    if not sandbox:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sandbox not found")

    await clear_sandbox_emails(sandbox_id=sandbox.id, db=db)
