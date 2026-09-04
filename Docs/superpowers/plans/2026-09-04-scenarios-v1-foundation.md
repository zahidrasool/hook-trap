# Scenarios v1 — Plan 1: Foundation & URL Namespace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scenarios exist as first-class rows with their own URL namespace, so a mock attached to a scenario serves at `/s/{scenario_short_id}/{path}` while inheriting the workspace's shared mocks as a fallback.

**Architecture:** Three new tables (`scenarios`, `scenario_runs`, `scenario_step_results`) plus a nullable `scenario_id` on the existing `mock_endpoints` and `endpoints` tables. Serving reuses the entire existing mock pipeline — the only change is a two-pass lookup filter, not a parallel serving path. No execution engine in this plan; runs are tables only, and the worker arrives in Plan 2.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async + asyncpg, PostgreSQL 17, pytest + pytest-asyncio.

## Global Constraints

- Backend Python runs from `backend/.venv`. All commands below assume cwd `D:\Personal\etc\HookTrap\backend`.
- Tests run against PostgreSQL, database `mocklane_test`, URL `postgresql+asyncpg://postgres:postgres@localhost:5432/mocklane_test`. SQLite is not supported — `JSONB` cannot compile on it, and Plan 2 needs `FOR UPDATE SKIP LOCKED`.
- **Tests must never make outbound network calls.** The current suite issues a live Amazon SES `SendEmail` with whatever AWS credentials are ambient. Ambient credentials on this machine have previously pointed at the wrong AWS account, so this is closed in Task 1 and must stay closed.
- Schema changes are applied two ways, both required: declared on the model (for `Base.metadata.create_all` on a fresh database) **and** as an idempotent `ALTER` / `CREATE INDEX IF NOT EXISTS` in the `migrations` list in `app/main.py`'s `lifespan` (for the existing production database). Alembic is supplementary and is not used here.
- Every new column added to an existing table is nullable with no backfill. Existing rows must be unaffected.
- Path prefixes are load-bearing: `/m/` = workspace mocks, `/s/` = scenario mocks, `/h/` = webhook capture. Middleware that special-cases `/m/` must be extended to `/s/`, never replaced with a blanket rule.
- New status columns carry a `CheckConstraint`, matching the existing `workspace_members.role` convention.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `backend/app/models/scenario.py` | `Scenario`, `ScenarioRun`, `ScenarioStepResult` ORM models |
| `backend/app/schemas/scenario.py` | Pydantic request/response shapes for the scenario API |
| `backend/app/services/scenario_service.py` | short_id/slug allocation, scenario creation incl. capture endpoint |
| `backend/app/api/v1/scenarios.py` | Scenario CRUD + scenario-scoped mock routes |
| `backend/tests/test_scenario_models.py` | Table, constraint and cascade behaviour |
| `backend/tests/test_scenario_service.py` | Identity allocation and capture endpoint |
| `backend/tests/test_scenarios_crud.py` | Scenario API |
| `backend/tests/test_scenario_mocks.py` | Mock ownership split |
| `backend/tests/test_scenario_serve.py` | `/s/{short_id}/{path}` serving and fallback |

**Modified**

| File | Change |
| --- | --- |
| `backend/tests/conftest.py` | Postgres test DB, outbound-email stub, workspace fixture |
| `backend/requirements-dev.txt` | add `asyncpg` |
| `backend/app/models/__init__.py` | register the three new models |
| `backend/app/models/mock_endpoint.py` | `scenario_id` column, partial unique indexes replacing the 3-column constraint |
| `backend/app/models/endpoint.py` | `scenario_id` column + relationship |
| `backend/app/models/workspace.py` | `scenarios` relationship |
| `backend/app/main.py` | migrations; extend `/m/` middleware to `/s/` |
| `backend/app/api/v1/router.py` | mount the scenarios router |
| `backend/app/services/mock_service.py` | workspace lookup excludes scenario mocks; add scenario lookup |
| `backend/app/api/v1/mocks.py` | workspace mock list/create excludes scenario mocks; URL builder learns `/s/` |
| `backend/app/schemas/mock.py` | `scenario_id` on the mock response |
| `backend/app/api/mock_serve.py` | extract shared handler, add the `/s/` route |

---

### Task 1: Make the test suite actually run

The suite has never executed. `conftest.py` points at SQLite, where `JSONB` fails to compile, so all five real tests error before running. Nothing in this plan can be test-driven until this is fixed.

**Note:** the `conftest.py` database URL swap described in Step 1 is **already applied** in the working tree and verified — 4 of 5 tests pass. Confirm it is present rather than re-applying it, then continue from Step 2.

**Files:**
- Modify: `backend/tests/conftest.py`
- Modify: `backend/requirements-dev.txt`

**Interfaces:**
- Produces: fixtures `db_engine`, `db_session`, `client`, `test_user`, `auth_headers` (all pre-existing), plus new `test_workspace` and autouse `no_outbound_email`.

- [ ] **Step 1: Point the test database at Postgres**

Create the database once (it may already exist):

```bash
.venv/Scripts/python.exe -c "
import asyncio, asyncpg
async def m():
    c = await asyncpg.connect(host='localhost', port=5432, user='postgres', password='postgres', database='postgres')
    try:
        await c.execute('CREATE DATABASE mocklane_test')
        print('created')
    except asyncpg.DuplicateDatabaseError:
        print('already exists')
    await c.close()
asyncio.run(m())
"
```

In `backend/tests/conftest.py`, the URL and engine must read:

```python
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/mocklane_test"


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
```

Also replace the stale comment `# Use SQLite for tests (or a test postgres)` with:

```python
# Tests run against a real Postgres database. SQLite is not an option: JSONB
# does not compile on it, and the scenario run queue needs FOR UPDATE SKIP
# LOCKED, which SQLite has no equivalent for.
```

- [ ] **Step 2: Run the suite to see the one remaining failure**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `1 failed, 4 passed`. The failure is `tests/test_auth.py::test_magic_link_request`, asserting `502 == 200`, caused by a live SES `SendEmail` rejected because the address is not verified.

- [ ] **Step 3: Stub outbound email in the test harness**

A test that reaches AWS is both a correctness problem and a safety problem — it depends on network state and on whichever AWS credentials happen to be ambient. Add to `backend/tests/conftest.py`:

```python
@pytest.fixture(autouse=True)
def no_outbound_email(monkeypatch):
    """No test may send real mail.

    The magic-link endpoint calls Amazon SES, which fails in CI and — worse —
    succeeds against whatever AWS credentials are ambient. Every test runs with
    delivery stubbed out; assertions look at the token, not the inbox.
    """

    async def _noop(to, subject, html, *, required):
        return True

    monkeypatch.setattr("app.services.email_service._send", _noop)
```

- [ ] **Step 4: Run the suite to verify it is green**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `5 passed`

- [ ] **Step 5: Add a reusable workspace fixture**

