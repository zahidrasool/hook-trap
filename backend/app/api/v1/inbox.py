import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.db.database import get_db
from app.models.user import User
from app.schemas.inbox import (
    InboxEmailResponse,
    InboxEmailSummary,
    InboxEmailSummaryListResponse,
    SmtpCredentialsResponse,
)
from app.services.inbox_service import (
    get_inbox_emails,
    get_inbox_email,
    mark_as_read,
    delete_inbox_email,
    clear_inbox,
    generate_smtp_credentials,
    regenerate_smtp_password,
)
from app.services.workspace_service import (
    get_workspace_by_short_id,
    check_workspace_access,
)

router = APIRouter()


async def _get_workspace_and_check(short_id: str, user: User, db: AsyncSession, min_role: str = "viewer"):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    role_hierarchy = {"viewer": 0, "editor": 1, "admin": 2, "owner": 3}
    if role_hierarchy.get(member.role, 0) < role_hierarchy.get(min_role, 0):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires {min_role} role or above")

    return workspace, member


@router.get(
    "/workspaces/{short_id}/inbox/smtp-credentials",
    response_model=SmtpCredentialsResponse,
)
async def get_smtp_credentials(
    short_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get SMTP credentials for this workspace. Auto-generates on first call."""
    workspace, _ = await _get_workspace_and_check(short_id, user, db, min_role="admin")

    username, password = await generate_smtp_credentials(workspace, db)
    settings = get_settings()

    return SmtpCredentialsResponse(
        smtp_host=settings.smtp_server_hostname,
        smtp_port=settings.smtp_server_port,
        smtp_username=username,
        smtp_password=password,
        connection_url=f"smtp://{username}:{password}@{settings.smtp_server_hostname}:{settings.smtp_server_port}",
    )


@router.post(
    "/workspaces/{short_id}/inbox/smtp-credentials/regenerate",
    response_model=SmtpCredentialsResponse,
)
async def regenerate_smtp_credentials(
    short_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate SMTP password. Requires admin role."""
    workspace, _ = await _get_workspace_and_check(short_id, user, db, min_role="admin")

    username, password = await regenerate_smtp_password(workspace, db)
    settings = get_settings()

    return SmtpCredentialsResponse(
        smtp_host=settings.smtp_server_hostname,
        smtp_port=settings.smtp_server_port,
        smtp_username=username,
        smtp_password=password,
        connection_url=f"smtp://{username}:{password}@{settings.smtp_server_hostname}:{settings.smtp_server_port}",
    )


@router.get(
    "/workspaces/{short_id}/inbox",
    response_model=InboxEmailSummaryListResponse,
)
async def list_inbox_emails(
    short_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all emails in the workspace inbox."""
    workspace, _ = await _get_workspace_and_check(short_id, user, db)

    emails, total, unread_count = await get_inbox_emails(workspace.id, limit, offset, db)

    summaries = [
        InboxEmailSummary(
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

    return InboxEmailSummaryListResponse(data=summaries, total=total, unread_count=unread_count)


@router.get(
    "/workspaces/{short_id}/inbox/{email_id}",
    response_model=InboxEmailResponse,
)
async def get_inbox_email_detail(
    short_id: str,
    email_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single email with full body and attachments. Auto-marks as read."""
    workspace, _ = await _get_workspace_and_check(short_id, user, db)

    email_obj = await mark_as_read(email_id, workspace.id, db)
    if not email_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    return email_obj


@router.patch(
    "/workspaces/{short_id}/inbox/{email_id}/read",
    response_model=InboxEmailResponse,
)
async def mark_email_as_read(
    short_id: str,
    email_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single email as read."""
    workspace, _ = await _get_workspace_and_check(short_id, user, db)

    email_obj = await mark_as_read(email_id, workspace.id, db)
    if not email_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")

    return email_obj


@router.delete(
    "/workspaces/{short_id}/inbox/{email_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_single_email(
    short_id: str,
    email_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single email from the inbox."""
    workspace, _ = await _get_workspace_and_check(short_id, user, db, min_role="editor")

    deleted = await delete_inbox_email(email_id, workspace.id, db)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Email not found")


@router.delete(
    "/workspaces/{short_id}/inbox",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def clear_all_inbox_emails(
    short_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear all emails in the workspace inbox. Requires admin role."""
    workspace, _ = await _get_workspace_and_check(short_id, user, db, min_role="admin")
    await clear_inbox(workspace.id, db)
