# Scenarios v2c — Wait Steps and Outbound Webhooks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the v1 step set. A scenario can deliver a webhook to the customer's application, then block until a webhook arrives on its own capture URL and until an email lands in its workspace inbox — the cross-capability workflow that is the product's actual differentiator.

**Architecture:** Wait steps need a database session and the scenario's identity, which `execute_step` deliberately does not have. Rather than making every step type carry that weight, the DB-backed step types live in a new `scenario_waits` module and `execute_step` delegates to it, returning an honest error if the worker did not supply what a wait step needs.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async + asyncpg, PostgreSQL 17, httpx, pytest.

## Global Constraints

- Backend Python runs from `backend/.venv`, cwd `D:\Personal\etc\HookTrap\backend`.
- **The full suite takes ~60s and the Bash tool auto-backgrounds anything past 120s.** Pass an explicit timeout of 300000 on every pytest call. Prefer focused files.
- **If a pytest run against `mocklane_test` is ever killed, reset the database before the next run.** A killed run leaves an `idle in transaction` connection holding row locks, and every later run blocks behind it — which presents as a hang with no output.
- Any test that opens its own sessions must release them in a `finally`, on the failure path too.
- Tests run against PostgreSQL. SQLite is not supported.
- **Tests must never make outbound network calls or perform real DNS.** `socket.getaddrinfo` is monkeypatched; HTTP is served by `httpx.MockTransport` through `safe_request`'s `client` seam.
- **All outbound HTTP goes through `app/services/http_client.safe_request`.** Never construct an `httpx.AsyncClient`. That is the SSRF boundary and it is not to be bypassed.
- Redis is optional everywhere and must stay that way. Nothing in this plan may require it.
- A step that cannot run returns an `error` result; it never raises.

## Deliberate deviation from the design doc

`SCENARIOS_DESIGN.md` §8 specifies a Redis pub/sub fast path alongside 500 ms polling, with
polling as the guarantee because Redis is optional. **This plan builds the polling half
only.** The reasoning: every path has to be correct with Redis down regardless, so the
polling code gets written either way; pub/sub would add a subscribe API, a worker-side
subscriber lifecycle, and publishes on the SMTP path, in exchange for at most 500 ms of
latency on a testing tool. Pub/sub remains a pure latency optimisation that can be added
later with no schema or contract change. §8 is left as written and still describes the
intended end state.

## Scope note on `wait_for_email`

Design §4 says a `wait_for_email` step blocks on "the workspace inbox or a sandbox". This
plan matches **`InboxEmail`, scoped to the scenario's workspace**, only. Sandboxes hang off
a *user*, not a workspace, and there is no scenario→sandbox relationship to scope a search
by — adding one is a schema decision, not a step type. Stated here rather than discovered.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `backend/app/services/scenario_waits.py` | Polling helper, the finders, and the DB-backed step executors |
| `backend/tests/test_scenario_waits.py` | Polling, matching, and the wait step types |
| `backend/tests/test_send_webhook_step.py` | The outbound webhook step |

**Modified**

| File | Change |
| --- | --- |
| `backend/app/services/scenario_steps.py` | `send_webhook` executor; delegate wait types to `scenario_waits` |
| `backend/app/services/scenario_worker.py` | pass `db` and `scenario` into `execute_step`; fix the rescue path |
| `backend/app/schemas/scenario_run.py` | expose `matched_id` |
| `backend/app/api/v1/scenarios.py` | return `matched_id` |

---

### Task 1: The polling wait machinery

**Files:**
- Create: `backend/app/services/scenario_waits.py`
- Create: `backend/tests/test_scenario_waits.py`

**Interfaces:**
- Produces:
  - `POLL_INTERVAL_SECONDS: float` (0.5)
  - `async poll_until(fetch, *, timeout_seconds: float, poll_interval: float = POLL_INTERVAL_SECONDS) -> tuple[object | None, float]` — returns `(match, elapsed_seconds)`; `match` is `None` on timeout
  - `async find_capture(endpoint_id, since, match_spec: dict, db) -> WebhookCapture | None`
  - `async find_email(workspace_id, since, to: str | None, db) -> InboxEmail | None`

The finders take `since` and only consider rows created strictly after it, so a webhook from
an earlier run cannot satisfy a later wait. That single constraint is what makes waits
deterministic across repeated runs of the same scenario.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_waits.py`:

```python
import asyncio
import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.endpoint import Endpoint
from app.models.inbox_email import InboxEmail
from app.models.webhook import WebhookCapture
from app.services.scenario_waits import find_capture, find_email, poll_until


