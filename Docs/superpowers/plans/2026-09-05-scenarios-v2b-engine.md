# Scenarios v2b — The Execution Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A scenario can be run. Trigger a run over the API, a background worker executes its steps in order against the customer's application, and the run reports per-step requests, responses and assertion results.

**Architecture:** Runs are rows in a Postgres queue claimed with `FOR UPDATE SKIP LOCKED`; runs of one scenario serialise, different scenarios run in parallel. Execution is decomposed so the interesting logic is testable without a running loop: `execute_step` is a pure-ish function over one step, `execute_run` drives one run to completion, and the worker loop is a thin wrapper that claims and calls `execute_run`. Two step types ship here — `delay` and `http_request` — which is enough for a run to be end-to-end real.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async + asyncpg, PostgreSQL 17, httpx, pytest.

## Global Constraints

- Backend Python runs from `backend/.venv`. Commands assume cwd `D:\Personal\etc\HookTrap\backend`.
- Tests run against PostgreSQL `mocklane_test`. SQLite is not supported — this plan's claim query uses `FOR UPDATE SKIP LOCKED`, which SQLite has no equivalent for.
- **Tests must never make outbound network calls or perform real DNS.** Outbound HTTP goes through `safe_request`, which tests drive with `httpx.MockTransport` and a monkeypatched `socket.getaddrinfo`.
- **All outbound HTTP goes through `app/services/http_client.safe_request`.** Never construct an `httpx.AsyncClient` in this plan's code. That is the SSRF boundary established in Plan 2a and it is not to be bypassed.
- Redis is optional everywhere in this codebase and must stay that way. Nothing in this plan may require it.
- New status columns carry a `CheckConstraint`, matching the existing convention.
- Schema changes are applied twice: declared on the model, and as idempotent `ALTER`/`CREATE INDEX IF NOT EXISTS` in the `migrations` list in `app/main.py`'s `lifespan`.
- The worker must not block the event loop. Any blocking call is offloaded with `asyncio.to_thread`, as `http_client` already does for DNS.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `backend/app/services/scenario_run_service.py` | Run lifecycle: create, claim, transition, sweep |
| `backend/app/services/scenario_steps.py` | Execute one step; build its assertion context |
| `backend/app/services/scenario_worker.py` | The claim-and-execute loop and its lifespan hooks |
| `backend/app/schemas/scenario_run.py` | Run request/response shapes |
| `backend/tests/test_scenario_quota.py` | The fourth meter |
| `backend/tests/test_scenario_run_service.py` | Lifecycle and the claim query, including serialisation |
| `backend/tests/test_scenario_steps.py` | `delay` and `http_request` execution |
| `backend/tests/test_scenario_worker.py` | One loop iteration, whole-run timeout, cancellation |
| `backend/tests/test_scenario_runs_api.py` | Run, fetch, cancel |

**Modified**

| File | Change |
| --- | --- |
| `backend/app/services/billing_service.py` | `scenario_runs` quota on all three plans |
| `backend/app/services/usage_service.py` | count and meter `scenario_runs`; add to `QUOTA_KINDS` |
| `backend/app/models/scenario.py` | `CheckConstraint` on `ScenarioRun.trigger` |
| `backend/app/main.py` | trigger constraint migration; start/stop the worker |
| `backend/app/api/v1/scenarios.py` | run, fetch and cancel routes |
| `backend/app/services/scenario_variables.py` | bound `interpolate`'s recursion |
| `backend/app/services/http_client.py` | cap `SafeResponse.headers` |

---

### Task 1: The fourth quota meter

Runs are billable work. The existing three meters (`mock_requests`, `webhook_captures`, `emails`) are derived from stored rows and enforced through `consume_quota`; this adds a fourth in the same shape. Doing it first means the run API in Task 5 has a meter to charge.

**Files:**
- Modify: `backend/app/services/billing_service.py`
- Modify: `backend/app/services/usage_service.py`
- Create: `backend/tests/test_scenario_quota.py`

**Interfaces:**
- Produces: `PLANS[*]["quotas"]["scenario_runs"]`; `get_usage(...)["quotas"]["scenario_runs"]`; `"scenario_runs"` in `QUOTA_KINDS`, so `consume_quota(user, "scenario_runs", db)` works unchanged.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_quota.py`:

```python
import pytest

from app.models.scenario import Scenario, ScenarioRun
from app.services.billing_service import PLANS
from app.services.usage_service import QUOTA_KINDS, get_usage


def test_every_plan_meters_scenario_runs():
    for name, plan in PLANS.items():
        assert "scenario_runs" in plan["quotas"], f"{name} has no scenario_runs quota"


def test_scenario_runs_is_an_enforceable_kind():
    """consume_quota looks the kind up in QUOTA_KINDS and in the plan."""
    assert "scenario_runs" in QUOTA_KINDS


def test_plan_tiers_increase():
    free = PLANS["free"]["quotas"]["scenario_runs"]
    pro = PLANS["pro"]["quotas"]["scenario_runs"]
    team = PLANS["team"]["quotas"]["scenario_runs"]
    assert free < pro < team


@pytest.mark.asyncio
async def test_usage_counts_runs_in_the_current_period(db_session, test_user, test_workspace):
    scenario = Scenario(
        workspace_id=test_workspace.id,
        short_id="qta0000001",
        name="Checkout",
        slug="checkout",
    )
    db_session.add(scenario)
    await db_session.flush()

    for _ in range(3):
        db_session.add(
            ScenarioRun(
                scenario_id=scenario.id,
                workspace_id=test_workspace.id,
                status="passed",
            )
        )
    await db_session.flush()

    usage = await get_usage(test_user, db_session)

    assert usage["quotas"]["scenario_runs"]["used"] == 3
    assert usage["quotas"]["scenario_runs"]["limit"] == PLANS["free"]["quotas"]["scenario_runs"]


@pytest.mark.asyncio
async def test_usage_reports_zero_runs_for_a_user_with_none(db_session, test_user, test_workspace):
    usage = await get_usage(test_user, db_session)

    assert usage["quotas"]["scenario_runs"]["used"] == 0
    assert usage["quotas"]["scenario_runs"]["exceeded"] is False
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_quota.py -q`

Expected: FAIL — `KeyError: 'scenario_runs'` on the plan lookups, and the usage tests fail on the missing key.

- [ ] **Step 3: Add the quota to every plan**

In `backend/app/services/billing_service.py`, add `scenario_runs` to each plan's `quotas`:

```python
        "quotas": {"mock_requests": 10_000, "webhook_captures": 1_000, "emails": 200, "scenario_runs": 100},