Every later task needs a workspace. Append to `backend/tests/conftest.py`:

```python
@pytest_asyncio.fixture
async def test_workspace(db_session: AsyncSession, test_user: User):
    from app.services.workspace_service import create_workspace

    workspace = await create_workspace("Test Workspace", None, test_user, db_session)
    await db_session.commit()
    return workspace
```

- [ ] **Step 6: Record the test dependencies**

`backend/requirements-dev.txt` must list what the harness actually needs. Replace its contents with:

```
-r requirements.txt

pytest>=8.0.0
pytest-asyncio>=0.23.0
pytest-cov>=5.0.0
httpx>=0.27.0
asyncpg>=0.29.0
black>=24.0.0
ruff>=0.4.0
mypy>=1.10.0
```

- [ ] **Step 7: Run the suite once more and commit**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `5 passed`

```bash
git add backend/tests/conftest.py backend/requirements-dev.txt
git commit -m "test: run the suite against postgres and stop it sending real mail"
```

---

### Task 2: Scenario tables and the mock ownership split

**Files:**
- Create: `backend/app/models/scenario.py`
- Create: `backend/tests/test_scenario_models.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/mock_endpoint.py`
- Modify: `backend/app/models/endpoint.py`
- Modify: `backend/app/models/workspace.py`
- Modify: `backend/app/main.py` (the `migrations` list in `lifespan`, around line 24)

**Interfaces:**
- Produces: `Scenario` (fields `id, workspace_id, short_id, name, slug, description, steps, variables, timeout_seconds, is_active, created_by`), `ScenarioRun`, `ScenarioStepResult`; `MockEndpoint.scenario_id: uuid.UUID | None`; `Endpoint.scenario_id: uuid.UUID | None`.

All three tables land in one migration even though only `scenarios` gets API surface in this plan. The run tables are pure schema, cost nothing to carry, and splitting the migration across two plans would mean altering `mock_endpoints` twice.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_models.py`:

```python
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.mock_endpoint import MockEndpoint
from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult


async def _make_scenario(db, workspace, *, slug="checkout", short_id="scn0000001"):
    scenario = Scenario(
        workspace_id=workspace.id,
        short_id=short_id,
        name="Checkout",
        slug=slug,
        steps=[{"type": "delay", "seconds": 1}],
        variables={"baseUrl": "https://example.com"},
    )
    db.add(scenario)
    await db.flush()
    return scenario


@pytest.mark.asyncio
async def test_scenario_persists_steps_as_json(db_session, test_workspace):
    scenario = await _make_scenario(db_session, test_workspace)
    await db_session.refresh(scenario)

    assert scenario.steps == [{"type": "delay", "seconds": 1}]
    assert scenario.variables == {"baseUrl": "https://example.com"}
    assert scenario.timeout_seconds == 120
    assert scenario.is_active is True


@pytest.mark.asyncio
async def test_slug_is_unique_per_workspace(db_session, test_workspace):
    await _make_scenario(db_session, test_workspace, slug="dup", short_id="scn0000002")

    # _make_scenario flushes internally, so the violation surfaces from the
    # second call itself rather than from a later flush.
    with pytest.raises(IntegrityError):
        await _make_scenario(db_session, test_workspace, slug="dup", short_id="scn0000003")
    await db_session.rollback()


@pytest.mark.asyncio
async def test_two_workspace_mocks_cannot_share_path_and_method(db_session, test_workspace):
    for _ in range(2):
        db_session.add(
            MockEndpoint(workspace_id=test_workspace.id, path="/users", method="GET")
        )

    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_a_scenario_mock_may_shadow_a_workspace_mock(db_session, test_workspace):
    """The whole point of scenario scoping: same path, different owner."""
    scenario = await _make_scenario(db_session, test_workspace, short_id="scn0000004")

    db_session.add(MockEndpoint(workspace_id=test_workspace.id, path="/users", method="GET"))
    db_session.add(
        MockEndpoint(
            workspace_id=test_workspace.id,
            scenario_id=scenario.id,
            path="/users",
            method="GET",
        )
    )
    await db_session.flush()

    mocks = (await db_session.execute(select(MockEndpoint))).scalars().all()
    assert len(mocks) == 2


@pytest.mark.asyncio
async def test_two_mocks_in_one_scenario_cannot_share_path_and_method(db_session, test_workspace):
    scenario = await _make_scenario(db_session, test_workspace, short_id="scn0000005")

    for _ in range(2):
        db_session.add(
            MockEndpoint(
                workspace_id=test_workspace.id,
                scenario_id=scenario.id,
                path="/users",
                method="GET",
            )
        )

    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_deleting_a_run_deletes_its_step_results(db_session, test_workspace):
    scenario = await _make_scenario(db_session, test_workspace, short_id="scn0000006")
    run = ScenarioRun(
        scenario_id=scenario.id, workspace_id=test_workspace.id, status="pending"
    )
    db_session.add(run)
    await db_session.flush()

    db_session.add(
        ScenarioStepResult(
            run_id=run.id, step_index=0, step_type="delay", status="passed"
        )
    )
    await db_session.flush()

    await db_session.delete(run)
    await db_session.flush()

    remaining = (await db_session.execute(select(ScenarioStepResult))).scalars().all()
    assert remaining == []
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_models.py -q`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.scenario'`

- [ ] **Step 3: Create the scenario models**

Create `backend/app/models/scenario.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Scenario(BaseModel):
    """A named, ordered workflow across mocks, captures and inboxes.

    `steps` is a JSONB document rather than a child table because steps are
    always read and written whole, never queried individually, and keeping them
    inline makes edit-and-save atomic.
    """

    __tablename__ = "scenarios"
    __table_args__ = (UniqueConstraint("workspace_id", "slug"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    short_id: Mapped[str] = mapped_column(String(12), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    variables: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    workspace = relationship("Workspace", back_populates="scenarios")
    # cascade="all, delete-orphan" is the load-bearing part. Both scenario_id
    # columns are nullable, so a relationship WITHOUT it de-associates children
    # on delete — SQLAlchemy UPDATEs scenario_id to NULL rather than deleting —
    # which would silently turn a deleted scenario's mocks into workspace mocks
    # and leak them onto /m/. Do not drop it.
    #
    # passive_deletes=True is an optimisation on top: it stops SQLAlchemy
    # loading every child just to DELETE it one row at a time, and defers to
    # the ON DELETE CASCADE already declared on both foreign keys.
    runs = relationship(
        "ScenarioRun",
        back_populates="scenario",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    mock_endpoints = relationship(
        "MockEndpoint",
        back_populates="scenario",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    capture_endpoints = relationship(
        "Endpoint",
        back_populates="scenario",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ScenarioRun(BaseModel):
    __tablename__ = "scenario_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'running', 'passed', 'failed', 'error', 'timeout', 'cancelled')",
            name="ck_scenario_runs_status",
        ),
    )

    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Denormalised: run listing and quota counting are the two hottest queries
    # and both would otherwise join through scenarios.
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    trigger: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    variables: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Engine or network fault, deliberately distinct from an assertion failing.
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    scenario = relationship("Scenario", back_populates="runs")
    step_results = relationship(
        "ScenarioStepResult",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="ScenarioStepResult.step_index",
    )


class ScenarioStepResult(BaseModel):
    """Per-step outcome, including what we sent and what came back.

    Storing request and response is what makes a failed run debuggable; a red X
    with no payload is useless.
    """

    __tablename__ = "scenario_step_results"
    __table_args__ = (
        CheckConstraint(
            "status IN ('passed', 'failed', 'skipped', 'error', 'timeout')",
            name="ck_scenario_step_results_status",
        ),
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenario_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    request: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # The capture or email row that satisfied a wait step.
    matched_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    assertions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    captured: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    run = relationship("ScenarioRun", back_populates="step_results")
```

