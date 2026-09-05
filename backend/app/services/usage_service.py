"""Current-month usage against plan quotas.

Counts are derived from the rows already written by the capture, mock and inbox
paths rather than from separate counters. That keeps the numbers honest — they
cannot drift from reality — at the cost of a few aggregate queries, which is a
fine trade at this scale. If these ever get slow, the fix is a rollup table
updated on write, not a cache in front of this.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.endpoint import Endpoint
from app.models.inbox_email import InboxEmail
from app.models.mock_request_log import MockRequestLog
from app.models.sandbox import Sandbox
from app.models.sandbox_email import SandboxEmail
from app.models.scenario import ScenarioRun
from app.models.webhook import WebhookCapture
from app.models.workspace import Workspace, WorkspaceMember
from app.services.billing_service import PLANS

logger = logging.getLogger(__name__)


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
        scenario_runs = await count(
            select(func.count(ScenarioRun.id)).where(
                ScenarioRun.workspace_id.in_(ws_ids),
                ScenarioRun.created_at >= start,
                ScenarioRun.created_at < end,
            )
        )
    else:
        mock_requests = workspace_emails = scenario_runs = 0

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
            "scenario_runs": meter(scenario_runs, quotas["scenario_runs"]),
        },
        "limits": {
            "workspaces": meter(workspace_count, limits["workspaces"]),
            "sandboxes": meter(sandbox_count, limits["sandboxes"]),
        },
    }


# ── Enforcement ──────────────────────────────────────────────────────────────
#
# Counting rows per request would put an aggregate query in the hot path of
# every mock call, so the live counter lives in Redis and is seeded from the
# database the first time it is touched in a period. The seed keeps the counter
# honest across a Redis restart or eviction mid-month.
#
# When Redis is unavailable this allows the request. A cache outage must not
# read as "quota exhausted" and lock a paying customer out of their own mocks;
# the derived figures on the dashboard stay correct regardless.

QUOTA_KINDS = ("mock_requests", "webhook_captures", "emails", "scenario_runs")


def _quota_key(user_id: uuid.UUID, kind: str, start: datetime) -> str:
    return f"quota:{user_id}:{kind}:{start:%Y%m}"


async def _seed_from_db(user, kind: str, db: AsyncSession) -> int:
    """Recompute one meter from stored rows."""
    usage = await get_usage(user, db)
    return usage["quotas"][kind]["used"]


async def consume_quota(user, kind: str, db: AsyncSession) -> tuple[bool, int, int]:
    """Count one unit against `kind`. Returns (allowed, used, limit)."""
    plan = PLANS.get((user.plan or "free").lower(), PLANS["free"])
    limit = plan["quotas"][kind]
    start, end = current_period()

    from app.db.redis import redis_client

    try:
        client = redis_client.client
        key = _quota_key(user.id, kind, start)

        used = await client.incr(key)
        if used == 1:
            # Either the first unit this month or a cold cache. Reconcile with
            # what is actually stored, then expire at the period boundary.
            actual = await _seed_from_db(user, kind, db)
            if actual > used:
                await client.set(key, actual)
                used = actual
            await client.expireat(key, int(end.timestamp()))

        return used <= limit, used, limit
    except Exception:
        logger.debug("Quota check unavailable for %s/%s; allowing", user.id, kind)
        return True, 0, limit