```
```python
        "quotas": {"mock_requests": 250_000, "webhook_captures": 50_000, "emails": 5_000, "scenario_runs": 5_000},
```
```python
        "quotas": {"mock_requests": 1_000_000, "webhook_captures": 250_000, "emails": 25_000, "scenario_runs": 50_000},
```

Steps are not metered separately: a run is a run, however many steps it has. Metering steps would make the number impossible for a customer to predict before writing the scenario.

- [ ] **Step 4: Count runs in `get_usage`**

In `backend/app/services/usage_service.py`, add the import:

```python
from app.models.scenario import ScenarioRun
```

Inside the `if ws_ids:` branch, alongside the other workspace-scoped counts:

```python
        scenario_runs = await count(
            select(func.count(ScenarioRun.id)).where(
                ScenarioRun.workspace_id.in_(ws_ids),
                ScenarioRun.created_at >= start,
                ScenarioRun.created_at < end,
            )
        )
```

and in the `else:` branch set it to zero alongside the others:

```python
        mock_requests = workspace_emails = scenario_runs = 0
```

Add the meter to the returned `quotas` dict:

```python
            "scenario_runs": meter(scenario_runs, quotas["scenario_runs"]),
```

And extend the enforceable kinds:

```python
QUOTA_KINDS = ("mock_requests", "webhook_captures", "emails", "scenario_runs")
```

Counting on `created_at` rather than `started_at` is deliberate: a run that is queued and never starts still consumed the quota it was admitted against, and charging only started runs would let a caller queue unlimited work.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_quota.py -q`

Expected: `5 passed`

- [ ] **Step 6: Run the whole suite and commit**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `144 passed` (139 + 5)

```bash
git add backend/app/services/billing_service.py backend/app/services/usage_service.py backend/tests/test_scenario_quota.py
git commit -m "feat(scenarios): meter scenario runs as the fourth quota"
```

---

### Task 2: Run lifecycle and the claim query

The queue is a table, not Redis, because a run must survive a restart. This task builds every database operation the worker performs, so the worker itself stays thin and the concurrency rules are testable without one.

**Files:**
- Create: `backend/app/services/scenario_run_service.py`
- Create: `backend/tests/test_scenario_run_service.py`
- Modify: `backend/app/models/scenario.py`
- Modify: `backend/app/main.py` (the `migrations` list)

**Interfaces:**
- Produces:
  - `TERMINAL_STATUSES: frozenset[str]`
  - `async create_run(scenario, variables: dict, trigger: str, db) -> ScenarioRun`
  - `async claim_next_run(db) -> ScenarioRun | None`
  - `async mark_running(run, db) -> None`
  - `async finish_run(run, status: str, error: str | None, db) -> None`
  - `async cancel_run(run, db) -> bool`
  - `async sweep_timed_out_runs(db) -> int`
  - `async record_step_result(run, index: int, step_type: str, result: dict, db) -> ScenarioStepResult`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_run_service.py`:

```python
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult
from app.services.scenario_run_service import (
    cancel_run,
    claim_next_run,
    create_run,
    finish_run,
    mark_running,
    record_step_result,
    sweep_timed_out_runs,
)


async def _scenario(db, workspace, *, slug, short_id, timeout_seconds=120):
    scenario = Scenario(
        workspace_id=workspace.id,
        short_id=short_id,
        name=slug.title(),
        slug=slug,
        steps=[{"type": "delay", "seconds": 0}],
        timeout_seconds=timeout_seconds,
    )
    db.add(scenario)
    await db.flush()
    return scenario