- [ ] **Step 4: Register the models**

In `backend/app/models/__init__.py`, add the import after the `sandbox_email` import:

```python
from app.models.scenario import Scenario, ScenarioRun, ScenarioStepResult
```

and add to `__all__`:

```python
    "Scenario",
    "ScenarioRun",
    "ScenarioStepResult",
```

- [ ] **Step 5: Split mock ownership between workspace and scenario**

In `backend/app/models/mock_endpoint.py`, replace the SQLAlchemy import line with:

```python
from sqlalchemy import String, Text, Integer, Float, Boolean, ForeignKey, Index, text
```

Replace `__table_args__` with two partial unique indexes:

```python
    # A plain UniqueConstraint on (workspace_id, path, method) cannot survive
    # scenario scoping: NULLs compare as distinct in Postgres, so adding
    # scenario_id to it would silently stop guarding workspace mocks. Two
    # partial indexes keep the old guarantee and add the scenario one.
    __table_args__ = (
        Index(
            "uq_mock_workspace_path_method",
            "workspace_id",
            "path",
            "method",
            unique=True,
            postgresql_where=text("scenario_id IS NULL"),
        ),
        Index(
            "uq_mock_scenario_path_method",
            "scenario_id",
            "path",
            "method",
            unique=True,
            postgresql_where=text("scenario_id IS NOT NULL"),
        ),
    )
```

Add the column immediately after `workspace_id`:

```python
    # NULL means the mock belongs to the workspace and serves at /m/.
    # Set means it belongs to one scenario and serves at /s/.
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=True, index=True
    )
```

Add to the relationships block:

```python
    scenario = relationship("Scenario", back_populates="mock_endpoints")
```

- [ ] **Step 6: Give capture endpoints a scenario owner**

In `backend/app/models/endpoint.py`, add after `user_id`:

```python
    scenario_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=True, index=True
    )
```

and to the relationships block:

```python
    scenario = relationship("Scenario", back_populates="capture_endpoints")
```

In `backend/app/models/workspace.py`, add to the `Workspace` relationships block:

```python
    scenarios = relationship("Scenario", back_populates="workspace", cascade="all, delete-orphan")
```

- [ ] **Step 7: Add the production migrations**

In `backend/app/main.py`, append to the `migrations` list inside `lifespan` (after the `users` ALTERs):

```python
            # Scenarios. create_all above makes the three new tables; these
            # statements cover the existing mock_endpoints and endpoints tables,
            # which create_all will not alter.
            "ALTER TABLE mock_endpoints ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE",
            "ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE",
            "ALTER TABLE mock_endpoints DROP CONSTRAINT IF EXISTS mock_endpoints_workspace_id_path_method_key",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_mock_workspace_path_method "
            "ON mock_endpoints (workspace_id, path, method) WHERE scenario_id IS NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_mock_scenario_path_method "
            "ON mock_endpoints (scenario_id, path, method) WHERE scenario_id IS NOT NULL",
            "CREATE INDEX IF NOT EXISTS ix_mock_endpoints_scenario_id ON mock_endpoints (scenario_id)",
            "CREATE INDEX IF NOT EXISTS ix_endpoints_scenario_id ON endpoints (scenario_id)",
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_models.py -q`

Expected: `6 passed`

- [ ] **Step 9: Run the whole suite to check nothing regressed**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `11 passed`

- [ ] **Step 10: Commit**

```bash
git add backend/app/models/ backend/app/main.py backend/tests/test_scenario_models.py
git commit -m "feat(scenarios): add scenario tables and scope mocks to a scenario"
```

---

### Task 3: Scenario creation — short_id, slug, capture endpoint

**Files:**
- Create: `backend/app/services/scenario_service.py`
- Create: `backend/tests/test_scenario_service.py`

**Interfaces:**
- Consumes: `Scenario` from Task 2; `generate_short_id` from `app.utils.short_id`.
- Produces:
  - `slugify(name: str) -> str`
  - `async allocate_short_id(db: AsyncSession) -> str`
  - `async allocate_slug(workspace_id: uuid.UUID, name: str, db: AsyncSession) -> str`
  - `async create_scenario(workspace, name: str, description: str | None, user, db: AsyncSession) -> Scenario`
  - `async get_scenario_by_slug(workspace_id: uuid.UUID, slug: str, db: AsyncSession) -> Scenario | None`
  - `async get_scenario_by_short_id(short_id: str, db: AsyncSession) -> Scenario | None`
  - `async get_capture_endpoint(scenario_id: uuid.UUID, db: AsyncSession) -> Endpoint | None`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_service.py`:

```python
import pytest
from sqlalchemy import select

from app.models.endpoint import Endpoint
from app.services.scenario_service import (
    create_scenario,
    get_capture_endpoint,
    get_scenario_by_short_id,
    get_scenario_by_slug,
    slugify,
)


def test_slugify_lowercases_and_hyphenates():
    assert slugify("Successful Checkout") == "successful-checkout"
    assert slugify("Payment  //  Retry!") == "payment-retry"
    assert slugify("---Edge---") == "edge"


def test_slugify_falls_back_when_nothing_survives():
    assert slugify("!!!") == "scenario"


@pytest.mark.asyncio
async def test_create_scenario_allocates_identity(db_session, test_workspace, test_user):
    scenario = await create_scenario(
        test_workspace, "Successful Checkout", "happy path", test_user, db_session
    )

    assert scenario.slug == "successful-checkout"
    assert len(scenario.short_id) == 10
    assert scenario.workspace_id == test_workspace.id
    assert scenario.created_by == test_user.id
    assert scenario.steps == []
    assert scenario.variables == {}


@pytest.mark.asyncio
async def test_duplicate_names_get_distinct_slugs(db_session, test_workspace, test_user):
    first = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)
    second = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)
    third = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)

    assert [first.slug, second.slug, third.slug] == ["checkout", "checkout-2", "checkout-3"]