@pytest.mark.asyncio
async def test_poll_until_returns_the_first_match():
    calls = {"n": 0}

    async def fetch():
        calls["n"] += 1
        return "found" if calls["n"] >= 2 else None

    match, elapsed = await poll_until(fetch, timeout_seconds=5, poll_interval=0.01)

    assert match == "found"
    assert calls["n"] == 2
    assert elapsed >= 0


@pytest.mark.asyncio
async def test_poll_until_gives_up_at_the_deadline():
    async def fetch():
        return None

    match, elapsed = await poll_until(fetch, timeout_seconds=0.05, poll_interval=0.01)

    assert match is None
    assert elapsed >= 0.05


@pytest.mark.asyncio
async def test_poll_until_checks_once_even_with_a_zero_timeout():
    """A wait whose budget is already spent still gets one look."""
    calls = {"n": 0}

    async def fetch():
        calls["n"] += 1
        return "found"

    match, _ = await poll_until(fetch, timeout_seconds=0, poll_interval=0.01)

    assert match == "found"
    assert calls["n"] == 1


async def _endpoint(db, user):
    endpoint = Endpoint(user_id=user.id, short_id="wai0000001")
    db.add(endpoint)
    await db.flush()
    return endpoint


@pytest.mark.asyncio
async def test_find_capture_ignores_rows_from_before_the_step_started(db_session, test_user):
    """A webhook from an earlier run must not satisfy a later wait."""
    endpoint = await _endpoint(db_session, test_user)
    old = WebhookCapture(
        endpoint_id=endpoint.id, http_method="POST", headers={}, body='{"event":"x"}'
    )
    db_session.add(old)
    await db_session.flush()

    since = datetime.now(timezone.utc) + timedelta(seconds=1)
    assert await find_capture(endpoint.id, since, {}, db_session) is None


@pytest.mark.asyncio
async def test_find_capture_matches_a_dotted_body_path(db_session, test_user):
    endpoint = await _endpoint(db_session, test_user)
    since = datetime.now(timezone.utc) - timedelta(seconds=5)

    db_session.add(
        WebhookCapture(
            endpoint_id=endpoint.id,
            http_method="POST",
            headers={},
            body=json.dumps({"event": "payment.failed"}),
        )
    )
    wanted = WebhookCapture(
        endpoint_id=endpoint.id,
        http_method="POST",
        headers={},
        body=json.dumps({"event": "payment.completed"}),
    )
    db_session.add(wanted)
    await db_session.flush()

    found = await find_capture(
        endpoint.id, since, {"body.event": "payment.completed"}, db_session
    )

    assert found is not None
    assert found.id == wanted.id


@pytest.mark.asyncio
async def test_find_capture_with_no_match_spec_takes_the_first_arrival(db_session, test_user):
    endpoint = await _endpoint(db_session, test_user)
    since = datetime.now(timezone.utc) - timedelta(seconds=5)
    first = WebhookCapture(endpoint_id=endpoint.id, http_method="POST", headers={}, body="{}")
    db_session.add(first)
    await db_session.flush()

    found = await find_capture(endpoint.id, since, {}, db_session)

    assert found is not None
    assert found.id == first.id


@pytest.mark.asyncio
async def test_find_capture_tolerates_a_non_json_body(db_session, test_user):
    """A capture whose body is not JSON must not break matching for others."""
    endpoint = await _endpoint(db_session, test_user)
    since = datetime.now(timezone.utc) - timedelta(seconds=5)
    db_session.add(
        WebhookCapture(endpoint_id=endpoint.id, http_method="POST", headers={}, body="not json")
    )
    await db_session.flush()

    assert await find_capture(endpoint.id, since, {"body.event": "x"}, db_session) is None


@pytest.mark.asyncio
async def test_find_email_matches_a_recipient(db_session, test_workspace):
    since = datetime.now(timezone.utc) - timedelta(seconds=5)
    db_session.add(
        InboxEmail(
            workspace_id=test_workspace.id,
            from_address="noreply@shop.test",
            to_addresses=["someone.else@example.com"],
            subject="Other",
        )
    )
    wanted = InboxEmail(
        workspace_id=test_workspace.id,
        from_address="noreply@shop.test",
        to_addresses=["buyer@example.com"],
        subject="Payment confirmed",
    )
    db_session.add(wanted)
    await db_session.flush()

    found = await find_email(test_workspace.id, since, "buyer@example.com", db_session)

    assert found is not None
    assert found.id == wanted.id


