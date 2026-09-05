"""Retention deletes data permanently, so every test here asks the same two
questions: did it remove what it should, and did it leave everything else alone.

The second question is the important one. A purge that deletes too much is
unrecoverable, and the failure mode is silent — nobody notices missing rows
until they go looking for them.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.models.endpoint import Endpoint
from app.models.sandbox import Sandbox
from app.models.sandbox_email import SandboxEmail
from app.models.webhook import WebhookCapture
from app.services.retention_service import (
    purge_older_than,
    purge_sandbox_emails,
    run_retention,
)


def _ago(days: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


async def _sandbox(db, user, *, prefix, retention_days):
    sandbox = Sandbox(
        user_id=user.id,
        name=prefix.title(),
        email_prefix=prefix,
        email_address=f"{prefix}@inbox.mocklane.com",
        smtp_username=f"smtp-{prefix}",
        smtp_password="unused-in-these-tests",
        email_retention_days=retention_days,
    )
    db.add(sandbox)
    await db.flush()
    return sandbox


async def _endpoint(db, user, short_id):
    """Captures require a real endpoint — endpoint_id is NOT NULL."""
    endpoint = Endpoint(user_id=user.id, short_id=short_id, name="Retention")
    db.add(endpoint)
    await db.flush()
    return endpoint


async def _email(db, sandbox, *, age_days):
    email = SandboxEmail(
        sandbox_id=sandbox.id,
        from_address="sender@example.com",
        to_addresses=[sandbox.email_address],
        subject=f"{age_days}d old",
        received_at=_ago(age_days),
    )
    db.add(email)
    await db.flush()
    return email


async def _count(db, model, **filters):
    stmt = select(func.count()).select_from(model)
    for column, value in filters.items():
        stmt = stmt.where(getattr(model, column) == value)
    return (await db.execute(stmt)).scalar_one()


# --- sandbox retention: a setting the product already exposes ---------------


@pytest.mark.asyncio
async def test_sandbox_emails_past_their_retention_are_deleted(db_session, test_user):
    sandbox = await _sandbox(db_session, test_user, prefix="keeps-7", retention_days=7)
    await _email(db_session, sandbox, age_days=10)
    await _email(db_session, sandbox, age_days=8)
    await _email(db_session, sandbox, age_days=2)

    deleted = await purge_sandbox_emails(db_session)

    assert deleted == 2
    assert await _count(db_session, SandboxEmail, sandbox_id=sandbox.id) == 1


@pytest.mark.asyncio
async def test_a_sandbox_with_no_retention_set_keeps_everything(db_session, test_user):
    """NULL means keep, not 'apply some default'.

    Most sandboxes have no retention set. Treating NULL as a default would
    quietly delete the data of every user who never touched the setting.
    """
    sandbox = await _sandbox(db_session, test_user, prefix="keeps-all", retention_days=None)
    await _email(db_session, sandbox, age_days=400)
    await _email(db_session, sandbox, age_days=900)

    deleted = await purge_sandbox_emails(db_session)

    assert deleted == 0
    assert await _count(db_session, SandboxEmail, sandbox_id=sandbox.id) == 2


@pytest.mark.asyncio
async def test_retention_is_per_sandbox_not_global(db_session, test_user):
    """Each sandbox's cutoff is its own; a short one must not reach its neighbour."""
    strict = await _sandbox(db_session, test_user, prefix="strict-1", retention_days=1)
    relaxed = await _sandbox(db_session, test_user, prefix="relaxed-90", retention_days=90)
    await _email(db_session, strict, age_days=5)
    await _email(db_session, relaxed, age_days=5)

    await purge_sandbox_emails(db_session)

    assert await _count(db_session, SandboxEmail, sandbox_id=strict.id) == 0
    assert await _count(db_session, SandboxEmail, sandbox_id=relaxed.id) == 1


# --- the global sweep: off unless an operator opts in -----------------------


@pytest.mark.asyncio
async def test_global_sweep_is_disabled_by_default(db_session, test_user, test_workspace, monkeypatch):
    """The default must never delete. A number picked here becomes a retention
    promise nobody agreed to, and the marketing copy was corrected specifically
    to stop claiming retention that nothing enforced."""
    from app.config import get_settings

    assert get_settings().retention_days is None

    endpoint = await _endpoint(db_session, test_user, "retain00001")
    db_session.add(
        WebhookCapture(
            endpoint_id=endpoint.id,
            http_method="POST",
            headers={},
            body="{}",
            captured_at=_ago(3650),
        )
    )
    await db_session.flush()
    before = await _count(db_session, WebhookCapture)

    counts = await run_retention(db_session)

    assert "webhook_captures" not in counts, "the global sweep ran without being configured"
    assert await _count(db_session, WebhookCapture) == before


@pytest.mark.asyncio
async def test_global_sweep_deletes_only_rows_past_the_cutoff(db_session, test_user):
    endpoint = await _endpoint(db_session, test_user, "retain00002")
    old = WebhookCapture(
        endpoint_id=endpoint.id, http_method="POST", headers={}, body="old", captured_at=_ago(40)
    )
    recent = WebhookCapture(
        endpoint_id=endpoint.id, http_method="POST", headers={}, body="recent", captured_at=_ago(3)
    )
    db_session.add_all([old, recent])
    await db_session.commit()

    counts = await purge_older_than(db_session, days=30)

    assert counts["webhook_captures"] >= 1
    surviving = (
        await db_session.execute(select(WebhookCapture.body).where(WebhookCapture.body == "recent"))
    ).scalars().all()
    assert surviving == ["recent"], "a row inside the cutoff was deleted"
    gone = (
        await db_session.execute(select(WebhookCapture.body).where(WebhookCapture.body == "old"))
    ).scalars().all()
    assert gone == []