@pytest.mark.asyncio
async def test_create_scenario_allocates_a_capture_endpoint(db_session, test_workspace, test_user):
    scenario = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)

    endpoint = await get_capture_endpoint(scenario.id, db_session)
    assert endpoint is not None
    assert endpoint.scenario_id == scenario.id
    assert endpoint.user_id == test_user.id
    assert len(endpoint.short_id) == 10


@pytest.mark.asyncio
async def test_lookup_by_slug_and_short_id(db_session, test_workspace, test_user):
    scenario = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)

    by_slug = await get_scenario_by_slug(test_workspace.id, "checkout", db_session)
    by_short_id = await get_scenario_by_short_id(scenario.short_id, db_session)

    assert by_slug.id == scenario.id
    assert by_short_id.id == scenario.id
    assert await get_scenario_by_slug(test_workspace.id, "nope", db_session) is None
    assert await get_scenario_by_short_id("nope", db_session) is None


@pytest.mark.asyncio
async def test_deleting_a_scenario_removes_its_capture_endpoint(db_session, test_workspace, test_user):
    scenario = await create_scenario(test_workspace, "Checkout", None, test_user, db_session)

    await db_session.delete(scenario)
    await db_session.flush()

    endpoints = (await db_session.execute(select(Endpoint))).scalars().all()
    assert endpoints == []
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_service.py -q`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.scenario_service'`

- [ ] **Step 3: Write the service**

Create `backend/app/services/scenario_service.py`:

```python
"""Scenario identity and creation.

A scenario owns a URL namespace, so creating one allocates two addresses at
once: a `short_id` for its mocks at /s/{short_id}/... and a capture endpoint
for its inbound webhooks at /h/{endpoint_short_id}. Allocating the capture
endpoint eagerly means `wait_for_webhook` always has somewhere to wait, with no
lazy-creation race inside the run.
"""

import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.endpoint import Endpoint
from app.models.scenario import Scenario
from app.utils.short_id import generate_short_id


def slugify(name: str) -> str:
    """URL-safe slug from a display name."""
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return slug[:120] or "scenario"


async def allocate_short_id(db: AsyncSession) -> str:
    """A globally unique short_id. Collisions are vanishingly rare; retry anyway."""
    for _ in range(10):
        candidate = generate_short_id()
        existing = await db.execute(
            select(Scenario.id).where(Scenario.short_id == candidate)
        )
        if existing.scalar_one_or_none() is None:
            return candidate
    raise RuntimeError("Could not allocate a unique scenario short_id")


async def allocate_slug(workspace_id: uuid.UUID, name: str, db: AsyncSession) -> str:
    """Slug unique within the workspace, suffixed when the base is taken."""
    base = slugify(name)
    result = await db.execute(
        select(Scenario.slug).where(Scenario.workspace_id == workspace_id)
    )
    taken = set(result.scalars().all())

    if base not in taken:
        return base
    for suffix in range(2, 1000):
        candidate = f"{base}-{suffix}"
        if candidate not in taken:
            return candidate
    raise RuntimeError("Could not allocate a unique scenario slug")


async def create_scenario(
    workspace,
    name: str,
    description: str | None,
    user,
    db: AsyncSession,
) -> Scenario:
    scenario = Scenario(
        workspace_id=workspace.id,
        short_id=await allocate_short_id(db),
        name=name,
        slug=await allocate_slug(workspace.id, name, db),
        description=description,
        steps=[],
        variables={},
        created_by=user.id,
    )
    db.add(scenario)
    await db.flush()

    capture_endpoint = Endpoint(
        user_id=user.id,
        scenario_id=scenario.id,
        short_id=generate_short_id(),
        # Endpoint.name is VARCHAR(200) and so is Scenario.name, so the
        # derived name has to be bounded or a long scenario name overflows
        # the column and the flush below dies with a DataError.
        name=f"{name[:189]} (scenario)",
        description="Capture endpoint owned by a scenario.",
    )
    db.add(capture_endpoint)
    await db.flush()
    await db.refresh(scenario)
    return scenario


async def get_scenario_by_slug(
    workspace_id: uuid.UUID, slug: str, db: AsyncSession
) -> Scenario | None:
    result = await db.execute(
        select(Scenario).where(
            Scenario.workspace_id == workspace_id,
            Scenario.slug == slug,
        )
    )
    return result.scalar_one_or_none()


async def get_scenario_by_short_id(short_id: str, db: AsyncSession) -> Scenario | None:
    result = await db.execute(select(Scenario).where(Scenario.short_id == short_id))
    return result.scalar_one_or_none()


async def get_capture_endpoint(scenario_id: uuid.UUID, db: AsyncSession) -> Endpoint | None:
    result = await db.execute(
        select(Endpoint).where(Endpoint.scenario_id == scenario_id).limit(1)
    )
    return result.scalar_one_or_none()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_service.py -q`

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/scenario_service.py backend/tests/test_scenario_service.py
git commit -m "feat(scenarios): allocate a short_id, slug and capture endpoint per scenario"
```

---

### Task 4: Scenario CRUD API

**Files:**
- Create: `backend/app/schemas/scenario.py`
- Create: `backend/app/api/v1/scenarios.py`
- Create: `backend/tests/test_scenarios_crud.py`
- Modify: `backend/app/api/v1/router.py`

**Interfaces:**
- Consumes: `create_scenario`, `allocate_slug`, `get_scenario_by_slug`, `get_capture_endpoint` from Task 3; `get_workspace_by_short_id`, `check_workspace_access` from `app.services.workspace_service`.
- Produces: router mounted with no prefix; `_load_scenario(short_id, slug, user, db, *, min_role) -> tuple[Workspace, Scenario]` reused by Task 5; `ScenarioResponse` carrying `scenario_url` and `capture_url`.

Runs are not exposed here — `/run`, `/runs/{id}` and `/cancel` arrive in Plan 2 with the engine behind them.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenarios_crud.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_create_scenario(client, auth_headers, test_workspace):
    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Successful Checkout", "description": "happy path"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Successful Checkout"
    assert data["slug"] == "successful-checkout"
    assert data["steps"] == []
    assert data["is_active"] is True
    assert data["scenario_url"].endswith(f"/s/{data['short_id']}")
    assert "/h/" in data["capture_url"]


@pytest.mark.asyncio
async def test_list_scenarios(client, auth_headers, test_workspace):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "One"},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Two"},
    )

    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert {s["slug"] for s in data["scenarios"]} == {"one", "two"}


@pytest.mark.asyncio
async def test_get_scenario_by_slug(client, auth_headers, test_workspace):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Checkout"


@pytest.mark.asyncio
async def test_update_scenario_steps(client, auth_headers, test_workspace):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    steps = [{"type": "delay", "seconds": 2}]
    response = await client.patch(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
        json={"steps": steps, "timeout_seconds": 60},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["steps"] == steps
    assert data["timeout_seconds"] == 60


@pytest.mark.asyncio
async def test_renaming_reassigns_the_slug_but_keeps_the_short_id(client, auth_headers, test_workspace):
    created = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    short_id = created.json()["short_id"]

    response = await client.patch(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
        json={"name": "Refund Flow"},
    )

    data = response.json()
    assert data["slug"] == "refund-flow"
    assert data["short_id"] == short_id


@pytest.mark.asyncio
async def test_delete_scenario(client, auth_headers, test_workspace):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    response = await client.delete(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
    )
    assert response.status_code == 204

    follow_up = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
    )
    assert follow_up.status_code == 404


@pytest.mark.asyncio
async def test_scenario_routes_require_authentication(client, test_workspace):
    response = await client.get(f"/api/v1/workspaces/{test_workspace.short_id}/scenarios")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unknown_scenario_is_404(client, auth_headers, test_workspace):
    response = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/nope", headers=auth_headers
    )
    assert response.status_code == 404
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenarios_crud.py -q`

