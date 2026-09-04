# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is MockLane

MockLane (formerly HookTrap) is a webhook testing and mock API platform. It lets developers capture webhooks, create mock API endpoints with dynamic responses, replay captured requests, and receive test emails via sandbox inboxes. Built with FastAPI (Python) + Next.js 14 (TypeScript).

## Development Commands

### Prerequisites
- PostgreSQL 15+ running on localhost:5432 (database: `mocklane`)
- Redis optional (app degrades gracefully without it)
- Python 3.12+ with venv at `backend/.venv`
- Node.js 20+

### Backend
```bash
# Run backend (from backend/ directory)
.venv/Scripts/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
.venv/Scripts/pytest tests/ -v

# Run a single test file
.venv/Scripts/pytest tests/test_mock_serve.py -v

# Run a single test
.venv/Scripts/pytest tests/test_mock_serve.py::test_name -v

# Type check / lint (dev dependencies)
.venv/Scripts/python -m mypy app/
.venv/Scripts/python -m ruff check app/
.venv/Scripts/python -m black app/ --check
```

### Frontend
```bash
# Run dev server (from frontend/ directory)
npm run dev          # localhost:3000

# Build
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

### Docker (all services)
```bash
docker-compose up    # postgres, redis, backend, frontend
```

## Architecture

### Backend (FastAPI)

**Three route groups mounted at different levels in `app/main.py`:**
- `/api/v1/*` — All REST API routes (auth, workspaces, mocks, captures, sandboxes, etc.)
- `/h/{endpoint_short_id}` — Webhook capture ingestion (accepts any method/body)
- `/m/{workspace_short_id}/{path}` — Mock API serving (matches against configured mock endpoints)

**Route registration:** All API routes aggregate through `app/api/v1/router.py`. The `sandboxes` router puts `check-prefix` before `{sandbox_id}` routes to avoid UUID parsing conflicts.

**Database:** Async SQLAlchemy 2.0 with asyncpg. Session via `get_db()` dependency with auto-commit on success. Tables created at startup via `Base.metadata.create_all` plus inline ALTER TABLE migrations in the lifespan handler. Alembic is configured but migrations are supplementary.

**Auth:** Magic link flow — JWT tokens with `python-jose`. Two token types: `magic_link` (short-lived) and `session` (30-day). Frontend stores session token in localStorage, sends as Bearer token. Backend dependency: `get_current_user` / `get_current_user_optional` in `app/api/deps.py`. In dev mode, magic link URL is printed to console instead of emailed.

**SMTP server:** `aiosmtpd` runs in a separate thread alongside FastAPI (started in lifespan). Uses a **synchronous** SQLAlchemy engine (psycopg2) since the SMTP thread can't use async sessions. Supports both authenticated (workspace/sandbox SMTP credentials) and unauthenticated (public inbound to sandbox addresses) email delivery.

**Mock serving flow (`app/api/mock_serve.py`):** Workspace lookup → privacy/API-key check → path matching (exact then parameterized `:param`) → immutable mode check → static data mode → error simulation → response sequences (Redis-tracked) → conditional response rules → template processing → delay → request logging → Redis pub/sub notification.

**Template engine (`app/services/template_engine.py`):** Processes `{{variable}}` syntax in mock responses with 100+ Faker-based generators. Supports `{{request.body.field}}`, `{{request.headers.X-Foo}}`, `{{oneOf("a","b","c")}}`, `{{repeat(3, ...)}}`, and direct `{{faker.method()}}` calls.

### Frontend (Next.js 14 App Router)

**API calls:** `lib/api.ts` ApiClient uses fetch with relative URLs. Next.js rewrites in `next.config.mjs` proxy `/api/v1/*` and `/h/*` to the backend, avoiding CORS in development.

**State:** Zustand stores for auth, captures, workspaces. React Query (v5) for server data fetching with 30s stale time.

**Dashboard layout:** `app/dashboard/layout.tsx` — responsive sidebar + header. Sidebar fetches workspaces dynamically.

**Key patterns:**
- All dashboard pages are `"use client"` components
- Auth guard via `useAuth()` hook — redirects to `/auth/login` if no token
- Mock endpoint editor (`components/mock/MockEditor.tsx`) is the most complex component — handles response body, headers, rules, sequences, template helpers, and contract validation
- Brand components in `components/brand/Logo.tsx` — use `MockLaneLogo` and `MockLaneIcon`

### Database Models

Core entity relationships:
- **User** → has many Workspaces (via WorkspaceMember with roles: owner/admin/editor/viewer)
- **Workspace** → has many MockEndpoints, MockRequestLogs, InboxEmails; has SMTP credentials
- **MockEndpoint** → has many MockResponseRules (conditional responses) and MockSequences
- **User** → has many Sandboxes (standalone email inboxes with own SMTP credentials)
- **Sandbox** → has many SandboxEmails

All models extend `BaseModel` (UUID pk + timestamps) except `SandboxEmail` which extends bare `Base`.

### Domain: mocklane.com

- Sandbox email addresses: `{prefix}@inbox.mocklane.com`
- Sandbox prefixes: 3-50 chars, lowercase alphanumeric + hyphens, no consecutive hyphens
- Reserved prefixes: admin, postmaster, abuse, noreply, support, test, info, help, billing, sales

## Testing

Tests run against a real PostgreSQL database, `mocklane_test`, at `postgresql+asyncpg://postgres:postgres@localhost:5432/mocklane_test` — it must exist before running the suite. SQLite is not supported: `JSONB` doesn't compile on it, and the scenario run queue needs `FOR UPDATE SKIP LOCKED`, which SQLite has no equivalent for. An autouse fixture stubs outbound email so no test reaches Amazon SES. Fixtures in `backend/tests/conftest.py` provide `client` (httpx AsyncClient against ASGI app), `db_session`, `test_user`, `auth_headers`, `test_workspace`, `other_user`, and `other_auth_headers`. The app's `get_db` dependency is overridden to use the test database.

## Design System

Frontend uses Tailwind CSS with an indigo/violet/slate color palette. Gradient accent: `from-indigo-500 to-violet-500`. Dark theme on landing page, light theme in dashboard. Components in `components/common/` provide the shared UI primitives.