@pytest.mark.asyncio
async def test_find_email_ignores_rows_from_before_the_step_started(db_session, test_workspace):
    db_session.add(
        InboxEmail(
            workspace_id=test_workspace.id,
            from_address="a@b.test",
            to_addresses=["buyer@example.com"],
            subject="Old",
        )
    )
    await db_session.flush()

    since = datetime.now(timezone.utc) + timedelta(seconds=1)
    assert await find_email(test_workspace.id, since, "buyer@example.com", db_session) is None
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_waits.py -q` (Bash timeout 300000)

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.scenario_waits'`

- [ ] **Step 3: Write the polling helper and the finders**

Create `backend/app/services/scenario_waits.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_waits.py -q` (Bash timeout 300000)

Expected: `9 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/scenario_waits.py backend/tests/test_scenario_waits.py
git commit -m "feat(scenarios): add the polling wait machinery"
```

---

### Task 2: `wait_for_webhook` and `wait_for_email` as step types

`execute_step` is pure — no session, no scenario. Wait steps need both. Rather than
giving every step type that weight, the wait executors live in `scenario_waits` and
`execute_step` delegates, returning an honest `error` if the caller did not supply what a
wait step requires.

**Files:**
- Modify: `backend/app/services/scenario_waits.py`
- Modify: `backend/app/services/scenario_steps.py`
- Modify: `backend/app/services/scenario_worker.py`
- Modify: `backend/tests/test_scenario_waits.py`

**Interfaces:**
- Consumes: `get_capture_endpoint` from `scenario_service`; `interpolate`, `capture_values` from `scenario_variables`; `evaluate_all` from `assertions`.
- Produces:
  - `WAIT_STEP_TYPES: frozenset[str]` = `{"wait_for_webhook", "wait_for_email"}`
  - `async execute_wait_step(step, namespace, *, scenario, db, budget_seconds=None) -> dict`
  - `execute_step(...)` gains keyword-only `db=None, scenario=None`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_scenario_waits.py`:

```python
from app.services.scenario_steps import execute_step


async def _scenario_with_endpoint(db, workspace, user, short_id="wsc0000001"):
    from app.services.scenario_service import create_scenario

    scenario = await create_scenario(workspace, "Checkout", None, user, db)
    return scenario


@pytest.mark.asyncio
async def test_wait_for_webhook_finds_a_capture_that_arrives(db_session, test_workspace, test_user):
    from app.services.scenario_service import get_capture_endpoint

    scenario = await _scenario_with_endpoint(db_session, test_workspace, test_user)
    endpoint = await get_capture_endpoint(scenario.id, db_session)

    # captured_at is set explicitly just ahead of now. The finder only considers
    # rows created after the step starts — which is the constraint that stops a
    # previous run's webhook satisfying this wait — so a row inserted before the
    # step with a default timestamp would correctly never match.
    db_session.add(
        WebhookCapture(
            endpoint_id=endpoint.id,
            http_method="POST",
            headers={},
            body=json.dumps({"event": "payment.completed"}),
            captured_at=datetime.now(timezone.utc) + timedelta(milliseconds=200),
        )
    )
    await db_session.flush()

    result = await execute_step(
        {
            "type": "wait_for_webhook",
            "timeout_seconds": 2,
            "match": {"body.event": "payment.completed"},
            "assert": ['body.event == "payment.completed"'],
            "capture": {"receivedMethod": "method"},
        },
        {},
        db=db_session,
        scenario=scenario,
    )

    assert result["status"] == "passed"
    assert result["matched_id"] is not None
    assert result["captured"] == {"receivedMethod": "POST"}
    assert all(a["passed"] for a in result["assertions"])


@pytest.mark.asyncio
async def test_wait_for_webhook_times_out_when_nothing_arrives(db_session, test_workspace, test_user):
    scenario = await _scenario_with_endpoint(db_session, test_workspace, test_user, "wsc0000002")

    result = await execute_step(
        {"type": "wait_for_webhook", "timeout_seconds": 0.1},
        {},
        db=db_session,
        scenario=scenario,
    )

    assert result["status"] == "timeout"
    assert result["matched_id"] is None
    assert "no webhook" in result["error"].lower()