Expected: FAIL — every request returns 404, since no scenario routes are mounted.

- [ ] **Step 3: Write the schemas**

Create `backend/app/schemas/scenario.py`:

```python
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class ScenarioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    steps: list | None = None
    variables: dict | None = None
    timeout_seconds: int | None = Field(default=None, ge=1, le=3600)
    is_active: bool | None = None


class ScenarioResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    short_id: str
    name: str
    slug: str
    description: str | None
    steps: list
    variables: dict
    timeout_seconds: int
    is_active: bool
    # Where this scenario's mocks serve, and where its webhooks land.
    scenario_url: str
    capture_url: str | None
    created_at: datetime


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioResponse]
    total: int
```

- [ ] **Step 4: Write the routes**

Create `backend/app/api/v1/scenarios.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.db.database import get_db
from app.models.scenario import Scenario
from app.models.user import User
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListResponse,
    ScenarioResponse,
    ScenarioUpdate,
)
from app.services.scenario_service import (
    allocate_slug,
    create_scenario,
    get_capture_endpoint,
    get_scenario_by_slug,
)
from app.services.workspace_service import (
    check_workspace_access,
    get_workspace_by_short_id,
)

router = APIRouter()


async def _to_response(scenario: Scenario, db: AsyncSession) -> ScenarioResponse:
    settings = get_settings()
    capture_endpoint = await get_capture_endpoint(scenario.id, db)
    return ScenarioResponse(
        id=scenario.id,
        workspace_id=scenario.workspace_id,
        short_id=scenario.short_id,
        name=scenario.name,
        slug=scenario.slug,
        description=scenario.description,
        steps=scenario.steps or [],
        variables=scenario.variables or {},
        timeout_seconds=scenario.timeout_seconds,
        is_active=scenario.is_active,
        scenario_url=f"{settings.api_base_url}/s/{scenario.short_id}",
        capture_url=(
            f"{settings.api_base_url}/h/{capture_endpoint.short_id}"
            if capture_endpoint
            else None
        ),
        created_at=scenario.created_at,
    )


async def _load(short_id: str, user: User, db: AsyncSession, *, min_role: str):
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role=min_role)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=f"{min_role.title()} access required"
        )
    return workspace


async def _load_scenario(short_id: str, slug: str, user: User, db: AsyncSession, *, min_role: str):
    workspace = await _load(short_id, user, db, min_role=min_role)
    scenario = await get_scenario_by_slug(workspace.id, slug, db)
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    return workspace, scenario


@router.post(
    "/workspaces/{short_id}/scenarios",
    status_code=status.HTTP_201_CREATED,
    response_model=ScenarioResponse,
)
async def create_scenario_endpoint(
    short_id: str,
    body: ScenarioCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await _load(short_id, user, db, min_role="editor")

    # allocate_slug reads the taken slugs and then inserts, so two concurrent
    # creates of the same name in one workspace can both pick the same slug —
    # a double-clicked submit button is enough. The unique constraint catches
    # it; without this the caller would see a 500 instead of an honest 409.
    try:
        scenario = await create_scenario(workspace, body.name, body.description, user, db)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That scenario name was just taken. Try again.",
        )

    await db.refresh(scenario)
    return await _to_response(scenario, db)


@router.get("/workspaces/{short_id}/scenarios", response_model=ScenarioListResponse)
async def list_scenarios(
    short_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace = await _load(short_id, user, db, min_role="viewer")
    result = await db.execute(
        select(Scenario)
        .where(Scenario.workspace_id == workspace.id)
        .order_by(Scenario.created_at.desc())
    )
    scenarios = list(result.scalars().all())
    return ScenarioListResponse(
        scenarios=[await _to_response(s, db) for s in scenarios],
        total=len(scenarios),
    )


@router.get("/workspaces/{short_id}/scenarios/{slug}", response_model=ScenarioResponse)
async def get_scenario(
    short_id: str,
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, scenario = await _load_scenario(short_id, slug, user, db, min_role="viewer")
    return await _to_response(scenario, db)


@router.patch("/workspaces/{short_id}/scenarios/{slug}", response_model=ScenarioResponse)
async def update_scenario(
    short_id: str,
    slug: str,
    body: ScenarioUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace, scenario = await _load_scenario(short_id, slug, user, db, min_role="editor")

    fields = body.model_dump(exclude_unset=True)
    # Renaming re-derives the slug, which is the CLI's address for this
    # scenario. The short_id never changes, so any URL already in use keeps
    # working.
    if "name" in fields and fields["name"] != scenario.name:
        scenario.slug = await allocate_slug(workspace.id, fields["name"], db)

    for field, value in fields.items():
        setattr(scenario, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(scenario)
    return await _to_response(scenario, db)


@router.delete(
    "/workspaces/{short_id}/scenarios/{slug}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_scenario(
    short_id: str,
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, scenario = await _load_scenario(short_id, slug, user, db, min_role="editor")
    await db.delete(scenario)
    await db.commit()
```

- [ ] **Step 5: Mount the router**

In `backend/app/api/v1/router.py`, add the import after the `admin` import:

```python
from app.api.v1.scenarios import router as scenarios_router
```

and mount it after the `mocks` router:

```python
api_router.include_router(scenarios_router, tags=["scenarios"])
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenarios_crud.py -q`

Expected: `8 passed`

- [ ] **Step 7: Run the whole suite and commit**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `29 passed`

```bash
git add backend/app/schemas/scenario.py backend/app/api/v1/scenarios.py backend/app/api/v1/router.py backend/tests/test_scenarios_crud.py
git commit -m "feat(scenarios): add scenario CRUD"
```

---

### Task 5: Attaching mocks to a scenario

A mock now belongs either to the workspace or to one scenario. Both directions matter: scenario mocks must not leak into the workspace's mock list or its `/m/` serving, and the workspace's mocks must stay exactly as they are.