@pytest.mark.asyncio
async def test_create_run_starts_pending(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000001")

    run = await create_run(scenario, {"baseUrl": "https://x"}, "manual", db_session)

    assert run.status == "pending"
    assert run.trigger == "manual"
    assert run.variables == {"baseUrl": "https://x"}
    assert run.workspace_id == test_workspace.id
    assert run.started_at is None


@pytest.mark.asyncio
async def test_claim_returns_the_oldest_pending_run(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000002")
    first = await create_run(scenario, {}, "manual", db_session)
    await create_run(scenario, {}, "manual", db_session)

    claimed = await claim_next_run(db_session)

    assert claimed is not None
    assert claimed.id == first.id


@pytest.mark.asyncio
async def test_claim_returns_none_when_nothing_is_pending(db_session):
    assert await claim_next_run(db_session) is None


@pytest.mark.asyncio
async def test_runs_of_one_scenario_serialise(db_session, test_workspace):
    """Steps in a run are interdependent and runs share the scenario's
    namespace, so a second run must wait for the first to finish."""
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000003")
    first = await create_run(scenario, {}, "manual", db_session)
    await create_run(scenario, {}, "manual", db_session)

    claimed = await claim_next_run(db_session)
    await mark_running(claimed, db_session)

    assert await claim_next_run(db_session) is None

    await finish_run(first, "passed", None, db_session)
    assert await claim_next_run(db_session) is not None


@pytest.mark.asyncio
async def test_different_scenarios_run_in_parallel(db_session, test_workspace):
    """The parallelism that matters — a CI job running many scenarios."""
    one = await _scenario(db_session, test_workspace, slug="a", short_id="run0000004")
    two = await _scenario(db_session, test_workspace, slug="b", short_id="run0000005")
    await create_run(one, {}, "manual", db_session)
    await create_run(two, {}, "manual", db_session)

    first = await claim_next_run(db_session)
    await mark_running(first, db_session)
    second = await claim_next_run(db_session)

    assert second is not None
    assert second.scenario_id != first.scenario_id


@pytest.mark.asyncio
async def test_mark_running_stamps_started_at(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000006")
    run = await create_run(scenario, {}, "manual", db_session)

    await mark_running(run, db_session)

    assert run.status == "running"
    assert run.started_at is not None


@pytest.mark.asyncio
async def test_finish_run_records_duration(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000007")
    run = await create_run(scenario, {}, "manual", db_session)
    await mark_running(run, db_session)

    await finish_run(run, "failed", None, db_session)

    assert run.status == "failed"
    assert run.finished_at is not None
    assert run.duration_ms is not None and run.duration_ms >= 0


@pytest.mark.asyncio
async def test_cancel_only_applies_to_unfinished_runs(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000008")
    pending = await create_run(scenario, {}, "manual", db_session)

    assert await cancel_run(pending, db_session) is True
    assert pending.status == "cancelled"

    # Cancelling again is a no-op, not an error.
    assert await cancel_run(pending, db_session) is False


@pytest.mark.asyncio
async def test_sweep_times_out_runs_past_their_ceiling(db_session, test_workspace):
    """A crashed worker must not block a scenario forever."""
    scenario = await _scenario(
        db_session, test_workspace, slug="a", short_id="run0000009", timeout_seconds=1
    )
    run = await create_run(scenario, {}, "manual", db_session)
    await mark_running(run, db_session)
    run.started_at = datetime.now(timezone.utc) - timedelta(seconds=30)
    await db_session.flush()

    swept = await sweep_timed_out_runs(db_session)

    assert swept == 1
    await db_session.refresh(run)
    assert run.status == "timeout"


@pytest.mark.asyncio
async def test_sweep_leaves_runs_inside_their_ceiling_alone(db_session, test_workspace):
    scenario = await _scenario(
        db_session, test_workspace, slug="a", short_id="run0000010", timeout_seconds=600
    )
    run = await create_run(scenario, {}, "manual", db_session)
    await mark_running(run, db_session)

    assert await sweep_timed_out_runs(db_session) == 0
    assert run.status == "running"


@pytest.mark.asyncio
async def test_the_timeout_clock_starts_at_started_at_not_creation(db_session, test_workspace):
    """A queue backlog must not read as a test failure."""
    scenario = await _scenario(
        db_session, test_workspace, slug="a", short_id="run0000011", timeout_seconds=60
    )
    run = await create_run(scenario, {}, "manual", db_session)
    run.created_at = datetime.now(timezone.utc) - timedelta(hours=2)
    await db_session.flush()
    await mark_running(run, db_session)

    assert await sweep_timed_out_runs(db_session) == 0


@pytest.mark.asyncio
async def test_record_step_result_stores_the_payloads(db_session, test_workspace):
    scenario = await _scenario(db_session, test_workspace, slug="a", short_id="run0000012")
    run = await create_run(scenario, {}, "manual", db_session)

    await record_step_result(
        run,
        0,
        "http_request",
        {
            "status": "passed",
            "request": {"method": "POST", "url": "https://x"},
            "response": {"status_code": 200},
            "assertions": [{"assertion": "status == 200", "passed": True}],
            "captured": {"id": "p_1"},
        },
        db_session,
    )

    stored = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    assert len(stored) == 1
    assert stored[0].step_index == 0
    assert stored[0].request["method"] == "POST"
    assert stored[0].captured == {"id": "p_1"}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_run_service.py -q`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.scenario_run_service'`

- [ ] **Step 3: Constrain the trigger column**

`trigger` is enum-shaped and was left unconstrained in Plan 1 because nothing wrote it. This task writes it, so the constraint lands now.

In `backend/app/models/scenario.py`, extend `ScenarioRun.__table_args__`:

```python
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'running', 'passed', 'failed', 'error', 'timeout', 'cancelled')",
            name="ck_scenario_runs_status",
        ),
        CheckConstraint(
            "trigger IN ('manual', 'api', 'ci')",
            name="ck_scenario_runs_trigger",
        ),
    )
```

In `backend/app/main.py`, append to the `migrations` list:

```python
            "ALTER TABLE scenario_runs DROP CONSTRAINT IF EXISTS ck_scenario_runs_trigger",
            "ALTER TABLE scenario_runs ADD CONSTRAINT ck_scenario_runs_trigger "
            "CHECK (trigger IN ('manual', 'api', 'ci'))",
```

The drop-then-add is deliberate: `ADD CONSTRAINT` has no `IF NOT EXISTS` in Postgres, and dropping first makes the pair idempotent across restarts.

- [ ] **Step 4: Write the service**

Create `backend/app/services/scenario_run_service.py`:

```python
"""Run lifecycle and the Postgres run queue.

The queue is a table rather than Redis because a run must survive a restart,
and Redis is optional everywhere else in this codebase. Claiming uses
FOR UPDATE SKIP LOCKED so several workers can share the table without
coordinating.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult

TERMINAL_STATUSES = frozenset({"passed", "failed", "error", "timeout", "cancelled"})


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create_run(scenario: Scenario, variables: dict, trigger: str, db: AsyncSession) -> ScenarioRun:
    run = ScenarioRun(
        scenario_id=scenario.id,
        workspace_id=scenario.workspace_id,
        status="pending",
        trigger=trigger,
        variables=variables or {},
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def claim_next_run(db: AsyncSession) -> ScenarioRun | None:
    """Oldest pending run whose scenario has nothing already running.

    Runs of one scenario serialise: their steps are interdependent and every
    run of a scenario shares that scenario's URL namespace, so two overlapping
    runs would contend for both. Different scenarios are untouched by this,
    which is the parallelism that actually matters — a CI job firing twenty
    different scenarios at once.
    """
    claimed = await db.execute(
        select(ScenarioRun)
        .where(
            ScenarioRun.status == "pending",
            ~select(ScenarioRun.id)
            .where(
                ScenarioRun.status == "running",
                ScenarioRun.scenario_id == ScenarioRun.__table__.c.scenario_id,
            )
            .exists(),
        )
        .order_by(ScenarioRun.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    return claimed.scalar_one_or_none()


async def mark_running(run: ScenarioRun, db: AsyncSession) -> None:
    run.status = "running"
    run.started_at = _now()
    await db.flush()


async def finish_run(run: ScenarioRun, status: str, error: str | None, db: AsyncSession) -> None:
    run.status = status
    run.error = error
    run.finished_at = _now()
    if run.started_at is not None:
        run.duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)
    await db.flush()


async def cancel_run(run: ScenarioRun, db: AsyncSession) -> bool:
    """Cancel an unfinished run. Returns False if it had already finished."""
    if run.status in TERMINAL_STATUSES:
        return False
    await finish_run(run, "cancelled", None, db)
    return True


async def sweep_timed_out_runs(db: AsyncSession) -> int:
    """Time out runs that have been running past their scenario's ceiling.

    A worker that dies mid-run leaves its row `running` forever, and because
    runs of one scenario serialise, that would block the scenario permanently.
    The ceiling is measured from started_at, never created_at: time spent
    queued is not the customer's test being slow.
    """
    stale = await db.execute(
        select(ScenarioRun, Scenario.timeout_seconds)
        .join(Scenario, Scenario.id == ScenarioRun.scenario_id)
        .where(ScenarioRun.status == "running", ScenarioRun.started_at.isnot(None))
    )

    swept = 0
    now = _now()
    for run, ceiling in stale.all():
        if (now - run.started_at).total_seconds() > (ceiling or 120):
            await finish_run(run, "timeout", "Run exceeded its timeout", db)
            swept += 1
    return swept


async def record_step_result(
    run: ScenarioRun, index: int, step_type: str, result: dict, db: AsyncSession
) -> ScenarioStepResult:
    stored = ScenarioStepResult(
        run_id=run.id,
        step_index=index,
        step_type=step_type,
        status=result.get("status", "error"),
        started_at=result.get("started_at"),
        finished_at=result.get("finished_at"),
        request=result.get("request"),
        response=result.get("response"),
        matched_id=result.get("matched_id"),
        assertions=result.get("assertions") or [],
        captured=result.get("captured") or {},
        error=result.get("error"),
    )
    db.add(stored)
    await db.flush()
    return stored
```

**On `claim_next_run`:** the correlated `NOT EXISTS` above references the same table twice and the SQLAlchemy expression as written may not alias it correctly. Run the test at Step 5 and, if the generated SQL is wrong, build the subquery with an explicit alias:

```python
    running = aliased(ScenarioRun)
    ...
            ~select(running.id)
            .where(running.status == "running", running.scenario_id == ScenarioRun.scenario_id)
            .exists(),
```

Verify the emitted SQL with `print(stmt.compile(compile_kwargs={"literal_binds": True}))` before assuming either form is right. Do not move on until the serialisation test passes for the right reason.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_run_service.py -q`

Expected: `12 passed`

- [ ] **Step 6: Run the whole suite and commit**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `156 passed` (144 + 12)

```bash
git add backend/app/services/scenario_run_service.py backend/app/models/scenario.py backend/app/main.py backend/tests/test_scenario_run_service.py
git commit -m "feat(scenarios): add the run queue and lifecycle"
```

---

### Task 3: Step execution — `delay` and `http_request`

**Files:**
- Create: `backend/app/services/scenario_steps.py`
- Create: `backend/tests/test_scenario_steps.py`
- Modify: `backend/app/services/scenario_variables.py`
- Modify: `backend/app/services/http_client.py`

**Interfaces:**
- Consumes: `safe_request`, `SafeResponse`, `BlockedAddress`; `interpolate`, `capture_values`, `UnresolvedVariable`; `evaluate_all`.
- Produces:
  - `SUPPORTED_STEP_TYPES: frozenset[str]`
  - `async execute_step(step: dict, namespace: dict, *, client=None) -> dict` — returns a result dict in the shape `record_step_result` consumes, plus a `captured` dict the caller merges into the namespace.

Two hardening items carried from Plan 2a land here, because this is the task that first lets user-authored content reach them.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_steps.py`:

```python
import ipaddress
import socket

import httpx
import pytest

from app.services.scenario_steps import execute_step


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    """Hostnames resolve to one public address; IP literals resolve to themselves.

    Mirroring the real resolver matters. `getaddrinfo` on an IP literal returns
    that IP unchanged, so a mock that laundered every host into a public
    address would quietly make the blocked-address tests vacuous — the metadata
    address would "resolve" to something public and sail through the guard.
    """

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
async def test_delay_waits_and_passes():
    result = await execute_step({"type": "delay", "seconds": 0}, {})

    assert result["status"] == "passed"
    assert result["assertions"] == []


@pytest.mark.asyncio
async def test_unknown_step_type_is_an_error_not_a_crash():
    result = await execute_step({"type": "teleport"}, {})

    assert result["status"] == "error"
    assert "teleport" in result["error"]


@pytest.mark.asyncio
async def test_http_request_records_request_and_response():
    def handler(request):
        assert request.headers["content-type"] == "application/json"
        return httpx.Response(200, json={"paymentId": "pay_1"})

    result = await execute_step(
        {
            "type": "http_request",
            "method": "POST",
            "url": "{{baseUrl}}/payments",
            "headers": {"Content-Type": "application/json"},
            "body": {"amount": 4900},
            "assert": ["status == 200", "response.body.paymentId exists"],
            "capture": {"paymentId": "response.body.paymentId"},
        },
        {"baseUrl": "https://example.com"},
        client=_client(handler),
    )

    assert result["status"] == "passed"
    assert result["request"]["url"] == "https://example.com/payments"
    assert result["response"]["status_code"] == 200
    assert result["captured"] == {"paymentId": "pay_1"}
    assert all(a["passed"] for a in result["assertions"])


@pytest.mark.asyncio
async def test_a_failed_assertion_fails_the_step_and_reports_actual():
    def handler(request):
        return httpx.Response(500, json={})

    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "assert": ["status == 200"],
        },
        {},
        client=_client(handler),
    )

    assert result["status"] == "failed"
    failed = [a for a in result["assertions"] if not a["passed"]]
    assert failed[0]["expected"] == 200
    assert failed[0]["actual"] == 500


@pytest.mark.asyncio
async def test_an_unresolved_variable_is_a_step_error():
    result = await execute_step(
        {"type": "http_request", "method": "GET", "url": "{{missing}}/x"}, {}
    )

    assert result["status"] == "error"
    assert "missing" in result["error"]


@pytest.mark.asyncio
async def test_a_blocked_target_is_a_step_error_not_a_crash():
    def handler(request):  # pragma: no cover - must not run
        raise AssertionError("the guard should have blocked this")

    result = await execute_step(
        {"type": "http_request", "method": "GET", "url": "http://169.254.169.254/latest/"},
        {},
        client=_client(handler),
    )

    assert result["status"] == "error"
    assert "not a public address" in result["error"]


@pytest.mark.asyncio
async def test_capturing_a_missing_path_fails_the_step():
    def handler(request):
        return httpx.Response(200, json={})

    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "capture": {"id": "response.body.nope"},
        },
        {},
        client=_client(handler),
    )

    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_a_non_json_response_body_is_still_recorded():
    def handler(request):
        return httpx.Response(200, text="plain text")

    result = await execute_step(
        {"type": "http_request", "method": "GET", "url": "https://example.com/x"},
        {},
        client=_client(handler),
    )

    assert result["status"] == "passed"
    assert result["response"]["body"] == "plain text"
```

Add to `backend/tests/test_scenario_variables.py`:

```python
def test_interpolate_refuses_pathologically_nested_input():
    """A crafted definition must fail as a scenario error, not a RecursionError."""
    from app.services.scenario_variables import InterpolationTooDeep, interpolate

    nested = {}
    current = nested
    for _ in range(200):
        child = {}
        current["next"] = child
        current = child

    with pytest.raises(InterpolationTooDeep):
        interpolate(nested, {})
```

And to `backend/tests/test_http_client.py` — extend its existing
`from app.services.http_client import ...` line to also import
`MAX_HEADER_VALUE_BYTES`:

```python
@pytest.mark.asyncio
async def test_response_headers_are_capped():
    def handler(request):
        return httpx.Response(200, headers={"X-Huge": "v" * 20000}, text="ok")

    result = await safe_request("GET", "https://example.com/x", client=_client(handler))

    assert len(result.headers["x-huge"]) <= MAX_HEADER_VALUE_BYTES
```

- [ ] **Step 2: Run them to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_steps.py tests/test_scenario_variables.py tests/test_http_client.py -q`

Expected: FAIL — `ModuleNotFoundError` for `app.services.scenario_steps`, plus `ImportError` for `InterpolationTooDeep` and `MAX_HEADER_VALUE_BYTES`.

- [ ] **Step 3: Bound interpolation depth**

In `backend/app/services/scenario_variables.py`, add:

```python
MAX_INTERPOLATION_DEPTH = 50


class InterpolationTooDeep(Exception):
    """A step definition nested deeper than the engine will walk."""
```

Give `interpolate` a depth parameter and raise rather than recursing forever:

```python
def interpolate(value, namespace: dict, _depth: int = 0):
    """Substitute {{name}} throughout `value`, recursing into dicts and lists.

    Depth is bounded so a crafted definition fails as a scenario error rather
    than taking a worker down with a RecursionError.
    """
    if _depth > MAX_INTERPOLATION_DEPTH:
        raise InterpolationTooDeep(
            f"Step definition nests deeper than {MAX_INTERPOLATION_DEPTH} levels"
        )

    if isinstance(value, dict):
        return {key: interpolate(item, namespace, _depth + 1) for key, item in value.items()}
    if isinstance(value, list):
        return [interpolate(item, namespace, _depth + 1) for item in value]
```

The rest of the function is unchanged.

- [ ] **Step 4: Cap response header values**

In `backend/app/services/http_client.py`, add:

```python
MAX_HEADER_VALUE_BYTES = 4096
```

and where `SafeResponse` is built, replace `headers=dict(response.headers)` with:

```python
                headers={
                    name: value[:MAX_HEADER_VALUE_BYTES]
                    for name, value in response.headers.items()
                },
```

Step results persist these, so an uncapped header is the same unbounded-storage problem the body cap already solves.

- [ ] **Step 5: Write the step executor**

Create `backend/app/services/scenario_steps.py`:

```python
"""Execution of a single scenario step.

Each executor returns a result dict in the shape `record_step_result` stores,
so the worker never has to know what a step type does. Errors are returned as
results rather than raised: one bad step should fail its step and let the run
report on the rest, not abort the run with a traceback.

The distinction the whole feature rests on is preserved here — an assertion
that fails is `failed`, while the engine being unable to run the step at all is
`error`. CI needs to tell "your app returned the wrong status" from "we could
not reach your app".
"""

import asyncio
import json
import time
from datetime import datetime, timezone

from app.services.assertions import evaluate_all
from app.services.http_client import safe_request
from app.services.scenario_variables import (
    InterpolationTooDeep,
    UnresolvedVariable,
    capture_values,
    interpolate,
)
from app.services.ssrf_guard import BlockedAddress

SUPPORTED_STEP_TYPES = frozenset({"delay", "http_request"})

MAX_DELAY_SECONDS = 300


def _now():
    return datetime.now(timezone.utc)


def _error(step_type: str, started, message: str) -> dict:
    return {
        "status": "error",
        "started_at": started,
        "finished_at": _now(),
        "assertions": [],
        "captured": {},
        "error": message,
    }


async def execute_step(step: dict, namespace: dict, *, client=None) -> dict:
    """Run one step against the current variable namespace."""
    started = _now()
    step_type = (step or {}).get("type")

    if step_type not in SUPPORTED_STEP_TYPES:
        return _error(step_type, started, f"Unsupported step type: {step_type!r}")

    try:
        resolved = interpolate(step, namespace)
    except (UnresolvedVariable, InterpolationTooDeep) as exc:
        return _error(step_type, started, str(exc))

    if step_type == "delay":
        return await _delay(resolved, started)
    return await _http_request(resolved, started, client)


async def _delay(step: dict, started) -> dict:
    seconds = step.get("seconds", 0)
    try:
        seconds = float(seconds)
    except (TypeError, ValueError):
        return _error("delay", started, f"delay.seconds is not a number: {seconds!r}")

    # Refused rather than silently clamped. A scenario asking to wait ten
    # minutes has a problem the author needs told about, and quietly waiting a
    # different length than the definition says makes the run report a lie.
    if seconds > MAX_DELAY_SECONDS:
        return _error(
            "delay",
            started,
            f"delay.seconds is {seconds}, above the {MAX_DELAY_SECONDS}s maximum",
        )

    await asyncio.sleep(max(0.0, seconds))
    return {
        "status": "passed",
        "started_at": started,
        "finished_at": _now(),
        "assertions": [],
        "captured": {},
        "error": None,
    }


def _parse_body(text: str):
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return text


async def _http_request(step: dict, started, client) -> dict:
    url = step.get("url")
    if not url:
        return _error("http_request", started, "http_request has no url")

    method = (step.get("method") or "GET").upper()
    headers = step.get("headers") or {}
    body = step.get("body")
    content = json.dumps(body) if isinstance(body, (dict, list)) else body
    timeout = float(step.get("timeout_seconds") or 30)

    request_record = {"method": method, "url": url, "headers": headers, "body": body}

    try:
        response = await safe_request(
            method, url, headers=headers, content=content, timeout=timeout, client=client
        )
    except BlockedAddress as exc:
        return {**_error("http_request", started, str(exc)), "request": request_record}
    except Exception as exc:
        message = str(exc) or exc.__class__.__name__
        return {**_error("http_request", started, message), "request": request_record}

    parsed = _parse_body(response.text)
    response_record = {
        "status_code": response.status_code,
        "headers": response.headers,
        "body": parsed,
        "time_ms": response.elapsed_ms,
        "truncated": response.truncated,
    }

    context = {
        "status": response.status_code,
        "response": {
            "body": parsed,
            "headers": response.headers,
            "time_ms": response.elapsed_ms,
        },
        "body": parsed,
    }

    assertions = evaluate_all(step.get("assert") or [], context)

    try:
        captured = capture_values(step.get("capture") or {}, context)
    except UnresolvedVariable as exc:
        return {
            **_error("http_request", started, str(exc)),
            "request": request_record,
            "response": response_record,
            "assertions": assertions,
        }

    return {
        "status": "passed" if all(a["passed"] for a in assertions) else "failed",
        "started_at": started,
        "finished_at": _now(),
        "request": request_record,
        "response": response_record,
        "assertions": assertions,
        "captured": captured,
        "error": None,
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_steps.py tests/test_scenario_variables.py tests/test_http_client.py -q`

Expected: the three files pass with 8 new step tests, 1 new variables test and 1 new http_client test.

- [ ] **Step 7: Run the whole suite and commit**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `166 passed` (156 + 8 + 1 + 1)

```bash
git add backend/app/services/scenario_steps.py backend/app/services/scenario_variables.py backend/app/services/http_client.py backend/tests/test_scenario_steps.py backend/tests/test_scenario_variables.py backend/tests/test_http_client.py
git commit -m "feat(scenarios): execute delay and http_request steps"
```

---

### Task 4: The worker

**Files:**
- Create: `backend/app/services/scenario_worker.py`
- Create: `backend/tests/test_scenario_worker.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: everything from Tasks 2 and 3.
- Produces:
  - `async execute_run(run, db, *, client=None) -> str` — drives one run to a terminal status and returns it
  - `async run_once(db, *, client=None) -> bool` — sweep, claim one run, execute it; returns whether it did work
  - `async start_worker()` / `async stop_worker()` — lifespan hooks

The loop is deliberately thin. `execute_run` and `run_once` are directly callable, so the engine's behaviour is tested without starting a background task.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_worker.py`:

```python
import ipaddress
import socket

import httpx
import pytest
from sqlalchemy import select

from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult
from app.services.scenario_run_service import create_run
from app.services.scenario_worker import execute_run, run_once


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    """Hostnames resolve to one public address; IP literals resolve to themselves.

    Mirroring the real resolver matters. `getaddrinfo` on an IP literal returns
    that IP unchanged, so a mock that laundered every host into a public
    address would quietly make the blocked-address tests vacuous — the metadata
    address would "resolve" to something public and sail through the guard.
    """

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


async def _scenario(db, workspace, steps, *, short_id, variables=None, timeout_seconds=120):
    scenario = Scenario(
        workspace_id=workspace.id,
        short_id=short_id,
        name="Checkout",
        slug=short_id,
        steps=steps,
        variables=variables or {},
        timeout_seconds=timeout_seconds,
    )
    db.add(scenario)
    await db.flush()
    return scenario


@pytest.mark.asyncio
async def test_a_run_of_passing_steps_passes(db_session, test_workspace):
    def handler(request):
        return httpx.Response(200, json={"id": "p_1"})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [
            {"type": "delay", "seconds": 0},
            {
                "type": "http_request",
                "method": "GET",
                "url": "https://example.com/x",
                "assert": ["status == 200"],
            },
        ],
        short_id="wrk0000001",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session, client=_client(handler))

    assert status == "passed"
    results = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    assert [r.step_index for r in results] == [0, 1]


@pytest.mark.asyncio
async def test_a_failed_assertion_fails_the_run_but_later_steps_still_run(
    db_session, test_workspace
):
    """One report should show every problem, not only the first."""
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(500, json={})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [
            {"type": "http_request", "method": "GET", "url": "https://example.com/a",
             "assert": ["status == 200"]},
            {"type": "http_request", "method": "GET", "url": "https://example.com/b",
             "assert": ["status == 200"]},
        ],
        short_id="wrk0000002",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session, client=_client(handler))

    assert status == "failed"
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_stop_on_failure_halts_the_run(db_session, test_workspace):
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(500, json={})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [
            {"type": "http_request", "method": "GET", "url": "https://example.com/a",
             "assert": ["status == 200"], "stop_on_failure": True},
            {"type": "http_request", "method": "GET", "url": "https://example.com/b"},
        ],
        short_id="wrk0000003",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session, client=_client(handler))

    assert status == "failed"
    assert len(calls) == 1
    results = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    skipped = [r for r in results if r.status == "skipped"]
    assert len(skipped) == 1


@pytest.mark.asyncio
async def test_an_engine_error_ends_the_run_as_error_not_failed(db_session, test_workspace):
    """CI must tell 'your app returned the wrong status' from 'we could not
    reach your app'."""
    scenario = await _scenario(
        db_session,
        test_workspace,
        [{"type": "http_request", "method": "GET", "url": "http://169.254.169.254/latest/"}],
        short_id="wrk0000004",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    status = await execute_run(run, db_session)

    assert status == "error"


@pytest.mark.asyncio
async def test_captured_variables_flow_into_later_steps(db_session, test_workspace):
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(200, json={"id": "p_1"})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [
            {"type": "http_request", "method": "POST", "url": "https://example.com/pay",
             "capture": {"paymentId": "response.body.id"}},
            {"type": "http_request", "method": "GET", "url": "https://example.com/pay/{{paymentId}}"},
        ],
        short_id="wrk0000005",
    )
    run = await create_run(scenario, {}, "manual", db_session)

    await execute_run(run, db_session, client=_client(handler))

    assert seen[1].endswith("/pay/p_1")


@pytest.mark.asyncio
async def test_scenario_variables_seed_the_namespace(db_session, test_workspace):
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(200, json={})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [{"type": "http_request", "method": "GET", "url": "{{baseUrl}}/x"}],
        short_id="wrk0000006",
        variables={"baseUrl": "https://example.com"},
    )
    run = await create_run(scenario, {}, "manual", db_session)

    await execute_run(run, db_session, client=_client(handler))

    assert seen[0] == "https://example.com/x"


@pytest.mark.asyncio
async def test_trigger_variables_override_scenario_variables(db_session, test_workspace):
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(200, json={})

    scenario = await _scenario(
        db_session,
        test_workspace,
        [{"type": "http_request", "method": "GET", "url": "{{baseUrl}}/x"}],
        short_id="wrk0000007",
        variables={"baseUrl": "https://scenario"},
    )
    run = await create_run(scenario, {"baseUrl": "https://trigger"}, "api", db_session)

    await execute_run(run, db_session, client=_client(handler))

    assert seen[0] == "https://trigger/x"


@pytest.mark.asyncio
async def test_run_once_claims_and_executes(db_session, test_workspace):
    scenario = await _scenario(
        db_session, test_workspace, [{"type": "delay", "seconds": 0}], short_id="wrk0000008"
    )
    await create_run(scenario, {}, "manual", db_session)

    did_work = await run_once(db_session)

    assert did_work is True
    run = (await db_session.execute(select(ScenarioRun))).scalars().first()
    assert run.status == "passed"


@pytest.mark.asyncio
async def test_run_once_reports_no_work_when_the_queue_is_empty(db_session):
    assert await run_once(db_session) is False
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_worker.py -q`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.scenario_worker'`

- [ ] **Step 3: Write the worker**

Create `backend/app/services/scenario_worker.py`:

```python
"""The scenario worker.

A run holds state for seconds to minutes, so it cannot occupy a request
handler. v1 is an asyncio task started in the FastAPI lifespan, pulling queued
runs from Postgres. That avoids adding a broker to a box already running
Postgres, Redis, Caddy and two apps; when it outgrows that, the upgrade is a
separate process against the same table, with no schema change.

`execute_run` and `run_once` are ordinary awaitables so the engine's behaviour
is testable without starting the loop.
"""

import asyncio
import logging

from app.db.database import async_session_factory
from app.models.scenario import Scenario
from app.services.scenario_run_service import (
    claim_next_run,
    finish_run,
    mark_running,
    record_step_result,
    sweep_timed_out_runs,
)
from app.services.scenario_steps import execute_step
from app.services.scenario_variables import build_namespace

logger = logging.getLogger(__name__)

POLL_SECONDS = 1.0

_task: asyncio.Task | None = None
_stopping = False


async def execute_run(run, db, *, client=None) -> str:
    """Drive one run to a terminal status and return it."""
    scenario = await db.get(Scenario, run.scenario_id)
    if scenario is None:
        await finish_run(run, "error", "Scenario no longer exists", db)
        return "error"

    if run.status != "running":
        await mark_running(run, db)

    namespace = build_namespace(scenario.variables, run.variables)
    steps = scenario.steps or []

    outcome = "passed"
    halted_at = None

    for index, step in enumerate(steps):
        if halted_at is not None:
            await record_step_result(
                run, index, (step or {}).get("type", "unknown"), {"status": "skipped"}, db
            )
            continue

        result = await execute_step(step, namespace, client=client)
        await record_step_result(run, index, (step or {}).get("type", "unknown"), result, db)

        namespace.update(result.get("captured") or {})

        if result["status"] == "error":
            # An engine fault is not the customer's assertion failing, and the
            # run cannot meaningfully continue past it.
            outcome = "error"
            halted_at = index
        elif result["status"] == "failed":
            # A failed assertion fails the run but the remaining steps still
            # run, so one report shows every problem rather than only the first.
            outcome = "failed" if outcome != "error" else outcome
            if (step or {}).get("stop_on_failure"):
                halted_at = index

    error = None if outcome != "error" else "A step could not be executed"
    await finish_run(run, outcome, error, db)
    return outcome


async def run_once(db, *, client=None) -> bool:
    """Sweep stale runs, then claim and execute at most one run."""
    await sweep_timed_out_runs(db)

    run = await claim_next_run(db)
    if run is None:
        return False

    await mark_running(run, db)

    # Commit the claim immediately, before executing anything. The claim query
    # takes FOR UPDATE on the scenario row as well as the run row, and holding
    # that for the whole run would block a user editing or deleting the
    # scenario until the run finished. Once the run is committed as `running`,
    # the NOT EXISTS predicate is what keeps other workers off this scenario —
    # the row lock has done its job and is no longer needed.
    await db.commit()

    try:
        await execute_run(run, db, client=client)
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Scenario run %s crashed", run.id)
        await finish_run(run, "error", str(exc) or exc.__class__.__name__, db)
    return True


async def _loop() -> None:
    while not _stopping:
        try:
            async with async_session_factory() as db:
                did_work = await run_once(db)
                await db.commit()
            if not did_work:
                await asyncio.sleep(POLL_SECONDS)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Scenario worker iteration failed")
            await asyncio.sleep(POLL_SECONDS)


async def start_worker() -> None:
    global _task, _stopping
    _stopping = False
    _task = asyncio.create_task(_loop())


async def stop_worker() -> None:
    global _task, _stopping
    _stopping = True
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):
            pass
        _task = None
```

- [ ] **Step 4: Start the worker in the lifespan**

In `backend/app/main.py`, after the SMTP server block, add:

```python
    try:
        from app.services.scenario_worker import start_worker
        await start_worker()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Scenario worker failed to start: %s", e)
```

and in the shutdown section, before the Redis close:

```python
    try:
        from app.services.scenario_worker import stop_worker
        await stop_worker()
    except Exception:
        pass
```

Follow the existing SMTP pattern exactly: a failure to start the worker must not stop the API from serving.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_worker.py -q`

Expected: `9 passed`

- [ ] **Step 6: Run the whole suite and commit**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `175 passed` (166 + 9)

```bash
git add backend/app/services/scenario_worker.py backend/app/main.py backend/tests/test_scenario_worker.py
git commit -m "feat(scenarios): add the run worker"
```

---

### Task 5: The run API

**Files:**
- Create: `backend/app/schemas/scenario_run.py`
- Create: `backend/tests/test_scenario_runs_api.py`
- Modify: `backend/app/api/v1/scenarios.py`

**Interfaces:**
- Consumes: `_load_scenario` and `_load` from the existing `scenarios.py`; `create_run`, `cancel_run` from Task 2; `consume_quota` from `usage_service`.
- Produces:
  - `POST /workspaces/{short_id}/scenarios/{slug}/run` → 202 `{run_id, status}`
  - `GET /workspaces/{short_id}/runs/{run_id}` → run plus ordered step results
  - `POST /workspaces/{short_id}/runs/{run_id}/cancel` → 200

Run creation returns 202 immediately. A synchronous run endpoint is tempting for CI but would tie up a request handler for the run's duration.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_runs_api.py`:

```python
import pytest


async def _scenario(client, auth_headers, workspace, steps=None):
    created = await client.post(
        f"/api/v1/workspaces/{workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    if steps is not None:
        await client.patch(
            f"/api/v1/workspaces/{workspace.short_id}/scenarios/checkout",
            headers=auth_headers,
            json={"steps": steps},
        )
    return created.json()


@pytest.mark.asyncio
async def test_triggering_a_run_returns_202(client, auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={"variables": {"baseUrl": "https://x"}},
    )

    assert response.status_code == 202
    body = response.json()
    assert body["status"] == "pending"
    assert body["run_id"]


@pytest.mark.asyncio
async def test_fetching_a_run_returns_it_with_step_results(client, auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]

    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}", headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == run_id
    assert body["status"] == "pending"
    assert body["step_results"] == []


@pytest.mark.asyncio
async def test_cancelling_a_pending_run(client, auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}/cancel", headers=auth_headers
    )

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancelling_a_finished_run_is_409(client, auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}/cancel", headers=auth_headers
    )

    again = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/{run_id}/cancel", headers=auth_headers
    )

    assert again.status_code == 409


@pytest.mark.asyncio
async def test_running_a_scenario_requires_editor(client, auth_headers, other_auth_headers, test_workspace):
    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=other_auth_headers,
        json={},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_a_run_is_not_reachable_through_another_workspace(
    client, auth_headers, other_auth_headers, other_user, test_workspace, db_session
):
    from app.services.workspace_service import create_workspace

    await _scenario(client, auth_headers, test_workspace, [{"type": "delay", "seconds": 0}])
    triggered = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/run",
        headers=auth_headers,
        json={},
    )
    run_id = triggered.json()["run_id"]

    other_ws = await create_workspace("Other", None, other_user, db_session)
    await db_session.commit()

    response = await client.get(
        f"/api/v1/workspaces/{other_ws.short_id}/runs/{run_id}", headers=other_auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_an_unknown_run_is_404(client, auth_headers, test_workspace):
    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/runs/"
        "00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )

    assert response.status_code == 404
```

- [ ] **Step 2: Run it to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_runs_api.py -q`

Expected: FAIL — every request 404s, since no run routes are mounted.

- [ ] **Step 3: Write the schemas**

Create `backend/app/schemas/scenario_run.py`:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RunTrigger(BaseModel):
    variables: dict = Field(default_factory=dict)


class RunAcceptedResponse(BaseModel):
    run_id: uuid.UUID
    status: str


class StepResultResponse(BaseModel):
    step_index: int
    step_type: str
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    request: dict | None
    response: dict | None
    assertions: list
    captured: dict
    error: str | None


class RunResponse(BaseModel):
    id: uuid.UUID
    scenario_id: uuid.UUID
    status: str
    trigger: str
    variables: dict
    started_at: datetime | None
    finished_at: datetime | None
    duration_ms: int | None
    error: str | None
    created_at: datetime
    step_results: list[StepResultResponse]
```

- [ ] **Step 4: Write the routes**

In `backend/app/api/v1/scenarios.py`, add the imports:

```python
import uuid as uuid_module

from app.models.scenario import ScenarioRun, ScenarioStepResult
from app.schemas.scenario_run import (
    RunAcceptedResponse,
    RunResponse,
    RunTrigger,
    StepResultResponse,
)
from app.services.scenario_run_service import cancel_run, create_run
from app.services.usage_service import consume_quota
```

and append these routes:

```python
@router.post(
    "/workspaces/{short_id}/scenarios/{slug}/run",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=RunAcceptedResponse,
)
async def trigger_run(
    short_id: str,
    slug: str,
    body: RunTrigger,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace, scenario = await _load_scenario(short_id, slug, user, db, min_role="editor")

    if not scenario.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This scenario is not active"
        )

    owner = await db.get(User, workspace.owner_id)
    if owner is not None:
        allowed, used, limit = await consume_quota(owner, "scenario_runs", db)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Monthly scenario run quota exceeded ({used}/{limit})",
            )

    run = await create_run(scenario, body.variables, "api", db)
    await db.commit()
    return RunAcceptedResponse(run_id=run.id, status=run.status)


async def _load_run(short_id: str, run_id: uuid_module.UUID, user: User, db: AsyncSession):
    workspace = await _load(short_id, user, db, min_role="viewer")
    result = await db.execute(
        select(ScenarioRun).where(
            ScenarioRun.id == run_id,
            # Scoped to the workspace in the path, so a run id from another
            # workspace is not reachable by guessing.
            ScenarioRun.workspace_id == workspace.id,
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return workspace, run


@router.get("/workspaces/{short_id}/runs/{run_id}", response_model=RunResponse)
async def get_run(
    short_id: str,
    run_id: uuid_module.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, run = await _load_run(short_id, run_id, user, db)

    results = await db.execute(
        select(ScenarioStepResult)
        .where(ScenarioStepResult.run_id == run.id)
        .order_by(ScenarioStepResult.step_index)
    )

    return RunResponse(
        id=run.id,
        scenario_id=run.scenario_id,
        status=run.status,
        trigger=run.trigger,
        variables=run.variables or {},
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_ms=run.duration_ms,
        error=run.error,
        created_at=run.created_at,
        step_results=[
            StepResultResponse(
                step_index=r.step_index,
                step_type=r.step_type,
                status=r.status,
                started_at=r.started_at,
                finished_at=r.finished_at,
                request=r.request,
                response=r.response,
                assertions=r.assertions or [],
                captured=r.captured or {},
                error=r.error,
            )
            for r in results.scalars().all()
        ],
    )


@router.post("/workspaces/{short_id}/runs/{run_id}/cancel")
async def cancel_run_endpoint(
    short_id: str,
    run_id: uuid_module.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await _load(short_id, user, db, min_role="editor")
    result = await db.execute(
        select(ScenarioRun).where(
            ScenarioRun.id == run_id, ScenarioRun.workspace_id == workspace.id
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")

    if not await cancel_run(run, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Run has already finished with status {run.status!r}",
        )

    await db.commit()
    return {"status": run.status}
```

Note the asymmetry, which is deliberate: fetching a run needs `viewer`, cancelling needs `editor`, matching how the rest of the codebase gates reads against mutations.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_runs_api.py -q`

Expected: `7 passed`

- [ ] **Step 6: Run the whole suite**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `182 passed` (175 + 7)

- [ ] **Step 7: Confirm the app boots with the worker registered**

Run:

```bash
.venv/Scripts/python.exe -c "
from app.main import app
paths = sorted(r.path for r in app.routes if 'runs' in r.path or '/run' in r.path)
print('\n'.join(paths))
"
```

Expected: the three run paths are listed.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/scenario_run.py backend/app/api/v1/scenarios.py backend/tests/test_scenario_runs_api.py
git commit -m "feat(scenarios): add the run API"
```

---

## What this plan does not do

- No `send_webhook`, `wait_for_webhook` or `wait_for_email` — Plan 2c, together with the pub/sub-plus-polling wait machinery those need.
- No webhook signing — design §9, deferred to v2.
- **No connection pinning**, so the DNS-rebinding window documented in `ssrf_guard` stays open. `validate_url` returns the IP list for exactly this; it belongs in Plan 2c, before the engine is doing outbound requests at volume.
- **No streaming response reads.** `MAX_BODY_BYTES` still bounds storage rather than memory. Runs execute one step at a time and the v1 worker runs one run at a time, so the exposure is one response body at a time. That reasoning stops holding the moment the worker gains concurrency, which is the point at which streaming must land.
- No run-history retention. Step results carry full request and response payloads and will dominate storage; this joins the retention job that captures, mock logs and emails also need.
- No frontend — Plan 3.