@pytest.mark.asyncio
async def test_wait_for_email_matches_the_recipient(db_session, test_workspace, test_user):
    scenario = await _scenario_with_endpoint(db_session, test_workspace, test_user, "wsc0000003")
    db_session.add(
        InboxEmail(
            workspace_id=test_workspace.id,
            from_address="noreply@shop.test",
            to_addresses=["buyer@example.com"],
            subject="Payment confirmed for order 7",
            text_body="thanks",
            received_at=datetime.now(timezone.utc) + timedelta(milliseconds=200),
        )
    )
    await db_session.flush()

    result = await execute_step(
        {
            "type": "wait_for_email",
            "to": "{{customerEmail}}",
            "timeout_seconds": 2,
            "assert": ['subject contains "Payment confirmed"'],
        },
        {"customerEmail": "buyer@example.com"},
        db=db_session,
        scenario=scenario,
    )

    assert result["status"] == "passed"
    assert result["matched_id"] is not None


@pytest.mark.asyncio
async def test_a_wait_step_without_a_session_is_an_error_not_a_crash():
    result = await execute_step({"type": "wait_for_webhook"}, {})

    assert result["status"] == "error"
    assert "session" in result["error"].lower() or "scenario" in result["error"].lower()


@pytest.mark.asyncio
async def test_a_failed_assertion_on_a_matched_webhook_fails_the_step(
    db_session, test_workspace, test_user
):
    from app.services.scenario_service import get_capture_endpoint

    scenario = await _scenario_with_endpoint(db_session, test_workspace, test_user, "wsc0000004")
    endpoint = await get_capture_endpoint(scenario.id, db_session)
    db_session.add(
        WebhookCapture(
            endpoint_id=endpoint.id,
            http_method="POST",
            headers={},
            body=json.dumps({"event": "payment.failed"}),
            captured_at=datetime.now(timezone.utc) + timedelta(milliseconds=200),
        )
    )
    await db_session.flush()

    result = await execute_step(
        {
            "type": "wait_for_webhook",
            "timeout_seconds": 2,
            "assert": ['body.event == "payment.completed"'],
        },
        {},
        db=db_session,
        scenario=scenario,
    )

    assert result["status"] == "failed"
    assert result["matched_id"] is not None
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_waits.py -q` (Bash timeout 300000)

Expected: FAIL — `execute_step` has no `db`/`scenario` parameters.

- [ ] **Step 3: Write the wait executors**

Append to `backend/app/services/scenario_waits.py`:

```python
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
    # written it. And unlike the code review found here originally, the
    # timeout result below always carries `matched_id: None` — every other
    # branch of this function sets it, and the API schema expects the key on
    # every step result, not just the successful ones.
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

    # Validated up front, mirroring _http_request's style: a bad shape here
    # must fail the step honestly rather than reach evaluate_all/capture_values
    # below, where (for `assert` in particular) a string instead of a list is
    # iterated character by character and produces one bogus failed assertion
    # per character.
    assert_spec = step.get("assert")
    if assert_spec is not None and not isinstance(assert_spec, list):
        return _error(started, f"{step_type}.assert must be a list, got {type(assert_spec).__name__}")

    capture_spec = step.get("capture")
    if capture_spec is not None and not isinstance(capture_spec, dict):
        return _error(started, f"{step_type}.capture must be an object, got {type(capture_spec).__name__}")

    if step_type == "wait_for_webhook":
        # Design §4 documents `endpoint` as optional, for waiting on a
        # different capture endpoint. It is not implemented — saying so
        # honestly beats silently waiting on the scenario's own endpoint as
        # if that were what the author asked for.
        if step.get("endpoint"):
            return _error(
                started,
                "wait_for_webhook.endpoint is not supported yet; the wait uses the "
                "scenario's own capture endpoint",
            )

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
        if to is not None and not isinstance(to, str):
            return _error(started, f"{step_type}.to must be a string, got {type(to).__name__}")

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

    assertions = evaluate_all(assert_spec or [], context)

    try:
        captured = capture_values(capture_spec or {}, context)
    except UnresolvedVariable as exc:
        return {
            **_error(started, str(exc)),
            "matched_id": matched.id,
            "assertions": assertions,
        }

    return {
        "status": "passed" if all(a["passed"] for a in assertions) else "failed",
        "started_at": started,
        "finished_at": _now(),
        "response": context,
        "matched_id": matched.id,
        "assertions": assertions,
        "captured": captured,
        "error": None,
    }
