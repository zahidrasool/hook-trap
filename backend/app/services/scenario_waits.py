"""Waiting for something to arrive, and the step types that do it.

Waits poll Postgres rather than subscribing to Redis. Redis is optional
everywhere in this codebase, so every path here would have to be correct
without it anyway; polling every half second costs at most 500ms of latency on
a testing tool and removes a subscriber lifecycle from the worker entirely.
SCENARIOS_DESIGN.md §8 still describes pub/sub as the intended fast path — it
is a latency optimisation that can be added later without changing anything
here.

Every finder is scoped to rows created strictly after the step started. That is
what stops a webhook left over from an earlier run satisfying a later wait, and
it is the single constraint that makes repeated runs of one scenario
deterministic.
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inbox_email import InboxEmail
from app.models.webhook import WebhookCapture
from app.services.scenario_variables import MISSING, resolve_path

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 0.5


async def poll_until(fetch, *, timeout_seconds: float, poll_interval: float = POLL_INTERVAL_SECONDS):
    """Call `fetch` until it returns something, or the budget runs out.

    Returns (match, elapsed_seconds). `fetch` is always called at least once,
    so a step whose budget is already spent still gets one look rather than
    failing on a technicality.
    """
    started = time.monotonic()

    while True:
        found = await fetch()
        elapsed = time.monotonic() - started
        if found is not None:
            return found, elapsed
        if elapsed >= timeout_seconds:
            logger.debug("poll_until timed out after %.3fs", elapsed)
            return None, elapsed
        await asyncio.sleep(min(poll_interval, max(0.0, timeout_seconds - elapsed)))


def _parsed_body(raw: str | None):
    try:
        return json.loads(raw) if raw else None
    except (json.JSONDecodeError, TypeError):
        return raw


def _matches(capture: WebhookCapture, match_spec: dict) -> bool:
    """Every key in `match_spec` must equal the value at that dotted path.

    Paths resolve against a context of the parsed body and the headers, so a
    scenario can match on either without a second syntax.
    """
    if not match_spec:
        return True

    context = {"body": _parsed_body(capture.body), "headers": capture.headers or {}}
    for dotted, expected in match_spec.items():
        found = resolve_path(context, dotted)
        if found is MISSING or str(found) != str(expected):
            return False
    return True


async def find_capture(
    endpoint_id: uuid.UUID, since: datetime, match_spec: dict, db: AsyncSession
) -> WebhookCapture | None:
    """Oldest capture on this endpoint since `since` that satisfies `match_spec`."""
    result = await db.execute(
        select(WebhookCapture)
        .where(
            WebhookCapture.endpoint_id == endpoint_id,
            WebhookCapture.captured_at > since,
        )
        .order_by(WebhookCapture.captured_at)
    )
    for capture in result.scalars().all():
        if _matches(capture, match_spec):
            return capture
    return None


async def find_email(
    workspace_id: uuid.UUID, since: datetime, to: str | None, db: AsyncSession
) -> InboxEmail | None:
    """Oldest inbox email for this workspace since `since`, optionally to `to`."""
    result = await db.execute(
        select(InboxEmail)
        .where(InboxEmail.workspace_id == workspace_id, InboxEmail.received_at > since)
        .order_by(InboxEmail.received_at)
    )
    for email in result.scalars().all():
        if to is None:
            return email
        recipients = [str(a).lower() for a in (email.to_addresses or [])]
        if to.lower() in recipients:
            return email
    return None