**Files:**
- Modify: `backend/app/services/mock_service.py` (`get_active_mocks_for_workspace`, around line 19)
- Modify: `backend/app/api/v1/mocks.py` (`_build_mock_url` and `_mock_to_response` around lines 38-66; `create_mock_endpoint`; `list_mock_endpoints`)
- Modify: `backend/app/schemas/mock.py`
- Modify: `backend/app/api/v1/scenarios.py`
- Create: `backend/tests/test_scenario_mocks.py`

**Interfaces:**
- Consumes: `_load_scenario` from Task 4.
- Produces:
  - `async get_active_mocks_for_scenario(scenario_id, db) -> list[MockEndpoint]`
  - `get_active_mocks_for_workspace(workspace_id, db)` — signature unchanged, now excludes scenario mocks
  - `_build_mock_url(short_id: str, path: str, *, scenario: bool = False) -> str`
  - `_mock_to_response(mock, url_short_id: str, *, scenario: bool = False) -> MockEndpointResponse`
  - routes `POST` and `GET /workspaces/{short_id}/scenarios/{slug}/mocks`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_mocks.py`:

```python
import pytest


@pytest.fixture
def make_mock():
    def _payload(path="/users", method="GET", body='{"scope": "workspace"}'):
        return {"path": path, "method": method, "response_body": body}

    return _payload


@pytest.mark.asyncio
async def test_create_a_scenario_scoped_mock(client, auth_headers, test_workspace, make_mock):
    created = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    scenario_short_id = created.json()["short_id"]

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(body='{"scope": "scenario"}'),
    )

    assert response.status_code == 201
    data = response.json()
    assert data["scenario_id"] is not None
    assert f"/s/{scenario_short_id}/users" in data["mock_url"]


@pytest.mark.asyncio
async def test_scenario_mock_may_shadow_a_workspace_mock(client, auth_headers, test_workspace, make_mock):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json=make_mock(),
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(body='{"scope": "scenario"}'),
    )

    assert response.status_code == 201


@pytest.mark.asyncio
async def test_scenario_mocks_stay_out_of_the_workspace_list(client, auth_headers, test_workspace, make_mock):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json=make_mock(path="/shared"),
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(path="/scoped"),
    )

    workspace_list = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks", headers=auth_headers
    )
    scenario_list = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
    )

    assert [m["path"] for m in workspace_list.json()["mocks"]] == ["/shared"]
    assert [m["path"] for m in scenario_list.json()["mocks"]] == ["/scoped"]