```

`assertions`, `scenario_service` and `scenario_variables` are imported at module level, above
`execute_wait_step`, not function-locally as an earlier draft of this plan had them — none of
those three import `scenario_steps`, so nothing about them creates a cycle. Only `_error` and
`_now` stay function-local, on purpose: `scenario_steps` imports this module for dispatch, and
a module-level import back would be a cycle.

- [ ] **Step 4: Delegate from `execute_step`**

In `backend/app/services/scenario_steps.py`, extend `SUPPORTED_STEP_TYPES` to include the
wait types, add the new parameters, and dispatch before the interpolation of pure steps:

```python
async def execute_step(step, namespace, *, client=None, budget_seconds=None, db=None, scenario=None) -> dict:
```

After the `isinstance(step, dict)` guard and the `step_type` lookup, and after
`interpolate`, add:

```python
    from app.services.scenario_waits import WAIT_STEP_TYPES, execute_wait_step

    if step_type in WAIT_STEP_TYPES:
        if db is None or scenario is None:
            # The worker supplies both. A wait step reached without them is a
            # caller error, and saying so beats a None dereference deeper down.
            return _error(started, f"{step_type} needs a database session and a scenario")
        try:
            return await execute_wait_step(
                resolved, namespace, scenario=scenario, db=db, budget_seconds=budget_seconds
            )
        except Exception as exc:
            return _error(started, str(exc) or exc.__class__.__name__)
```

Add `"wait_for_webhook"` and `"wait_for_email"` to `SUPPORTED_STEP_TYPES`.

- [ ] **Step 5: Pass the session and scenario from the worker**

In `backend/app/services/scenario_worker.py`, where `execute_step` is called, add
`db=db, scenario=scenario` to the call.

- [ ] **Step 6: Teach the run outcome about a timed-out step**

This is the step that makes the feature honest, and it is easy to miss.

`execute_run`'s loop branches on `result["status"] == "error"` and `== "failed"`. A wait step
returns **`"timeout"`**, which matches neither — so as the code stands, a scenario whose
webhook never arrives records a `timeout` step and then reports the **run** as `passed`.
A false green on the headline feature is the worst possible outcome for a testing product.

In `backend/app/services/scenario_worker.py`, treat a timed-out step as failing the run and
halting it — the steps after a wait almost always depend on what the wait was waiting for:

```python
        elif result["status"] == "timeout":
            # A wait that expired is a test failure, not an engine fault, but the
            # run cannot meaningfully continue: whatever the later steps needed
            # from that webhook or email never arrived.
            outcome = "failed" if outcome != "error" else outcome
            halted_at = index
```

placed alongside the existing `error` and `failed` branches.

Add a test in `backend/tests/test_scenario_worker.py`: a run whose only step is a
`wait_for_webhook` with a short timeout and nothing arriving must finish **`failed`**, with
the step recorded `timeout` — not `passed`.

- [ ] **Step 7: Run the tests**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_waits.py tests/test_scenario_steps.py tests/test_scenario_worker.py -q` (Bash timeout 300000)

Expected: the wait file reaches 14 passed and the other two files stay green, with one new worker test.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/scenario_waits.py backend/app/services/scenario_steps.py backend/app/services/scenario_worker.py backend/tests/test_scenario_waits.py
git commit -m "feat(scenarios): add wait_for_webhook and wait_for_email steps"
```

---

### Task 3: `send_webhook`

MockLane acting as the third-party provider: delivering an event to the customer's
endpoint. Signature schemes are design §9 and stay deferred to v2 — this ships the
delivery, not the signing.

**Files:**
- Modify: `backend/app/services/scenario_steps.py`
- Create: `backend/tests/test_send_webhook_step.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_send_webhook_step.py`:

```python
import ipaddress
import json
import socket

import httpx
import pytest

