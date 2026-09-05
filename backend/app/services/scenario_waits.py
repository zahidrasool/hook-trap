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
from app.services.assertions import evaluate_all
from app.services.scenario_service import get_capture_endpoint
from app.services.scenario_variables import (
    MISSING,
    UnresolvedVariable,
    capture_values,
    resolve_path,
)

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


WAIT_STEP_TYPES = frozenset({"wait_for_webhook", "wait_for_email"})

DEFAULT_WAIT_TIMEOUT_SECONDS = 30.0


async def execute_wait_step(step: dict, namespace: dict, *, scenario, db, budget_seconds=None) -> dict:
    """Block until the thing this step is waiting for arrives, or time out.

    A wait that expires is `timeout`, not `error`: nothing went wrong with the
    engine, the thing simply did not turn up — which is a result the customer
    needs to see as a test outcome rather than a fault.
    """
    # scenario_steps imports this module for dispatch; a module-level import
    # back to it would be a cycle, so only this one stays function-local.
    # (assertions, scenario_service and scenario_variables don't import
    # either module, so those three are safe at module level above.)
    from app.services.scenario_steps import _error, _now

    started = _now()
    step_type = step["type"]

    declared_timeout = step.get("timeout_seconds")
    try:
        declared_timeout = (
            float(declared_timeout) if declared_timeout is not None else DEFAULT_WAIT_TIMEOUT_SECONDS
        )
    except (TypeError, ValueError):
        return _error(started, f"{step_type}.timeout_seconds is not a number: {declared_timeout!r}")

    # The run's remaining budget can clamp the wait shorter than the author
    # declared. When that happens, the *run's* deadline is what expired, not
    # the step's own timeout_seconds — so the reported message must say which
    # one, rather than quoting the clamped float back as if the author had
    # written it.
    effective_timeout = declared_timeout
    budget_clamped = False
    if budget_seconds is not None and budget_seconds < declared_timeout:
        effective_timeout = budget_seconds
        budget_clamped = True

    def _timeout_message(noun: str) -> str:
        if budget_clamped:
            return (
                f"The run's remaining budget of {effective_timeout:.1f}s expired while "
                f"waiting for a{'n' if noun[0] in 'aeiou' else ''} {noun}"
            )
        return f"Timed out after {declared_timeout}s: no {noun} arrived matching this step"

    if step_type == "wait_for_webhook":
        endpoint = await get_capture_endpoint(scenario.id, db)
        if endpoint is None:
            return _error(started, "This scenario has no capture endpoint")

        match_spec = step.get("match") or {}
        if not isinstance(match_spec, dict):
            return _error(started, f"wait_for_webhook.match must be an object, got {type(match_spec).__name__}")

        async def fetch():
            return await find_capture(endpoint.id, started, match_spec, db)

        matched, elapsed = await poll_until(fetch, timeout_seconds=effective_timeout)
        if matched is None:
            return {
                **_error(started, _timeout_message("webhook")),
                "status": "timeout",
                "matched_id": None,
            }

        context = {
            "method": matched.http_method,
            "body": _parsed_body(matched.body),
            "headers": matched.headers or {},
            "captured_at": matched.captured_at.isoformat() if matched.captured_at else None,
            "_elapsed_s": elapsed,
        }
    else:
        to = step.get("to")

        async def fetch():
            return await find_email(scenario.workspace_id, started, to, db)

        matched, elapsed = await poll_until(fetch, timeout_seconds=effective_timeout)
        if matched is None:
            return {
                **_error(started, _timeout_message("email")),
                "status": "timeout",
                "matched_id": None,
            }

        context = {
            "subject": matched.subject,
            "body": matched.text_body or matched.html_body,
            "from": matched.from_address,
            "to": matched.to_addresses or [],
            "received_at": matched.received_at.isoformat() if matched.received_at else None,
            "_elapsed_s": elapsed,
        }

    assertions = evaluate_all(step.get("assert") or [], context)

    try:
        captured = capture_values(step.get("capture") or {}, context)
    except UnresolvedVariable as exc:
        return {
            **_error(started, str(exc)),
            "matched_id": matched.id,
            "assertions": assertions,
        }

    # `context` (with `_elapsed_s`) is what assertions and captures are
    # evaluated against — a `received_within Ns` assertion resolves that key.
    # The stored response is a copy without it, mirroring how `_http_request`
    # keeps its `response_record` separate from its assertion context, so the
    # UI never has to render an underscore-prefixed internal key.
    response_record = {k: v for k, v in context.items() if k != "_elapsed_s"}

    return {
        "status": "passed" if all(a["passed"] for a in assertions) else "failed",
        "started_at": started,
        "finished_at": _now(),
        "response": response_record,
        "matched_id": matched.id,
        "assertions": assertions,
        "captured": captured,
        "error": None,
    }