@pytest.mark.asyncio
async def test_duplicate_path_within_one_scenario_is_409(client, auth_headers, test_workspace, make_mock):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(),
    )

    response = await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(),
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_deleting_a_scenario_deletes_its_mocks(client, auth_headers, test_workspace, make_mock):
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json=make_mock(path="/shared"),
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json=make_mock(path="/scoped"),
    )

    await client.delete(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout",
        headers=auth_headers,
    )

    workspace_list = await client.get(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks", headers=auth_headers
    )
    assert [m["path"] for m in workspace_list.json()["mocks"]] == ["/shared"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_mocks.py -q`

Expected: FAIL — the `/scenarios/checkout/mocks` routes return 404.

- [ ] **Step 3: Scope the mock lookups**

In `backend/app/services/mock_service.py`, replace `get_active_mocks_for_workspace` and add the scenario lookup beneath it:

```python
async def get_active_mocks_for_workspace(workspace_id, db: AsyncSession) -> list[MockEndpoint]:
    """Mocks shared across the workspace, served at /m/.

    Scenario-owned mocks are excluded: they belong to one scenario's namespace
    and must not answer on the workspace's URL.
    """
    result = await db.execute(
        select(MockEndpoint).where(
            MockEndpoint.workspace_id == workspace_id,
            MockEndpoint.scenario_id.is_(None),
            MockEndpoint.is_active == True,
        )
    )
    return list(result.scalars().all())


async def get_active_mocks_for_scenario(scenario_id, db: AsyncSession) -> list[MockEndpoint]:
    """Mocks owned by one scenario, served at /s/ ahead of the workspace's."""
    result = await db.execute(
        select(MockEndpoint).where(
            MockEndpoint.scenario_id == scenario_id,
            MockEndpoint.is_active == True,
        )
    )
    return list(result.scalars().all())
```

- [ ] **Step 4: Teach the mock response about scenarios**

In `backend/app/schemas/mock.py`, add to `MockEndpointResponse`, immediately after `workspace_id`:

```python
    scenario_id: uuid.UUID | None = None
```

In `backend/app/api/v1/mocks.py`, replace `_build_mock_url` and `_mock_to_response`:

```python
def _build_mock_url(short_id: str, path: str, *, scenario: bool = False) -> str:
    settings = get_settings()
    segment = "s" if scenario else "m"
    return f"{settings.api_base_url}/{segment}/{short_id}{path}"


def _mock_to_response(
    mock: MockEndpoint, url_short_id: str, *, scenario: bool = False
) -> MockEndpointResponse:
    return MockEndpointResponse(
        id=mock.id,
        workspace_id=mock.workspace_id,
        scenario_id=mock.scenario_id,
        path=mock.path,
        method=mock.method,
        name=mock.name,
        description=mock.description,
        mock_url=_build_mock_url(url_short_id, mock.path, scenario=scenario),
        is_active=mock.is_active,
        priority=mock.priority,
        response_status=mock.response_status,
        response_headers=mock.response_headers,
        response_body=mock.response_body,
        response_delay_ms=mock.response_delay_ms,
        error_rate=mock.error_rate,
        error_status=mock.error_status,
        error_body=mock.error_body,
        request_count=mock.request_count,
        static_data=mock.static_data,
        is_immutable=mock.is_immutable,
        created_at=mock.created_at,
    )
```

- [ ] **Step 5: Keep scenario mocks out of the workspace routes**

In `backend/app/api/v1/mocks.py`, the duplicate check inside `create_mock_endpoint` must restrict to workspace-owned mocks:

```python
    existing = await db.execute(
        select(MockEndpoint).where(
            MockEndpoint.workspace_id == workspace.id,
            MockEndpoint.scenario_id.is_(None),
            MockEndpoint.path == body.path,
            MockEndpoint.method == method,
        )
    )
```

Add the same `MockEndpoint.scenario_id.is_(None),` line to the `select(MockEndpoint)` `.where(...)` clause in `list_mock_endpoints`.

- [ ] **Step 6: Add the scenario mock routes**

In `backend/app/api/v1/scenarios.py`, add these imports:

```python
from app.api.v1.mocks import _mock_to_response
from app.models.mock_endpoint import MockEndpoint
from app.schemas.mock import (
    MockEndpointCreate,
    MockEndpointListResponse,
    MockEndpointResponse,
)
```

and append these routes:

```python
@router.post(
    "/workspaces/{short_id}/scenarios/{slug}/mocks",
    status_code=status.HTTP_201_CREATED,
    response_model=MockEndpointResponse,
)
async def create_scenario_mock(
    short_id: str,
    slug: str,
    body: MockEndpointCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workspace, scenario = await _load_scenario(short_id, slug, user, db, min_role="editor")
    method = body.method.upper()

    existing = await db.execute(
        select(MockEndpoint).where(
            MockEndpoint.scenario_id == scenario.id,
            MockEndpoint.path == body.path,
            MockEndpoint.method == method,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This scenario already defines {method} {body.path}",
        )

    mock = MockEndpoint(
        workspace_id=workspace.id,
        scenario_id=scenario.id,
        created_by=user.id,
        path=body.path,
        method=method,
        name=body.name,
        description=body.description,
        response_status=body.response_status,
        response_headers=body.response_headers or {"Content-Type": "application/json"},
        response_body=body.response_body,
        response_delay_ms=body.response_delay_ms,
        error_rate=body.error_rate,
        error_status=body.error_status,
        error_body=body.error_body,
        static_data=body.static_data,
        is_immutable=body.is_immutable,
    )
    db.add(mock)
    await db.flush()
    await db.commit()
    await db.refresh(mock)
    return _mock_to_response(mock, scenario.short_id, scenario=True)


@router.get(
    "/workspaces/{short_id}/scenarios/{slug}/mocks",
    response_model=MockEndpointListResponse,
)
async def list_scenario_mocks(
    short_id: str,
    slug: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, scenario = await _load_scenario(short_id, slug, user, db, min_role="viewer")
    result = await db.execute(
        select(MockEndpoint)
        .where(MockEndpoint.scenario_id == scenario.id)
        .order_by(MockEndpoint.created_at.desc())
    )
    mocks = list(result.scalars().all())
    return MockEndpointListResponse(
        mocks=[_mock_to_response(m, scenario.short_id, scenario=True) for m in mocks],
        total=len(mocks),
    )
```

Route ordering note: FastAPI matches in registration order, and `/workspaces/{short_id}/scenarios/{slug}` is registered before `/workspaces/{short_id}/scenarios/{slug}/mocks`. The paths differ in segment count, so there is no shadowing — but if a future route adds a `{slug}` sibling that could swallow `mocks`, register the literal segment first, the way the sandboxes router puts `check-prefix` ahead of `{sandbox_id}`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_mocks.py -q`

Expected: `5 passed`

If `MockEndpointListResponse` does not use the field names `mocks` and `total`, read `backend/app/schemas/mock.py` and match its actual field names in both the route and the test.

- [ ] **Step 8: Run the whole suite and commit**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `34 passed`

```bash
git add backend/app/services/mock_service.py backend/app/api/v1/mocks.py backend/app/api/v1/scenarios.py backend/app/schemas/mock.py backend/tests/test_scenario_mocks.py
git commit -m "feat(scenarios): let a scenario own mocks separately from its workspace"
```

---

### Task 6: Serving at `/s/{scenario_short_id}/{path}`

The last piece: scenario mocks become reachable. This reuses the entire existing pipeline — rules, sequences, templates, error simulation, quota, logging — by extracting the handler body and changing only which mocks it looks at.

**Files:**
- Modify: `backend/app/api/mock_serve.py`
- Modify: `backend/app/main.py` (`limit_public_ingest` and `allow_any_origin_for_mocks`)
- Create: `backend/tests/test_scenario_serve.py`

**Interfaces:**
- Consumes: `get_active_mocks_for_scenario` from Task 5, `get_scenario_by_short_id` from Task 3.
- Produces: route `/s/{scenario_short_id}/{path:path}`; internal `async _serve(request, path, workspace, scenario, db) -> Response` and `_preflight_response(request) -> Response`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_serve.py`:

```python
import pytest


async def _make_scenario(client, auth_headers, workspace):
    created = await client.post(
        f"/api/v1/workspaces/{workspace.short_id}/scenarios",
        headers=auth_headers,
        json={"name": "Checkout"},
    )
    return created.json()["short_id"]


@pytest.mark.asyncio
async def test_scenario_mock_serves_on_its_own_url(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json={"path": "/payments", "method": "GET", "response_body": '{"scope": "scenario"}'},
    )

    response = await client.get(f"/s/{scenario_short_id}/payments")

    assert response.status_code == 200
    assert response.json() == {"scope": "scenario"}


@pytest.mark.asyncio
async def test_scenario_falls_back_to_workspace_mocks(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json={"path": "/shared", "method": "GET", "response_body": '{"scope": "workspace"}'},
    )

    response = await client.get(f"/s/{scenario_short_id}/shared")

    assert response.status_code == 200
    assert response.json() == {"scope": "workspace"}


@pytest.mark.asyncio
async def test_scenario_mock_overrides_the_workspace_mock(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/mocks",
        headers=auth_headers,
        json={"path": "/payments", "method": "GET", "response_body": '{"scope": "workspace"}'},
    )
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json={"path": "/payments", "method": "GET", "response_body": '{"scope": "scenario"}'},
    )

    on_scenario = await client.get(f"/s/{scenario_short_id}/payments")
    on_workspace = await client.get(f"/m/{test_workspace.short_id}/payments")

    assert on_scenario.json() == {"scope": "scenario"}
    # The workspace URL is untouched. This is the isolation guarantee.
    assert on_workspace.json() == {"scope": "workspace"}


@pytest.mark.asyncio
async def test_scenario_mock_is_not_served_on_the_workspace_url(client, auth_headers, test_workspace):
    await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json={"path": "/scoped", "method": "GET", "response_body": '{"scope": "scenario"}'},
    )

    response = await client.get(f"/m/{test_workspace.short_id}/scoped")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_unknown_scenario_short_id_is_404(client):
    response = await client.get("/s/doesnotexist/anything")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_undefined_path_on_a_scenario_is_404(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)

    response = await client.get(f"/s/{scenario_short_id}/nothing-here")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_scenario_url_answers_cors_preflight(client, auth_headers, test_workspace):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)

    response = await client.request(
        "OPTIONS",
        f"/s/{scenario_short_id}/payments",
        headers={"Origin": "https://example.com", "Access-Control-Request-Method": "POST"},
    )

    assert response.status_code == 204
    assert response.headers["Access-Control-Allow-Origin"] == "*"


@pytest.mark.asyncio
async def test_private_workspace_requires_an_api_key_on_the_scenario_url(
    client, auth_headers, test_workspace, db_session
):
    scenario_short_id = await _make_scenario(client, auth_headers, test_workspace)
    await client.post(
        f"/api/v1/workspaces/{test_workspace.short_id}/scenarios/checkout/mocks",
        headers=auth_headers,
        json={"path": "/payments", "method": "GET", "response_body": '{"ok": true}'},
    )

    test_workspace.is_public = False
    await db_session.commit()

    denied = await client.get(f"/s/{scenario_short_id}/payments")
    allowed = await client.get(
        f"/s/{scenario_short_id}/payments",
        headers={"X-API-Key": test_workspace.api_key},
    )

    assert denied.status_code == 401
    assert allowed.status_code == 200
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_serve.py -q`

Expected: FAIL — every `/s/...` request returns 404, since the route does not exist.

- [ ] **Step 3: Extract the shared handler**

In `backend/app/api/mock_serve.py`, add the scenario imports:

```python
from app.models.scenario import Scenario
from app.services.mock_service import get_active_mocks_for_scenario
from app.services.scenario_service import get_scenario_by_short_id
```

Replace the decorator-and-signature block:

```python
@router.api_route(
    "/m/{workspace_short_id}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
)
async def serve_mock(
    workspace_short_id: str,
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
```

with:

```python
def _preflight_response(request: Request) -> Response:
    """Answer a CORS preflight without any lookup.

    A browser sends OPTIONS ahead of any request that is not "simple". Falling
    through to endpoint matching meant the preflight 404'd with no CORS headers,
    so the browser blocked the real request. Mocks exist to be called from other
    origins, so this always succeeds, even for a path with no mock defined.
    """
    requested_headers = request.headers.get(
        "Access-Control-Request-Headers", "Content-Type, Authorization, X-Requested-With"
    )
    return Response(
        status_code=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
            "Access-Control-Allow-Headers": requested_headers,
            "Access-Control-Max-Age": "86400",
        },
    )


@router.api_route(
    "/m/{workspace_short_id}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
)
async def serve_mock(
    workspace_short_id: str,
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if request.method == "OPTIONS":
        return _preflight_response(request)

    result = await db.execute(
        select(Workspace).where(Workspace.short_id == workspace_short_id)
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        return JSONResponse(
            {"error": "Workspace not found"}, status_code=404, headers=MOCK_CORS_HEADERS
        )

    return await _serve(request, path, workspace, None, db)


@router.api_route(
    "/s/{scenario_short_id}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
)
async def serve_scenario_mock(
    scenario_short_id: str,
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """A scenario's own namespace.

    Resolution is two-pass — this scenario's mocks first, the workspace's shared
    mocks as a fallback — so a scenario overrides only what it explicitly
    defines and inherits everything else.

    The serving path holds no per-run state, so a run that dies mid-flight
    leaves nothing to clean up. That is not the same as concurrent runs being
    safe: every run of this scenario shares its namespace, including the Redis
    sequence counters keyed by mock endpoint with no run dimension, so two
    overlapping runs would advance each other's position. Runs of one scenario
    are queued for exactly that reason — see SCENARIOS_DESIGN.md §8.
    """
    if request.method == "OPTIONS":
        return _preflight_response(request)

    scenario = await get_scenario_by_short_id(scenario_short_id, db)
    if not scenario or not scenario.is_active:
        return JSONResponse(
            {"error": "Scenario not found"}, status_code=404, headers=MOCK_CORS_HEADERS
        )

    workspace = await db.get(Workspace, scenario.workspace_id)
    if not workspace:
        return JSONResponse(
            {"error": "Workspace not found"}, status_code=404, headers=MOCK_CORS_HEADERS
        )

    return await _serve(request, path, workspace, scenario, db)


async def _serve(
    request: Request,
    path: str,
    workspace: Workspace,
    scenario: Scenario | None,
    db: AsyncSession,
):
```

Then delete the now-duplicated blocks from the body of `_serve` — everything from `# Step 0: CORS preflight.` through the `if not workspace:` block that follows `workspace = result.scalar_one_or_none()` — so `_serve` begins at the `# Check workspace privacy` comment. The rest of the body is unchanged.

- [ ] **Step 4: Make mock resolution two-pass**

Inside `_serve`, replace the Step 3 block:

```python
    # Step 3: Find matching mock
    mocks = await get_active_mocks_for_workspace(workspace.id, db)
    mock_endpoint, path_params = match_mock_endpoint(path, request.method, mocks)
```

with:

```python
    # Step 3: Find matching mock.
    #
    # On a scenario URL the scenario's own mocks are consulted first, and the
    # workspace's shared mocks answer only what the scenario does not define.
    mock_endpoint, path_params = None, {}
    if scenario is not None:
        scenario_mocks = await get_active_mocks_for_scenario(scenario.id, db)
        mock_endpoint, path_params = match_mock_endpoint(path, request.method, scenario_mocks)

    if not mock_endpoint:
        mocks = await get_active_mocks_for_workspace(workspace.id, db)
        mock_endpoint, path_params = match_mock_endpoint(path, request.method, mocks)
```

- [ ] **Step 5: Extend the middleware to `/s/`**

In `backend/app/main.py`, in `limit_public_ingest`, replace:

```python
    is_mock = path.startswith("/m/")
```

with:

```python
    # Scenario URLs are the same serving path under a different namespace, so
    # they share the mock budget rather than getting an unmetered one.
    is_mock = path.startswith("/m/") or path.startswith("/s/")
```

In `allow_any_origin_for_mocks`, replace:

```python
    if request.url.path.startswith("/m/") and request.method == "OPTIONS":
```

with:

```python
    if request.url.path.startswith(("/m/", "/s/")) and request.method == "OPTIONS":
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_serve.py -q`

Expected: `8 passed`

- [ ] **Step 7: Run the whole suite**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `42 passed`

- [ ] **Step 8: Confirm the app still boots and the routes are registered**

Run:

```bash
.venv/Scripts/python.exe -c "
from app.main import app
paths = sorted(r.path for r in app.routes if '/s/' in r.path or '/m/' in r.path or 'scenarios' in r.path)
print('\n'.join(paths))
"
```

Expected: the list includes `/m/{workspace_short_id}/{path:path}`, `/s/{scenario_short_id}/{path:path}`, and the seven `/api/v1/workspaces/{short_id}/scenarios...` paths.

- [ ] **Step 9: Commit**

```bash
git add backend/app/api/mock_serve.py backend/app/main.py backend/tests/test_scenario_serve.py
git commit -m "feat(scenarios): serve scenario-scoped mocks at /s/{short_id}"
```

---

## Deployment note

`/s/` is a new top-level path, and production routing is done in Caddy rather
than by Next.js rewrites. The Caddyfile already routes `/api/v1/*`, `/h/*` and
`/m/*` to the backend; **`/s/*` must be added to that list or scenario URLs will
be served by the frontend and return the Next.js 404.** This is a deploy-time
change, not a code change, and belongs with whichever release ships this plan.

## What this plan does not do

- No execution engine, worker, or run API — Plan 2.
- No assertions, variables, or step types — Plan 2.
- No SSRF guard — Plan 2, where outbound HTTP is introduced.
- No `scenario_runs` quota — Plan 2, alongside the runs it meters.
- No frontend — Plan 3.
- No YAML export/import — Plan 3.
- Run-history retention stays deferred per design §15.3, to be folded into the
  single retention job that captures, mock logs and emails also need.