from app.services.scenario_steps import execute_step


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    """Hostnames resolve to one public address; IP literals resolve to themselves."""

    def _getaddrinfo(host, port, *args, **kwargs):
        bare = host.strip("[]")
        try:
            ipaddress.ip_address(bare)
            resolved = bare
        except ValueError:
            resolved = "93.184.216.34"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (resolved, port or 0))]

    monkeypatch.setattr(socket, "getaddrinfo", _getaddrinfo)


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_send_webhook_posts_the_event_body():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        seen["type"] = request.headers.get("x-mocklane-event")
        return httpx.Response(200, json={"ok": True})

    result = await execute_step(
        {
            "type": "send_webhook",
            "url": "{{appUrl}}/webhooks/payment",
            "event": "payment.completed",
            "body": {"paymentId": "{{paymentId}}"},
            "assert": ["status == 200"],
        },
        {"appUrl": "https://example.com", "paymentId": "pay_1"},
        client=_client(handler),
    )

    assert result["status"] == "passed"
    assert seen["url"] == "https://example.com/webhooks/payment"
    assert seen["body"] == {"paymentId": "pay_1"}
    assert seen["type"] == "payment.completed"


@pytest.mark.asyncio
async def test_send_webhook_to_a_blocked_address_is_an_error():
    def handler(request):  # pragma: no cover - must not run
        raise AssertionError("the guard should have blocked this")

    result = await execute_step(
        {"type": "send_webhook", "url": "http://169.254.169.254/latest/", "event": "x"},
        {},
        client=_client(handler),
    )

    assert result["status"] == "error"
    assert "not a public address" in result["error"]


@pytest.mark.asyncio
async def test_send_webhook_requires_a_url():
    result = await execute_step({"type": "send_webhook", "event": "x"}, {})

    assert result["status"] == "error"
    assert "url" in result["error"]


@pytest.mark.asyncio
async def test_send_webhook_failing_assertion_fails_the_step():
    def handler(request):
        return httpx.Response(500, json={})

    result = await execute_step(
        {
            "type": "send_webhook",
            "url": "https://example.com/hook",
            "event": "x",
            "assert": ["status == 200"],
        },
        {},
        client=_client(handler),
    )

    assert result["status"] == "failed"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/test_send_webhook_step.py -q` (Bash timeout 300000)

Expected: FAIL — `Unsupported step type: 'send_webhook'`

- [ ] **Step 3: Implement it**

`send_webhook` is `http_request` with a fixed method and an event header, so implement it by
delegating rather than duplicating. In `backend/app/services/scenario_steps.py`, add
`"send_webhook"` to `SUPPORTED_STEP_TYPES` and add:

```python
async def _send_webhook(step: dict, started, client, budget_seconds) -> dict:
    """Deliver an event to the customer's endpoint, as the provider would.

    Signature schemes (design §9) are deliberately not here yet: a scenario can
    already prove its endpoint accepts a well-formed delivery, and signing is
    only meaningful once the schemes are implemented properly rather than
    approximated.
    """
    if not step.get("url"):
        return _error(started, "send_webhook has no url")

    event = step.get("event")
    headers = dict(step.get("headers") or {})
    headers.setdefault("Content-Type", "application/json")
    if event is not None:
        headers.setdefault("X-MockLane-Event", str(event))

    delivery = {
        **step,
        "method": "POST",
        "headers": headers,
        "body": step.get("body") if step.get("body") is not None else {},
    }
    return await _http_request(delivery, started, client, budget_seconds)
```

and dispatch to it alongside the other pure types.

- [ ] **Step 4: Run the tests**

Run: `.venv/Scripts/python.exe -m pytest tests/test_send_webhook_step.py -q` (Bash timeout 300000)

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/scenario_steps.py backend/tests/test_send_webhook_step.py
git commit -m "feat(scenarios): add the send_webhook step"
```

---

### Task 4: Surface `matched_id`, and close two carried defects

**Files:**
- Modify: `backend/app/schemas/scenario_run.py`
- Modify: `backend/app/api/v1/scenarios.py`
- Modify: `backend/app/services/scenario_worker.py`
- Modify: `backend/tests/test_scenario_runs_api.py`
- Modify: `backend/tests/test_scenario_worker.py`

Three items, all carried from earlier reviews and all now load-bearing because wait steps
are what populate `matched_id`.

- [ ] **Step 1: Expose `matched_id`**

Add `matched_id: uuid.UUID | None` to `StepResultResponse` in
`backend/app/schemas/scenario_run.py`, and populate it in the `GET` route in
`backend/app/api/v1/scenarios.py`. Without this the run report cannot show *which* capture
or email satisfied a wait, which is the whole point of storing it.

Add a test to `backend/tests/test_scenario_runs_api.py` asserting the field is present in a
fetched run's step results.

- [ ] **Step 2: Fix `run_once`'s rescue path**

