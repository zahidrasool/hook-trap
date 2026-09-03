"""Current-month usage against plan quotas.

Counts are derived from the rows already written by the capture, mock and inbox
paths rather than from separate counters. That keeps the numbers honest — they
cannot drift from reality — at the cost of a few aggregate queries, which is a
fine trade at this scale. If these ever get slow, the fix is a rollup table
updated on write, not a cache in front of this.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.endpoint import Endpoint
from app.models.inbox_email import InboxEmail
from app.models.mock_request_log import MockRequestLog
from app.models.sandbox import Sandbox
from app.models.sandbox_email import SandboxEmail
from app.models.webhook import WebhookCapture
from app.models.workspace import Workspace, WorkspaceMember
from app.services.billing_service import PLANS


def current_period() -> tuple[datetime, datetime]:
    """Start of this calendar month (UTC) and the start of the next one."""
    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


async def _workspace_ids(user_id: uuid.UUID, db: AsyncSession) -> list[uuid.UUID]:
    result = await db.execute(
        select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user_id)
    )
    return [row[0] for row in result.all()]


async def get_usage(user, db: AsyncSession) -> dict:
    """Usage and limits for one user, across every workspace they belong to."""
    start, end = current_period()
    plan_key = (user.plan or "free").lower()
    plan = PLANS.get(plan_key, PLANS["free"])
    quotas = plan["quotas"]
    limits = plan["limits"]

    ws_ids = await _workspace_ids(user.id, db)

    async def count(stmt) -> int:
        return (await db.execute(stmt)).scalar() or 0

    if ws_ids:
        mock_requests = await count(
            select(func.count(MockRequestLog.id)).where(
                MockRequestLog.workspace_id.in_(ws_ids),
                MockRequestLog.received_at >= start,
                MockRequestLog.received_at < end,
            )
        )
        workspace_emails = await count(
            select(func.count(InboxEmail.id)).where(
                InboxEmail.workspace_id.in_(ws_ids),
                InboxEmail.received_at >= start,
                InboxEmail.received_at < end,
            )
        )
    else:
        mock_requests = workspace_emails = 0

    # Captures and sandboxes hang off the user directly rather than a workspace.
    captures = await count(
        select(func.count(WebhookCapture.id))
        .join(Endpoint, Endpoint.id == WebhookCapture.endpoint_id)
        .where(
            Endpoint.user_id == user.id,
            WebhookCapture.captured_at >= start,
            WebhookCapture.captured_at < end,
        )
    )
    sandbox_emails = await count(
        select(func.count(SandboxEmail.id))
        .join(Sandbox, Sandbox.id == SandboxEmail.sandbox_id)
        .where(
            Sandbox.user_id == user.id,
            SandboxEmail.received_at >= start,
            SandboxEmail.received_at < end,
        )
    )

    # Point-in-time counts, for the ceilings rather than the monthly quotas.
    workspace_count = len(ws_ids)
    sandbox_count = await count(
        select(func.count(Sandbox.id)).where(Sandbox.user_id == user.id)
    )

    def meter(used: int, allowed: int) -> dict:
        return {
            "used": used,
            "limit": allowed,
            # Clamped so a user over quota shows a full bar rather than
            # overflowing the layout.
            "percent": min(100, round((used / allowed) * 100, 1)) if allowed else 0,
            "exceeded": used >= allowed,
        }

    return {
        "plan": plan_key,
        "plan_name": plan["name"],
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "quotas": {
            "mock_requests": meter(mock_requests, quotas["mock_requests"]),
            "webhook_captures": meter(captures, quotas["webhook_captures"]),
            "emails": meter(workspace_emails + sandbox_emails, quotas["emails"]),
        },
        "limits": {
            "workspaces": meter(workspace_count, limits["workspaces"]),
            "sandboxes": meter(sandbox_count, limits["sandboxes"]),
        },
    }
