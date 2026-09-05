"""Deleting data that has outlived its usefulness.

Two very different things live here, and the difference is the point:

  - **Sandbox email retention is a promise the product already makes.** A user
    sets `email_retention_days` on a sandbox and the API stores it. Until now
    nothing ever read it back, so the setting did nothing at all. Enforcing it
    is not new policy; it is honouring a control the UI already offers.

  - **The global sweep is a safety net, and it is OFF by default.** Captures,
    mock request logs, inbox emails and run history otherwise accumulate
    forever on a single 30 GB volume. But a default number here would silently
    become a retention promise nobody agreed to, and the marketing copy was
    deliberately corrected to stop claiming tiered retention. So the knob
    exists, defaults to "keep everything", and deletes only what an operator
    explicitly opts into.

Deletes are issued as bulk DELETE statements rather than ORM cascades: these
run against tables that grow without bound, and loading a million rows into the
identity map to delete them one at a time is how a maintenance job becomes an
outage. Each table is committed separately so a long sweep makes progress even
if a later statement fails.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.inbox_email import InboxEmail
from app.models.mock_request_log import MockRequestLog
from app.models.sandbox import Sandbox
from app.models.sandbox_email import SandboxEmail
from app.models.scenario import ScenarioRun
from app.models.webhook import WebhookCapture

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def purge_sandbox_emails(db: AsyncSession) -> int:
    """Apply each sandbox's own `email_retention_days`.

    Per sandbox, not one bulk statement, because the cutoff differs per row's
    parent. Sandboxes with no retention set are skipped entirely — a null means
    "keep", not "use a default".
    """
    result = await db.execute(
        select(Sandbox.id, Sandbox.email_retention_days).where(
            Sandbox.email_retention_days.isnot(None)
        )
    )

    deleted = 0
    for sandbox_id, days in result.all():
        if not days or days < 1:
            # Defensive: the schema validator rejects < 1, but a row written
            # before that validator existed would otherwise delete everything.
            continue
        cutoff = _now() - timedelta(days=days)
        outcome = await db.execute(
            delete(SandboxEmail).where(
                SandboxEmail.sandbox_id == sandbox_id,
                SandboxEmail.received_at < cutoff,
            )
        )
        deleted += outcome.rowcount or 0

    if deleted:
        logger.info("Retention: deleted %d sandbox emails past their retention", deleted)
    return deleted


async def purge_older_than(db: AsyncSession, days: int) -> dict[str, int]:
    """Delete unbounded-growth rows older than `days`. Caller supplies the policy.

    ScenarioStepResult is not listed: it has ON DELETE CASCADE on run_id, so
    deleting runs takes their step results with them at the database level.
    """
    cutoff = _now() - timedelta(days=days)
    targets = (
        ("webhook_captures", WebhookCapture, WebhookCapture.captured_at),
        ("mock_request_logs", MockRequestLog, MockRequestLog.received_at),
        ("inbox_emails", InboxEmail, InboxEmail.received_at),
        ("scenario_runs", ScenarioRun, ScenarioRun.created_at),
    )

    counts: dict[str, int] = {}
    for label, model, timestamp in targets:
        outcome = await db.execute(delete(model).where(timestamp < cutoff))
        counts[label] = outcome.rowcount or 0
        # Commit per table so a failure on a later one does not throw away the
        # work already done. A sweep that half-finishes is fine; one that
        # rolls back every night and never converges is not.
        await db.commit()

    if any(counts.values()):
        logger.info("Retention: purged past %d days: %s", days, counts)
    return counts


async def run_retention(db: AsyncSession) -> dict[str, int]:
    """One retention pass. Safe to call when nothing is configured."""
    counts = {"sandbox_emails": await purge_sandbox_emails(db)}
    await db.commit()

    days = get_settings().retention_days
    if days:
        counts.update(await purge_older_than(db, days))
    return counts