The rescue calls `logger.exception("Scenario run %s crashed", run.id)` **before**
`db.rollback()`. When the failure expired the instance — which is exactly what a vanished
run row does — reading `run.id` raises `PendingRollbackError`, the rescue never runs, and the
run is left `running` until the sweeper collects it.

Capture the id before anything can fail, and roll back first:

```python
    except Exception as exc:
        run_id = run.id
        try:
            await db.rollback()
        except Exception:
            pass
        logger.exception("Scenario run %s crashed", run_id)
        try:
            fresh = await db.get(ScenarioRun, run_id)
            ...
```

Add a test: a run whose scenario is deleted mid-execution leaves the worker alive and does
not raise out of `run_once`.

- [ ] **Step 3: Check the deadline after the final step too**

`execute_run` checks the deadline only *before* each step, so a run whose last step consumes
the whole budget still reports `passed`. Add one check after the loop: if the budget is
exhausted and the outcome would otherwise be `passed`, finish `timeout` instead.

Add a test with a single step that outlives a 1-second ceiling, asserting `timeout`.

- [ ] **Step 4: Run the affected files**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_runs_api.py tests/test_scenario_worker.py -q` (Bash timeout 300000)

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/scenario_run.py backend/app/api/v1/scenarios.py backend/app/services/scenario_worker.py backend/tests/test_scenario_runs_api.py backend/tests/test_scenario_worker.py
git commit -m "feat(scenarios): surface matched_id and close two carried defects"
```

---

### Task 5: An end-to-end scenario

One test that proves the feature does what the product claims: a scenario that calls the
application, delivers a webhook, waits for one back, and waits for an email — the workflow
from design §1.

**Files:**
- Create: `backend/tests/test_scenario_end_to_end.py`

- [ ] **Step 1: Write it**

Build a scenario whose steps are `http_request` → `send_webhook` → `wait_for_webhook` →
`wait_for_email`. Drive it with `execute_run`. Serve the two outbound calls with
`httpx.MockTransport`.

Inserting the `WebhookCapture` and `InboxEmail` **before the run starts** does not work: the
waits are scoped to rows created strictly *after* each step's own `since`, so a row inserted
before the run begins is already stale by the time the corresponding wait step starts polling
— relaxing that scoping to make the test pass was considered and rejected, since it is exactly
what keeps repeated runs of one scenario deterministic (see the module docstring on the
shipped `find_capture`/`find_email`). The shipped test instead uses a concurrent inserter
task from a second session (`async_sessionmaker(db_engine, ...)`), reacting to each preceding
step's `ScenarioStepResult` becoming durable rather than sleeping a fixed offset from test
start — a fixed-sleep version was tried first and was flaky under injected latency because
`wait_for_webhook`'s own completion is quantized to `poll_until`'s 0.5s poll interval, which
pushes `wait_for_email`'s `since` out unpredictably relative to a wall-clock offset measured
from a different origin. See `test_scenario_end_to_end.py`'s module docstring for the full
account, including the measured failure rate of the fixed-sleep version.

Assert: the run passes; there are four step results in order; the two wait steps carry a
`matched_id`; a variable captured in step 1 reached step 2's body.

- [ ] **Step 2: Run the full suite**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q` (Bash timeout 500000)

Report the count. Everything previously passing must still pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_scenario_end_to_end.py
git commit -m "test(scenarios): prove the cross-capability workflow end to end"
```

---

## What this plan does not do

- **No Redis pub/sub.** Polling only, for the reasons stated at the top. §8's fast path
  remains a future optimisation.
- **No webhook signing.** Design §9's `stripe`/`github`/`shopify`/`hmac_sha256` schemes and
  `sign.invalid` stay in v2.
- **No sandbox inbox matching** for `wait_for_email` — workspace inbox only, because
  sandboxes are user-scoped and no scenario→sandbox relationship exists.
- **No `wait_for_webhook.endpoint`.** Design §4 documents it as optional, for waiting on a
  capture endpoint other than the scenario's own. A step declaring it gets an honest `error`
  naming the field as unsupported rather than silently waiting on the scenario's own endpoint.
- **No worker concurrency.** One run still executes at a time globally; that head-of-line
  blocking is a live production property and a scoping decision, not a defect to fix here.
- **No connection pinning**, so the DNS-rebinding window documented in `ssrf_guard` stays
  open.
- No streaming response reads, no run-history retention, no frontend.
