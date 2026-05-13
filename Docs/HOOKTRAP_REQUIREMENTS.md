# HookTrap — Complete Technical Requirements (V2)

> Purpose: Complete spec for building HookTrap — a webhook testing sandbox AND mock API platform for developer teams. Designed for Claude Code.

## Table of Contents
1. Project Overview
2. Architecture
3. Tech Stack
4. Project Structure
5. Database Schema
6. Backend API Specification
7. Webhook Capture Engine
8. Mock API Serving Engine
9. WebSocket Real-Time Layer
10. Frontend Pages & Components
11. Authentication System
12. Workspace & Team System
13. Replay Engine
14. Session Sharing
15. Rate Limiting & Abuse Prevention
16. Cleanup & Data Retention
17. Deployment & DevOps
18. Environment Variables
19. Testing Requirements
20. Implementation Phases
21. Appendix A: Short ID Generation
22. Appendix B: cURL Copy Generation
23. Appendix C: Mock Template Engine
24. Appendix D: OpenAPI Import Logic
25. Appendix E: Python Dependencies

---

## 1. Project Overview

HookTrap is a two-in-one platform for developer teams:

1. **Webhook Testing Sandbox** — Capture, inspect, replay, and share webhook payloads from Stripe, GitHub, Slack, etc.
2. **Mock API Server** — Define mock HTTP endpoints with configurable responses so frontend teams can build without waiting for backend.

### Key Differences from V1

- V1 was single-user webhook inspection tool
- V2 adds workspaces, team collaboration, and a production-grade mock API server
- Mock APIs are scoped to workspaces and shared with team members
- Mock endpoints are served at `https://hooktrap.dev/m/{workspace_short_id}/{path}`

### User Personas

1. **Backend Developer (Solo)** — Uses webhook sandbox to test webhook handling
2. **Backend API Designer** — Defines mock endpoints, team members build against them
3. **Frontend Developer (In Team)** — Receives mock API URL, builds UI while backend is in progress
4. **API Contractor** — Imports OpenAPI specs, generates instant mocks for client approval

### Value Propositions

- **Webhook Testing** — No need to re-trigger events; capture and replay instantly
- **Mock APIs** — Unblock frontend development; build against contracts, not implementations
- **Team Collaboration** — Invite teammates to workspaces; everyone uses the same mock APIs
- **Contract Validation** — Import OpenAPI specs, validate live requests against contracts
- **Template-Driven Responses** — Generate realistic data: `{{faker.name}}`, `{{randomUUID}}`, etc.

---

## 2. Architecture

### High-Level Request Flow

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTS                              │
├─────────────────────────────────────────────────────────┤
│  Stripe/GitHub → POST /h/{endpoint_id}    (webhook)     │
│  Frontend App  → ANY  /m/{workspace_id}/* (mock serve)  │
│  Browser       → Next.js Frontend @ /                   │
│  CLI/cURL      → REST API @ /api/v1/*                   │
└─────────────────────────────────────────────────────────┘
                         ↓
        ┌────────────────────────────────────────┐
        │     FastAPI Backend (Python)           │
        ├────────────────────────────────────────┤
        │ POST /h/{id}          → Webhook Capture│
        │ ANY  /m/{ws}/*        → Mock Serve     │
        │ GET  /api/v1/captures → List captures  │
        │ POST /api/v1/mocks    → Mock CRUD      │
        │ POST /api/v1/workspaces → Workspace   │
        │ WS   /ws/{session}    → Real-time     │
        └────────────────────────────────────────┘
                         ↓
        ┌────────────────────────────────────────┐
        │  PostgreSQL + Redis                    │
        │  - captures, webhooks                  │
        │  - mock_endpoints, mock_response_rules │
        │  - workspaces, workspace_members       │
        │  - mock_request_logs                   │
        │  - Sessions (Redis)                    │
        └────────────────────────────────────────┘
```

### Request Flow: Webhook Capture

1. Third-party (Stripe, GitHub, etc.) sends POST to `https://hooktrap.dev/h/{endpoint_short_id}`
2. FastAPI handler extracts headers, body, query params
3. INSERT into `webhook_captures` table
4. Publish to Redis channel `webhook:{endpoint_id}` for real-time updates
5. Return 200 (ack immediately, don't wait for processing)
6. Frontend watches WebSocket, displays capture in real-time

### Request Flow: Mock API Serving

1. Frontend app sends `GET https://hooktrap.dev/m/{workspace_short_id}/api/users`
2. FastAPI mock handler:
   a. Look up workspace by short_id
   b. Find matching mock_endpoint by path + method (with param extraction)
   c. Check for active response rule (match conditions against request)
   d. If no rule, use default response
   e. Process response body through template engine ({{randomUUID}}, {{faker.name}}, etc.)
   f. Apply simulated delay (if configured)
   g. Log request in mock_request_logs
   h. Publish to Redis for real-time dashboard
3. Return configured response with CORS headers
4. Frontend team member sees the request in their dashboard logs

---

## 3. Tech Stack

### Backend
- **Framework**: FastAPI 0.115+
- **Server**: Uvicorn with ASGI
- **Database**: PostgreSQL 14+ with asyncpg
- **ORM**: SQLAlchemy 2.0+ with async support
- **Migrations**: Alembic
- **Cache/PubSub**: Redis 5.0+
- **Auth**: Magic links (no passwords), python-jose
- **Email**: emails library
- **Validation**: Pydantic 2.0+
- **API Rate Limiting**: slowapi
- **Monitoring**: Sentry
- **Async Scheduling**: APScheduler

### Frontend
- **Framework**: Next.js 14+
- **Styling**: Tailwind CSS 3.x
- **Components**: shadcn/ui (Radix + Tailwind)
- **State**: TanStack Query + Zustand
- **Real-time**: socket.io-client for WebSocket
- **Editor**: Monaco Editor (for JSON, YAML editing)
- **HTTP**: httpx (Node.js port or native fetch)

### Deployment
- **Containerization**: Docker
- **Hosting**: Railway (or similar)
- **DNS**: Cloudflare / Route53
- **CDN**: Cloudflare
- **Email**: SendGrid or similar SMTP

### New Dependencies (Mock Feature)
- **Faker**: faker 30.0+ (realistic test data)
- **YAML Parsing**: pyyaml 6.0+
- **OpenAPI Validation**: openapi-spec-validator 0.7+
- **JSON Schema**: jsonschema 4.23+

---

## 4. Project Structure

```
hooktrap/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app initialization
│   │   ├── config.py               # Settings from env
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # Base model with id, created_at, updated_at
│   │   │   ├── user.py
│   │   │   ├── endpoint.py         # Webhook endpoints
│   │   │   ├── webhook.py          # Captured webhooks
│   │   │   ├── session.py          # Replay sessions
│   │   │   ├── workspace.py        # [NEW] Workspaces
│   │   │   ├── mock_endpoint.py    # [NEW] Mock endpoints
│   │   │   ├── mock_response_rule.py # [NEW] Rules
│   │   │   ├── mock_request_log.py # [NEW] Logs
│   │   │   ├── mock_sequence.py    # [NEW] Sequences
│   │   │   └── openapi_spec.py     # [NEW] OpenAPI specs
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── endpoint.py
│   │   │   ├── webhook.py
│   │   │   ├── workspace.py        # [NEW]
│   │   │   ├── mock.py             # [NEW] Request/response DTOs
│   │   │   └── openapi.py          # [NEW]
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py             # Common dependencies (auth, db)
│   │   │   ├── mock_serve.py       # [NEW] ALL /m/{ws_short_id}/{path:path}
│   │   │   │
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── endpoints.py    # POST /h/{id} webhook capture
│   │   │       ├── captures.py     # GET /api/v1/captures (list)
│   │   │       ├── webhook.py      # GET /api/v1/captures/{id}
│   │   │       ├── replay.py       # POST /api/v1/captures/{id}/replay
│   │   │       ├── sessions.py     # Replay sessions
│   │   │       ├── auth.py         # Magic link login
│   │   │       ├── workspaces.py   # [NEW] Workspace CRUD
│   │   │       ├── mocks.py        # [NEW] Mock endpoint CRUD
│   │   │       ├── mock_rules.py   # [NEW] Response rule CRUD
│   │   │       ├── mock_logs.py    # [NEW] Mock request logs
│   │   │       ├── openapi_import.py # [NEW]
│   │   │       └── router.py       # Combine all routers
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── webhook_service.py
│   │   │   ├── replay_service.py
│   │   │   ├── email_service.py
│   │   │   ├── mock_service.py     # [NEW] Mock matching + template
│   │   │   ├── workspace_service.py # [NEW]
│   │   │   ├── template_engine.py  # [NEW] Handlebars-like processor
│   │   │   ├── openapi_import_service.py # [NEW]
│   │   │   └── contract_validator.py # [NEW]
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── database.py         # Session factory, Base
│   │   │   ├── migrations/         # Alembic versions/
│   │   │   │   ├── env.py
│   │   │   │   ├── script.py.mako
│   │   │   │   └── versions/
│   │   │   │       └── 001_initial.py (and subsequent migrations)
│   │   │   └── redis.py            # Redis client
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── short_id.py         # ID generation
│   │       ├── cors_helper.py
│   │       ├── rate_limit.py
│   │       └── validators.py
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py             # pytest fixtures
│   │   ├── test_auth.py
│   │   ├── test_webhook_capture.py
│   │   ├── test_replay.py
│   │   ├── test_mock_serve.py      # [NEW]
│   │   ├── test_mock_crud.py       # [NEW]
│   │   ├── test_mock_rules.py      # [NEW]
│   │   ├── test_template_engine.py # [NEW]
│   │   ├── test_openapi_import.py  # [NEW]
│   │   ├── test_workspaces.py      # [NEW]
│   │   └── fixtures/
│   │       └── payloads.py
│   │
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── Dockerfile
│   └── .dockerignore
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Landing page
│   │   │   ├── api/
│   │   │   │   └── auth/
│   │   │   │       ├── callback/route.ts
│   │   │   │       └── logout/route.ts
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   └── login/page.tsx
│   │   │   │
│   │   │   └── dashboard/
│   │   │       ├── page.tsx        # Dashboard home
│   │   │       ├── layout.tsx
│   │   │       │
│   │   │       ├── captures/
│   │   │       │   ├── page.tsx    # Capture list
│   │   │       │   ├── layout.tsx
│   │   │       │   └── [id]/
│   │   │       │       ├── page.tsx # Capture detail
│   │   │       │       └── replay/
│   │   │       │           └── page.tsx
│   │   │       │
│   │   │       ├── workspace/
│   │   │       │   ├── [id]/
│   │   │       │   │   ├── page.tsx           # Workspace overview
│   │   │       │   │   ├── layout.tsx
│   │   │       │   │   │
│   │   │       │   │   ├── mocks/
│   │   │       │   │   │   ├── page.tsx        # Mock list
│   │   │       │   │   │   ├── layout.tsx
│   │   │       │   │   │   └── [mockId]/
│   │   │       │   │   │       ├── page.tsx    # Mock editor
│   │   │       │   │   │       └── layout.tsx
│   │   │       │   │   │
│   │   │       │   │   ├── members/
│   │   │       │   │   │   └── page.tsx        # Team management
│   │   │       │   │   │
│   │   │       │   │   ├── import/
│   │   │       │   │   │   └── page.tsx        # OpenAPI import
│   │   │       │   │   │
│   │   │       │   │   └── settings/
│   │   │       │   │       └── page.tsx        # Workspace settings
│   │   │       │   │
│   │   │       │   └── new/page.tsx            # Create workspace
│   │   │       │
│   │   │       └── settings/
│   │   │           └── page.tsx                # User settings
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Footer.tsx
│   │   │   │
│   │   │   ├── webhook/
│   │   │   │   ├── CaptureCard.tsx
│   │   │   │   ├── CaptureDetail.tsx
│   │   │   │   ├── CaptureList.tsx
│   │   │   │   ├── RequestViewer.tsx
│   │   │   │   ├── ResponseViewer.tsx
│   │   │   │   └── ReplayButton.tsx
│   │   │   │
│   │   │   ├── mock/
│   │   │   │   ├── MockEndpointCard.tsx
│   │   │   │   ├── MockEditor.tsx             # Main editor
│   │   │   │   ├── ResponseBodyEditor.tsx
│   │   │   │   ├── ResponseRuleEditor.tsx     # Rule matching UI
│   │   │   │   ├── SequenceEditor.tsx         # Sequence UI
│   │   │   │   ├── MockRequestLog.tsx         # Real-time logs
│   │   │   │   ├── TemplateHelperPicker.tsx   # Insert templates
│   │   │   │   ├── MockUrlBar.tsx
│   │   │   │   ├── OpenAPIImportWizard.tsx    # [NEW]
│   │   │   │   ├── ContractValidator.tsx      # [NEW]
│   │   │   │   └── MockTester.tsx             # "Try It" modal
│   │   │   │
│   │   │   ├── workspace/
│   │   │   │   ├── WorkspaceHeader.tsx
│   │   │   │   ├── WorkspaceStats.tsx
│   │   │   │   ├── MemberInviteForm.tsx
│   │   │   │   ├── MemberList.tsx
│   │   │   │   └── RoleSelect.tsx
│   │   │   │
│   │   │   └── common/
│   │   │       ├── Button.tsx
│   │   │       ├── Dialog.tsx
│   │   │       ├── Alert.tsx
│   │   │       ├── Tabs.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Badge.tsx
│   │   │       ├── Spinner.tsx
│   │   │       └── CopyButton.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useWorkspace.ts           # [NEW]
│   │   │   ├── useMockEndpoint.ts        # [NEW]
│   │   │   └── useLocalStorage.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                    # HTTP client
│   │   │   ├── ws.ts                     # WebSocket setup
│   │   │   └── utils.ts
│   │   │
│   │   ├── stores/
│   │   │   ├── authStore.ts
│   │   │   ├── captureStore.ts
│   │   │   ├── workspaceStore.ts         # [NEW]
│   │   │   └── mockStore.ts              # [NEW]
│   │   │
│   │   ├── types/
│   │   │   ├── index.ts
│   │   │   ├── api.ts
│   │   │   ├── webhook.ts
│   │   │   ├── workspace.ts              # [NEW]
│   │   │   ├── mock.ts                   # [NEW]
│   │   │   └── forms.ts
│   │   │
│   │   ├── app.css
│   │   └── globals.css
│   │
│   ├── public/
│   │   ├── logo.svg
│   │   ├── favicon.ico
│   │   └── og-image.png
│   │
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml
├── Dockerfile
├── .gitignore
├── README.md
└── DEPLOYMENT.md
```

---

## 5. Database Schema

### Base User Model (same as V1)

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    email_verified  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Webhook Models (same as V1)

```sql
CREATE TABLE endpoints (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    short_id        VARCHAR(12) UNIQUE NOT NULL,
    name            VARCHAR(200),
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_endpoints_user_id ON endpoints(user_id);
CREATE INDEX idx_endpoints_short_id ON endpoints(short_id);

CREATE TABLE webhook_captures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint_id     UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    http_method     VARCHAR(10) NOT NULL,
    path            VARCHAR(500),
    query_params    JSONB DEFAULT '{}',
    headers         JSONB NOT NULL DEFAULT '{}',
    body            TEXT,
    body_size       INTEGER DEFAULT 0,
    content_type    VARCHAR(255),
    source_ip       INET,
    captured_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_captures_endpoint_id ON webhook_captures(endpoint_id, captured_at DESC);

CREATE TABLE replay_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint_id     UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    name            VARCHAR(200),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON replay_sessions(user_id, created_at DESC);

CREATE TABLE replay_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES replay_sessions(id) ON DELETE CASCADE,
    capture_id      UUID REFERENCES webhook_captures(id),
    target_url      VARCHAR(2000) NOT NULL,
    modifications   JSONB,
    response_status INTEGER,
    response_body   TEXT,
    response_time_ms INTEGER,
    error_message   TEXT,
    replayed_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_replays_session ON replay_requests(session_id);
```

### Workspace Models (NEW)

```sql
CREATE TABLE workspaces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    short_id        VARCHAR(12) UNIQUE NOT NULL,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    owner_id        UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workspaces_short_id ON workspaces(short_id);
CREATE INDEX idx_workspaces_owner ON workspaces(owner_id);

CREATE TABLE workspace_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'member'
                    CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    invited_by      UUID REFERENCES users(id),
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
```

### Mock Endpoint Models (NEW)

```sql
CREATE TABLE mock_endpoints (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by      UUID REFERENCES users(id),
    path            VARCHAR(500) NOT NULL,
    method          VARCHAR(10) NOT NULL,
    name            VARCHAR(200),
    description     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    priority        INTEGER DEFAULT 0,
    response_status     INTEGER DEFAULT 200,
    response_headers    JSONB DEFAULT '{"Content-Type": "application/json"}',
    response_body       TEXT,
    response_delay_ms   INTEGER DEFAULT 0,
    error_rate          FLOAT DEFAULT 0,
    error_status        INTEGER DEFAULT 500,
    error_body          TEXT DEFAULT '{"error": "Internal server error"}',
    request_count       INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, path, method)
);

CREATE INDEX idx_mock_endpoints_workspace ON mock_endpoints(workspace_id, is_active);
CREATE INDEX idx_mock_endpoints_path ON mock_endpoints(workspace_id, method, path);

CREATE TABLE mock_response_rules (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mock_endpoint_id    UUID NOT NULL REFERENCES mock_endpoints(id) ON DELETE CASCADE,
    name                VARCHAR(200),
    description         TEXT,
    priority            INTEGER DEFAULT 0,
    is_active           BOOLEAN DEFAULT TRUE,
    match_conditions    JSONB NOT NULL,
    response_status     INTEGER NOT NULL DEFAULT 200,
    response_headers    JSONB DEFAULT '{}',
    response_body       TEXT,
    response_delay_ms   INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mock_rules_endpoint ON mock_response_rules(mock_endpoint_id, priority DESC);

CREATE TABLE mock_sequences (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mock_endpoint_id    UUID NOT NULL REFERENCES mock_endpoints(id) ON DELETE CASCADE,
    name                VARCHAR(200),
    is_active           BOOLEAN DEFAULT TRUE,
    loop                BOOLEAN DEFAULT FALSE,
    current_step        INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mock_sequence_steps (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id         UUID NOT NULL REFERENCES mock_sequences(id) ON DELETE CASCADE,
    step_order          INTEGER NOT NULL,
    response_status     INTEGER DEFAULT 200,
    response_headers    JSONB DEFAULT '{}',
    response_body       TEXT,
    response_delay_ms   INTEGER DEFAULT 0,
    UNIQUE(sequence_id, step_order)
);

CREATE INDEX idx_mock_sequence_steps ON mock_sequence_steps(sequence_id, step_order);

CREATE TABLE mock_request_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mock_endpoint_id    UUID NOT NULL REFERENCES mock_endpoints(id) ON DELETE CASCADE,
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    method              VARCHAR(10) NOT NULL,
    path                TEXT NOT NULL,
    query_params        JSONB DEFAULT '{}',
    headers             JSONB NOT NULL DEFAULT '{}',
    body                TEXT,
    body_size           INTEGER DEFAULT 0,
    content_type        VARCHAR(255),
    source_ip           INET,
    matched_rule_id     UUID REFERENCES mock_response_rules(id),
    matched_sequence_id UUID REFERENCES mock_sequences(id),
    response_status     INTEGER,
    response_delay_ms   INTEGER,
    contract_valid      BOOLEAN,
    contract_errors     JSONB,
    received_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mock_logs_endpoint ON mock_request_logs(mock_endpoint_id, received_at DESC);
CREATE INDEX idx_mock_logs_workspace ON mock_request_logs(workspace_id, received_at DESC);

CREATE TABLE openapi_specs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name                VARCHAR(200),
    version             VARCHAR(50),
    spec_content        TEXT NOT NULL,
    spec_format         VARCHAR(10) DEFAULT 'yaml' CHECK (spec_format IN ('yaml', 'json')),
    uploaded_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_openapi_specs_workspace ON openapi_specs(workspace_id);
```

---

## 6. Backend API Specification

### 6.1 Webhook Capture Endpoints (same as V1)

```
POST   /h/{endpoint_short_id}                    Capture webhook
GET    /api/v1/endpoints                         List my endpoints
POST   /api/v1/endpoints                         Create endpoint
GET    /api/v1/endpoints/{id}                    Get endpoint detail
GET    /api/v1/captures                          List captures
GET    /api/v1/captures/{id}                     Get capture detail
DELETE /api/v1/captures/{id}                     Delete capture
```

#### POST /h/{endpoint_short_id}

Request: Any HTTP method, any headers, any body (application/json, form-data, plain text, etc.)

Response:
```json
{
  "status": "captured",
  "timestamp": "2026-04-08T14:32:10Z"
}
```

Status: 200

Logic:
- Accept webhook on any HTTP method
- Store raw headers, method, path, query params, body
- Publish to Redis for real-time dashboard
- Return 200 immediately (non-blocking storage)

#### POST /api/v1/endpoints

Request:
```json
{
  "name": "Stripe Events",
  "description": "Incoming webhook from Stripe"
}
```

Response:
```json
{
  "id": "uuid",
  "short_id": "abc123xyz",
  "name": "Stripe Events",
  "description": "Incoming webhook from Stripe",
  "endpoint_url": "https://hooktrap.dev/h/abc123xyz",
  "created_at": "2026-04-08T14:32:10Z"
}
```

Status: 201

#### GET /api/v1/captures

Query params:
- `endpoint_id` (optional, filter by endpoint)
- `limit` (default 50, max 100)
- `offset` (default 0, pagination)
- `sort` (default "captured_at desc")

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "endpoint_id": "uuid",
      "http_method": "POST",
      "path": "/webhook",
      "query_params": {"event": "charge.succeeded"},
      "headers": {"content-type": "application/json", "stripe-signature": "..."},
      "body": "{\"id\": \"evt_...\", \"type\": \"charge.succeeded\"}",
      "body_size": 1024,
      "content_type": "application/json",
      "source_ip": "1.2.3.4",
      "captured_at": "2026-04-08T14:32:10Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

Status: 200

---

### 6.2 Replay Endpoints (same as V1)

```
GET    /api/v1/captures/{id}/replay              Start replay session
POST   /api/v1/replay-sessions                    Create session
GET    /api/v1/replay-sessions                    List sessions
GET    /api/v1/replay-sessions/{id}              Get session detail
POST   /api/v1/replay-sessions/{id}/requests     Add replay request
GET    /api/v1/replay-requests/{id}              Get request detail
```

#### POST /api/v1/replay-sessions/{id}/requests

Request:
```json
{
  "capture_id": "uuid",
  "target_url": "https://myapp.example.com/webhook",
  "modifications": {
    "headers": {"x-custom-header": "value"},
    "body_overrides": {"key": "new_value"}
  }
}
```

Response:
```json
{
  "id": "uuid",
  "session_id": "uuid",
  "capture_id": "uuid",
  "target_url": "https://myapp.example.com/webhook",
  "response_status": 200,
  "response_body": "{\"ok\": true}",
  "response_time_ms": 150,
  "replayed_at": "2026-04-08T14:32:10Z"
}
```

Status: 201

---

### 6.3 Authentication Endpoints (same as V1)

```
POST   /api/v1/auth/magic-link                   Request magic link
GET    /api/v1/auth/callback                     Verify token
GET    /api/v1/auth/me                           Get current user
POST   /api/v1/auth/logout                       Logout
```

#### POST /api/v1/auth/magic-link

Request:
```json
{
  "email": "user@company.com"
}
```

Response:
```json
{
  "status": "link_sent",
  "email": "user@company.com"
}
```

Status: 200

Logic:
- Generate secure token (valid 24 hours)
- Store token in database (hashed with salt)
- Send email with link: `https://hooktrap.dev/api/v1/auth/callback?token={token}`
- Create user if not exists

---

### 6.4 Workspace Management Endpoints (NEW)

```
POST   /api/v1/workspaces                        Create workspace
GET    /api/v1/workspaces                        List my workspaces
GET    /api/v1/workspaces/{short_id}             Get workspace detail
PATCH  /api/v1/workspaces/{short_id}             Update workspace
DELETE /api/v1/workspaces/{short_id}             Delete workspace
POST   /api/v1/workspaces/{short_id}/members    Invite member
GET    /api/v1/workspaces/{short_id}/members    List members
PATCH  /api/v1/workspaces/{short_id}/members/{user_id} Update member role
DELETE /api/v1/workspaces/{short_id}/members/{user_id} Remove member
```

#### POST /api/v1/workspaces

Request:
```json
{
  "name": "E-commerce Backend",
  "description": "Mock APIs for our e-commerce project"
}
```

Response:
```json
{
  "id": "uuid",
  "short_id": "ecom-xyz",
  "name": "E-commerce Backend",
  "description": "Mock APIs for our e-commerce project",
  "mock_base_url": "https://hooktrap.dev/m/ecom-xyz",
  "owner_id": "uuid",
  "created_at": "2026-04-08T14:32:10Z",
  "member_count": 1
}
```

Status: 201

#### GET /api/v1/workspaces

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "short_id": "ecom-xyz",
      "name": "E-commerce Backend",
      "owner_id": "uuid",
      "mock_base_url": "https://hooktrap.dev/m/ecom-xyz",
      "mock_count": 12,
      "member_count": 3,
      "role": "owner",
      "created_at": "2026-04-08T14:32:10Z"
    }
  ]
}
```

Status: 200

#### PATCH /api/v1/workspaces/{short_id}

Request:
```json
{
  "name": "E-commerce Backend v2",
  "description": "Updated description"
}
```

Response: Updated workspace object
Status: 200

#### DELETE /api/v1/workspaces/{short_id}

Response:
```json
{
  "status": "deleted"
}
```

Status: 200

Logic: Delete workspace (cascade deletes mocks, rules, logs, members)

#### POST /api/v1/workspaces/{short_id}/members

Request:
```json
{
  "email": "teammate@company.com",
  "role": "editor"
}
```

Response:
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "workspace_id": "uuid",
  "email": "teammate@company.com",
  "role": "editor",
  "status": "invited",
  "joined_at": null
}
```

Status: 201

Logic:
- If user with email exists: add to workspace_members
- If user doesn't exist: create user, send magic link, add to workspace
- Email sent includes workspace name and dashboard link
- User can join workspace by clicking magic link (if not logged in, login first)

#### GET /api/v1/workspaces/{short_id}/members

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "email": "user1@company.com",
      "role": "owner",
      "joined_at": "2026-04-01T10:00:00Z"
    },
    {
      "id": "uuid",
      "user_id": "uuid",
      "email": "user2@company.com",
      "role": "editor",
      "joined_at": "2026-04-05T14:00:00Z"
    }
  ]
}
```

Status: 200

#### PATCH /api/v1/workspaces/{short_id}/members/{user_id}

Request:
```json
{
  "role": "viewer"
}
```

Response: Updated member object
Status: 200

Logic: Only owner/admin can change roles. Cannot demote last owner.

#### DELETE /api/v1/workspaces/{short_id}/members/{user_id}

Response:
```json
{
  "status": "removed"
}
```

Status: 200

Logic: Only owner can remove. Cannot remove last owner.

---

### 6.5 Mock Endpoint CRUD (NEW)

```
POST   /api/v1/workspaces/{ws_id}/mocks          Create mock endpoint
GET    /api/v1/workspaces/{ws_id}/mocks          List mock endpoints
GET    /api/v1/workspaces/{ws_id}/mocks/{mock_id} Get mock with rules
PATCH  /api/v1/workspaces/{ws_id}/mocks/{mock_id} Update mock endpoint
DELETE /api/v1/workspaces/{ws_id}/mocks/{mock_id} Delete mock endpoint
POST   /api/v1/mocks/{mock_id}/rules             Add response rule
GET    /api/v1/mocks/{mock_id}/rules             List rules
PATCH  /api/v1/mocks/{mock_id}/rules/{rule_id}   Update rule
DELETE /api/v1/mocks/{mock_id}/rules/{rule_id}   Delete rule
POST   /api/v1/mocks/{mock_id}/sequences         Create sequence
GET    /api/v1/mocks/{mock_id}/sequences         List sequences
PATCH  /api/v1/mocks/{mock_id}/sequences/{seq_id} Update sequence + steps
DELETE /api/v1/mocks/{mock_id}/sequences/{seq_id} Delete sequence
GET    /api/v1/workspaces/{ws_id}/logs           Get all mock logs
GET    /api/v1/mocks/{mock_id}/logs              Get logs for single mock
```

#### POST /api/v1/workspaces/{ws_id}/mocks

Request:
```json
{
  "path": "/api/users",
  "method": "GET",
  "name": "List Users",
  "description": "Returns paginated user list",
  "response_status": 200,
  "response_headers": {
    "Content-Type": "application/json",
    "X-Total-Count": "100"
  },
  "response_body": "{\n  \"users\": [\n    {\n      \"id\": \"{{randomUUID}}\",\n      \"name\": \"{{faker.name}}\",\n      \"email\": \"{{faker.email}}\"\n    }\n  ],\n  \"page\": \"{{request.query.page || 1}}\",\n  \"total\": 100\n}",
  "response_delay_ms": 100,
  "error_rate": 0.05,
  "error_status": 500,
  "error_body": "{\"error\": \"Database connection failed\"}"
}
```

Response:
```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "path": "/api/users",
  "method": "GET",
  "name": "List Users",
  "mock_url": "https://hooktrap.dev/m/{ws_short_id}/api/users",
  "response_status": 200,
  "response_body": "...",
  "response_delay_ms": 100,
  "error_rate": 0.05,
  "request_count": 0,
  "is_active": true,
  "created_at": "2026-04-08T14:32:10Z"
}
```

Status: 201

Logic:
- Validate path format (must start with /)
- Validate method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Ensure workspace has not exceeded plan limit (free: 2, pro: 15, etc.)
- Generate unique mock_url

#### GET /api/v1/workspaces/{ws_id}/mocks

Query params:
- `method` (filter by HTTP method)
- `search` (search by path/name)
- `limit` (default 50)
- `offset` (default 0)

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "path": "/api/users",
      "method": "GET",
      "name": "List Users",
      "mock_url": "https://hooktrap.dev/m/ecom-xyz/api/users",
      "is_active": true,
      "request_count": 25,
      "response_status": 200,
      "created_at": "2026-04-08T14:32:10Z"
    }
  ],
  "total": 12
}
```

Status: 200

#### GET /api/v1/workspaces/{ws_id}/mocks/{mock_id}

Response:
```json
{
  "id": "uuid",
  "workspace_id": "uuid",
  "path": "/api/users",
  "method": "GET",
  "name": "List Users",
  "description": "Returns paginated user list",
  "response_status": 200,
  "response_headers": {"Content-Type": "application/json"},
  "response_body": "...",
  "response_delay_ms": 100,
  "error_rate": 0.05,
  "error_status": 500,
  "error_body": "...",
  "is_active": true,
  "request_count": 25,
  "rules": [
    {
      "id": "uuid",
      "name": "Admin Users",
      "priority": 10,
      "match_conditions": [
        {"field": "query.role", "operator": "equals", "value": "admin"}
      ],
      "response_status": 200,
      "response_body": "...",
      "is_active": true
    }
  ],
  "sequences": [
    {
      "id": "uuid",
      "name": "Multi-step Auth",
      "is_active": true,
      "loop": false,
      "steps": [
        {"step_order": 1, "response_status": 401, "response_body": "..."},
        {"step_order": 2, "response_status": 200, "response_body": "..."}
      ]
    }
  ],
  "created_at": "2026-04-08T14:32:10Z"
}
```

Status: 200

#### PATCH /api/v1/workspaces/{ws_id}/mocks/{mock_id}

Request: Same fields as POST (all optional)

Response: Updated mock object
Status: 200

#### DELETE /api/v1/workspaces/{ws_id}/mocks/{mock_id}

Response:
```json
{
  "status": "deleted"
}
```

Status: 200

Logic: Delete mock (cascade deletes rules, sequences, logs)

#### POST /api/v1/mocks/{mock_id}/rules

Request:
```json
{
  "name": "Premium Users Only",
  "description": "Return different data for premium users",
  "priority": 10,
  "is_active": true,
  "match_conditions": [
    {
      "field": "query.tier",
      "operator": "equals",
      "value": "premium"
    },
    {
      "field": "headers.authorization",
      "operator": "starts_with",
      "value": "Bearer"
    }
  ],
  "response_status": 200,
  "response_headers": {"X-Plan": "premium"},
  "response_body": "{\"plan\": \"premium\", \"features\": [\"advanced\", \"analytics\"], \"users\": {{repeat 100 '{\"id\": \"{{randomUUID}}\", \"name\": \"{{faker.name}}\"}'}}}",
  "response_delay_ms": 50
}
```

Response:
```json
{
  "id": "uuid",
  "mock_endpoint_id": "uuid",
  "name": "Premium Users Only",
  "priority": 10,
  "match_conditions": [...],
  "response_status": 200,
  "response_body": "...",
  "created_at": "2026-04-08T14:32:10Z"
}
```

Status: 201

Logic:
- Validate match_conditions format
- Validate operators (equals, not_equals, contains, starts_with, ends_with, exists, regex, gt, lt)
- Higher priority = checked first

Match condition fields:
- `field`: dotpath into request (body.user.id, query.page, headers.x-api-key, params.id)
- `operator`: comparison type
- `value`: expected value (not needed for 'exists' operator)

#### GET /api/v1/mocks/{mock_id}/rules

Response:
```json
{
  "data": [
    {rule object},
    {rule object}
  ]
}
```

Status: 200

#### PATCH /api/v1/mocks/{mock_id}/rules/{rule_id}

Request: Same as POST (all optional)
Response: Updated rule object
Status: 200

#### DELETE /api/v1/mocks/{mock_id}/rules/{rule_id}

Response:
```json
{
  "status": "deleted"
}
```

Status: 200

#### POST /api/v1/mocks/{mock_id}/sequences

Request:
```json
{
  "name": "OAuth Flow",
  "is_active": true,
  "loop": false,
  "steps": [
    {
      "step_order": 1,
      "response_status": 401,
      "response_body": "{\"error\": \"unauthorized\"}"
    },
    {
      "step_order": 2,
      "response_status": 200,
      "response_body": "{\"token\": \"{{randomString 32}}\", \"expires_in\": 3600}"
    }
  ]
}
```

Response:
```json
{
  "id": "uuid",
  "mock_endpoint_id": "uuid",
  "name": "OAuth Flow",
  "is_active": true,
  "loop": false,
  "steps": [
    {"step_order": 1, "response_status": 401, "response_body": "..."},
    {"step_order": 2, "response_status": 200, "response_body": "..."}
  ],
  "created_at": "2026-04-08T14:32:10Z"
}
```

Status: 201

#### GET /api/v1/mocks/{mock_id}/logs

Query params:
- `limit` (default 50, max 200)
- `offset` (default 0)
- `status` (filter by response status, e.g., 200, 500)

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "mock_endpoint_id": "uuid",
      "method": "GET",
      "path": "/api/users?page=1",
      "query_params": {"page": "1"},
      "headers": {"user-agent": "..."},
      "matched_rule_id": "uuid",
      "response_status": 200,
      "response_delay_ms": 105,
      "contract_valid": true,
      "received_at": "2026-04-08T14:32:10Z"
    }
  ],
  "total": 150
}
```

Status: 200

---

### 6.6 OpenAPI Import (NEW)

```
POST   /api/v1/workspaces/{ws_id}/import-openapi  Import OpenAPI spec
GET    /api/v1/workspaces/{ws_id}/openapi-specs   List uploaded specs
DELETE /api/v1/workspaces/{ws_id}/openapi-specs/{id} Delete spec
```

#### POST /api/v1/workspaces/{ws_id}/import-openapi

Request (JSON):
```json
{
  "spec": "openapi: 3.0.0\ninfo:\n  title: E-commerce API\n  version: 1.0\npaths:\n  /api/users:\n    get:\n      summary: List Users\n      responses:\n        200:\n          description: Success\n          content:\n            application/json:\n              schema:\n                type: object\n                properties:\n                  users:\n                    type: array\n                    items:\n                      type: object\n                      properties:\n                        id: {type: string}\n                        name: {type: string}\n                        email: {type: string, format: email}",
  "format": "yaml",
  "name": "E-commerce API v1.0"
}
```

OR multipart/form-data:
- `spec_file` (file upload, .yaml or .json)
- `name` (optional, defaults to info.title from spec)

Response:
```json
{
  "success": true,
  "data": {
    "spec_id": "uuid",
    "name": "E-commerce API v1.0",
    "endpoints_created": 12,
    "endpoints_updated": 3,
    "endpoints_skipped": 0,
    "details": [
      {
        "path": "/api/users",
        "method": "GET",
        "action": "created",
        "summary": "List Users"
      },
      {
        "path": "/api/users/{id}",
        "method": "GET",
        "action": "created",
        "summary": "Get User by ID"
      },
      {
        "path": "/api/users",
        "method": "POST",
        "action": "created",
        "summary": "Create User"
      }
    ]
  }
}
```

Status: 201 (or 200 if updating existing)

Logic:
- Parse YAML/JSON spec with pyyaml
- Validate against OpenAPI 3.0/3.1 with openapi-spec-validator
- For each path + method:
  a. Convert path params: {id} → :id
  b. Extract path, method, summary, description
  c. Find first 2xx response schema
  d. Generate mock response body from schema (use examples if present)
  e. Create mock_endpoint or update if path+method exists
- Store full spec in openapi_specs table

---

## 7. Webhook Capture Engine (same as V1)

The webhook capture route accepts ANY HTTP request and stores it immediately.

### Route: POST /h/{endpoint_short_id}

```python
@app.api_route("/h/{endpoint_short_id}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
async def capture_webhook(endpoint_short_id: str, request: Request, db: AsyncSession):
    # 1. Look up endpoint by short_id
    # 2. Extract all request details
    # 3. Create WebhookCapture record
    # 4. Publish to Redis: webhook:{endpoint_id}
    # 5. Return 200 immediately (fire-and-forget)
```

No request validation — accept any body, headers, method.

---

## 8. Mock API Serving Engine (NEW)

This is the core new feature. Mock APIs are served at a public URL per workspace.

### Route: ALL /m/{workspace_short_id}/{path:path}

```python
@app.api_route(
    "/m/{workspace_short_id}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
)
async def serve_mock(
    workspace_short_id: str,
    path: str,
    request: Request,
    db: AsyncSession,
    redis: Redis
):
    """Serve a configured mock response for a workspace."""
```

### Mock Serving Logic (Step-by-Step)

**Step 1: Lookup workspace**

```python
workspace = await db.scalar(
    select(Workspace).where(Workspace.short_id == workspace_short_id)
)
if not workspace:
    return JSONResponse(
        {"error": "Workspace not found"},
        status_code=404
    )
```

**Step 2: Normalize path**

```python
if not path.startswith("/"):
    path = "/" + path
```

**Step 3: Find matching mock endpoint**

```python
def match_mock_endpoint(path: str, method: str, mocks: list) -> MockEndpoint:
    """
    Match request path against configured mock endpoints.

    Matching order:
    1. Exact match (priority)
    2. Parameterized match (/api/users/:id)
    3. Wildcard match (/api/**)

    Returns first match or None.
    """
    exact_matches = [m for m in mocks if m.path == path and m.method == method]
    if exact_matches:
        return max(exact_matches, key=lambda m: m.priority)

    param_matches = []
    for mock in mocks:
        if mock.method != method:
            continue
        matched, params = match_path_pattern(mock.path, path)
        if matched:
            param_matches.append((mock, params))

    if param_matches:
        mock, params = max(param_matches, key=lambda x: x[0].priority)
        return mock, params

    return None, {}

mocks = await get_active_mocks_for_workspace(workspace.id, db)
mock_endpoint, path_params = match_mock_endpoint(path, request.method, mocks)

if not mock_endpoint:
    return JSONResponse(
        {"error": f"No mock endpoint defined for {request.method} {path}"},
        status_code=404
    )
```

**Step 4: Check error simulation**

```python
if mock_endpoint.error_rate > 0:
    if random.random() < mock_endpoint.error_rate:
        return JSONResponse(
            json.loads(mock_endpoint.error_body or "{}"),
            status_code=mock_endpoint.error_status,
            headers={"Content-Type": "application/json"}
        )
```

**Step 5: Check for active sequence**

```python
sequence_key = f"seq:{mock_endpoint.id}:{source_ip}:{workspace.id}"
current_step = await redis.get(sequence_key)

if mock_endpoint has active sequence:
    if current_step is None:
        current_step = 0
    else:
        current_step = int(current_step)

    step = get_sequence_step(mock_endpoint.sequence_id, current_step)

    # Use sequence response
    response_status = step.response_status
    response_headers = step.response_headers
    response_body = step.response_body
    response_delay = step.response_delay_ms

    # Increment step
    next_step = current_step + 1
    if next_step >= sequence.step_count:
        if sequence.loop:
            next_step = 0
        else:
            next_step = sequence.step_count - 1

    await redis.setex(sequence_key, 3600, str(next_step))  # 1 hour expiry

    use_sequence = True
else:
    use_sequence = False
```

**Step 6: Evaluate response rules (if not sequence)**

```python
if not use_sequence:
    rules = await get_active_rules_for_mock(
        mock_endpoint.id,
        db,
        sort_by_priority=True
    )

    request_context = {
        "method": request.method,
        "path": path,
        "query": dict(request.query_params),
        "headers": dict(request.headers),
        "body": await parse_body(request),
        "params": path_params
    }

    matched_rule = None
    for rule in rules:
        if all_conditions_match(rule.match_conditions, request_context):
            matched_rule = rule
            break

    if matched_rule:
        response_status = matched_rule.response_status
        response_headers = matched_rule.response_headers
        response_body = matched_rule.response_body
        response_delay = matched_rule.response_delay_ms
        matched_rule_id = matched_rule.id
    else:
        # Use default from endpoint
        response_status = mock_endpoint.response_status
        response_headers = mock_endpoint.response_headers
        response_body = mock_endpoint.response_body
        response_delay = mock_endpoint.response_delay_ms
        matched_rule_id = None
```

**Step 7: Process template variables**

```python
template_context = {
    "request": request_context,
    "now": datetime.now(timezone.utc).isoformat(),
    "timestamp": int(time.time())
}

processed_body = process_template(response_body, template_context)
processed_headers = process_template_dict(response_headers, template_context)
```

**Step 8: Apply simulated delay**

```python
if response_delay > 0:
    await asyncio.sleep(response_delay / 1000)
```

**Step 9: Log request (async, non-blocking)**

```python
asyncio.create_task(
    log_mock_request(
        mock_endpoint.id,
        workspace.id,
        request,
        response_status,
        matched_rule_id,
        db,
        redis
    )
)
```

**Step 10: Return response**

```python
# Merge headers with auto-added CORS
final_headers = {
    **processed_headers,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400"
}

return Response(
    content=processed_body,
    status_code=response_status,
    headers=final_headers,
    media_type="application/json"
)
```

### Path Parameter Matching

```python
import re

def match_path_pattern(pattern: str, actual_path: str) -> tuple[bool, dict]:
    """
    Match a mock endpoint path pattern against an actual request path.

    Patterns:
      /api/users           → exact match only /api/users
      /api/users/:id       → matches /api/users/123, params={"id": "123"}
      /api/users/:id/posts → matches /api/users/123/posts
      /api/**              → matches any sub-path

    Returns (matched: bool, params: dict)
    """
    # Convert :param patterns to regex groups
    regex_pattern = re.sub(r':(\w+)', r'(?P<\1>[^/]+)', pattern)
    # Convert ** wildcard
    regex_pattern = regex_pattern.replace('/**', '/(?P<__wildcard>.*)')
    regex_pattern = f'^{regex_pattern}$'

    match = re.match(regex_pattern, actual_path)
    if match:
        params = {k: v for k, v in match.groupdict().items() if not k.startswith('_')}
        return True, params
    return False, {}
```

### Rule Condition Matching

```python
def evaluate_condition(condition: dict, request_context: dict) -> bool:
    """
    Evaluate a single match condition against the request context.

    condition = { "field": "body.role", "operator": "equals", "value": "admin" }
    request_context = { "body": {"role": "admin"}, "query": {}, ... }
    """
    field_value = get_nested_value(request_context, condition["field"])
    operator = condition["operator"]
    expected = condition.get("value")

    if operator == "exists":
        return field_value is not None

    if field_value is None:
        return False

    field_str = str(field_value)
    expected_str = str(expected) if expected is not None else ""

    match operator:
        case "equals": return field_str == expected_str
        case "not_equals": return field_str != expected_str
        case "contains": return expected_str in field_str
        case "starts_with": return field_str.startswith(expected_str)
        case "ends_with": return field_str.endswith(expected_str)
        case "regex": return bool(re.match(expected_str, field_str))
        case "gt": return float(field_str) > float(expected_str)
        case "lt": return float(field_str) < float(expected_str)
        case _: return False

def get_nested_value(data: dict, dotpath: str):
    """Get value from nested dict using dot notation: 'body.user.role' """
    keys = dotpath.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list) and key.isdigit():
            current = current[int(key)]
        else:
            return None
    return current
```

---

## 9. WebSocket Real-Time Layer (Updated)

### WebSocket Endpoint: /ws/{session_id}

Added: Mock request notifications

Subscribe to:
- `webhook:{endpoint_id}` — new webhooks captured
- `mock:{workspace_id}` — new mock requests
- `replay:{session_id}` — replay results

### Message Types

```json
{
  "type": "webhook_captured",
  "endpoint_id": "uuid",
  "data": { "webhook_capture object" }
}
```

```json
{
  "type": "mock_request",
  "workspace_id": "uuid",
  "mock_endpoint_id": "uuid",
  "data": { "mock_request_log object" }
}
```

```json
{
  "type": "replay_result",
  "session_id": "uuid",
  "data": { "replay_request object" }
}
```

---

## 10. Frontend Pages & Components (Updated)

### Dashboard Overview (`/dashboard`)

Shows:
- Quick stats: Total endpoints, Total captures, Team workspaces
- Recent activity across all workspaces
- Link to create workspace or webhook endpoint

### Webhook Capture Pages (same as V1)

- `/dashboard/captures` — List of captures
- `/dashboard/captures/[id]` — Capture detail + replay
- Real-time updates via WebSocket

### Workspace Pages (NEW)

#### `/dashboard/workspace/[id]`

Shows:
- Workspace name and description
- Mock base URL: `https://hooktrap.dev/m/{short_id}`
- Quick stats:
  - Total mock endpoints
  - Mock requests today
  - Team members
  - Active sequences
- Recent mock request log (last 20)
- "Create Mock" button

#### `/dashboard/workspace/[id]/mocks`

Shows:
- List of all mock endpoints in grid/table view
- Columns: Path, Method (color-coded), Name, Request Count, Active toggle
- Filter by method
- Search by path/name
- "+ New Mock" button
- Each mock card has: View/Edit, Duplicate, Delete actions

#### `/dashboard/workspace/[id]/mocks/[mockId]`

Main mock endpoint editor with tabs:

**Tab 1: Response**
- JSON editor for response body (Monaco editor with syntax highlighting)
- Template variable insert button (sidebar showing: {{randomUUID}}, {{faker.name}}, {{request.body.email}}, etc.)
- Response status dropdown (200, 201, 400, 401, 404, 500, custom)
- Response headers: key-value editor
- Response delay slider (0–5000ms)
- Error rate slider (0–100%)
- Error response config (status + body)
- "Test" button → Opens mock tester modal

**Tab 2: Rules**
- List of response rules, draggable to reorder by priority
- Each rule card shows: Name, Conditions summary, Response status, Active toggle
- Click to expand/edit inline
- Rule editor shows:
  - Name, description
  - Match conditions (add/remove)
  - For each condition: Field dropdown (body, query, headers, params), Operator dropdown, Value input
  - Response: status, headers, body (same as Tab 1)
- "+ New Rule" button at bottom

**Tab 3: Sequences**
- List of sequences (if any)
- Each sequence: Name, step count, loop toggle, Active toggle
- Click to edit: Modal showing
  - Sequence name, description
  - Loop after last step toggle
  - Table of steps: Step #, Response Status, Response Body (truncated), Delay
  - Drag to reorder steps
  - Add step button
- "+ New Sequence" button

**Tab 4: Logs**
- Real-time request log (updates via WebSocket)
- Columns: Timestamp, Method, Path, Matched Rule, Response Status, Latency
- Pagination (50 per page)
- Filter by status
- Click row → Detail modal showing full request/response

**Tab 5: Contract** (if OpenAPI spec linked to workspace)
- Shows spec name and version
- Compliance badge: "92% compliant (23/25 requests valid)"
- Recent validation errors table: Request timestamp, Error type, Details
- Link to workspace settings to change spec

#### `/dashboard/workspace/[id]/members`

Shows:
- List of workspace members: Avatar, Email, Role (badge), Joined date
- "Invite" button → Opens modal with:
  - Email input
  - Role select (owner, admin, editor, viewer)
  - "Send Invite" button
- Pending invitations list
- Member actions: Change role, Remove (dropdown per member)

#### `/dashboard/workspace/[id]/import`

OpenAPI import wizard, 4 steps:

**Step 1: Upload Spec**
- Text area to paste YAML/JSON
- OR file upload
- "Validate & Continue" button

**Step 2: Review**
- Shows detected endpoints in table: Path, Method, Summary, Response Schema
- Count: Endpoints found, will be created, will update existing
- "Continue" button

**Step 3: Confirm**
- Checkboxes per endpoint: Create, Update, or Skip
- Custom name per endpoint (optional)
- "Import" button

**Step 4: Results**
- Progress bar showing status
- Summary: Created X, Updated Y, Skipped Z
- Details table: Path, Method, Action (created/updated/skipped)
- "Done" button → Redirects to mock list

#### `/dashboard/workspace/[id]/settings`

Shows:
- Workspace name/description (editable)
- Mock base URL (copy button)
- OpenAPI specs (list, delete)
- Danger zone: Delete workspace (confirmation modal)

### Components (NEW)

#### `MockEditor.tsx`

Main tabbed editor (as described above).

#### `ResponseBodyEditor.tsx`

Monaco JSON editor with:
- Syntax highlighting
- Autocomplete for template variables
- Template helper sidebar with buttons:
  - {{randomUUID}}
  - {{randomInt min max}}
  - {{faker.name}}
  - {{faker.email}}
  - {{request.query.paramName}}
  - etc.
- Click inserts at cursor position

#### `ResponseRuleEditor.tsx`

UI for creating/editing a rule:
- Name field
- Conditions builder:
  - Field dropdown: fetch from request context (body.*, query.*, headers.*, params.*)
  - Operator dropdown: equals, not_equals, contains, starts_with, ends_with, exists, regex, gt, lt
  - Value input (hidden for 'exists')
  - + button to add condition
  - X button per condition to remove
- Response section: same as ResponseBodyEditor
- Save / Cancel buttons

#### `SequenceEditor.tsx`

UI for creating/editing sequences:
- Name field
- Loop toggle
- Steps section: table with step order, response status, body (truncated), delete button
- Drag handle per row
- + Add step button
- Save / Cancel

#### `MockRequestLog.tsx`

Real-time log viewer:
- Table: Timestamp, Method, Path, Matched Rule, Status, Latency
- Updates in real-time via WebSocket
- Row click → Detail modal showing full request/response
- Pagination
- Status filter dropdown

#### `MockUrlBar.tsx`

Shows:
```
🔗 https://hooktrap.dev/m/abc123/api/users  [Copy] [Try It]
```

Copy button copies to clipboard.
Try It button opens modal with:
- HTTP method selector
- Request body textarea
- Request headers key-value editor
- Send button
- Response section showing status, headers, body

#### `OpenAPIImportWizard.tsx`

4-step wizard as described in `/dashboard/workspace/[id]/import`.

#### `TemplateHelperPicker.tsx`

Sidebar component showing available template variables:
- {{randomUUID}} — click to insert
- {{randomInt 1 100}} — click, prompts for min/max
- {{faker.name}} — click to insert
- {{faker.email}} — click to insert
- {{faker.address.city}} — click to insert
- {{request.query.page}} — click, prompts for field name
- {{request.body.email}} — click, prompts for field path
- {{request.params.id}} — click, prompts for param name
- Search box to filter

#### `ContractValidator.tsx`

Shows contract validation status:
- Compliance percentage badge
- Recent errors table: timestamp, error message, details
- Link to spec in workspace settings

---

## 11. Authentication System (same as V1)

Magic link authentication (passwordless).

### Flow

1. User enters email on `/auth/login`
2. POST `/api/v1/auth/magic-link` → sends email
3. Email contains link: `https://hooktrap.dev/api/v1/auth/callback?token={TOKEN}`
4. User clicks link → GET callback endpoint
5. Callback verifies token, creates session, redirects to `/dashboard`
6. User authenticated for 30 days (session cookie with httpOnly, secure, sameSite=strict)

---

## 12. Workspace & Team System (NEW)

### Workspace Features

- **Owner**: Full control, can delete workspace, manage members
- **Admin**: Can create mocks, invite members, but cannot delete workspace
- **Editor**: Can create and edit mocks, but cannot manage members
- **Viewer**: Read-only access to mocks and logs

### Invitation Flow

1. Owner/Admin invites user by email
2. If user doesn't exist:
   a. Create user with placeholder (password-less)
   b. Send magic link + workspace invitation message
   c. User clicks magic link, logs in
   d. User is automatically added to workspace (status: "joined")
3. If user exists:
   a. Add to workspace_members immediately
   b. Send notification email (optional)
   c. User sees workspace in their dashboard next login

### Short ID Generation

Workspace short IDs: 6–8 chars, alphanumeric + hyphens (e.g., `ecom-xyz`, `api-123`)

Same logic as endpoints (see Appendix A).

---

## 13. Replay Engine (same as V1)

### Functionality

- Capture webhook → inspect
- Modify payload (headers, body)
- Replay to target URL
- See live response

---

## 14. Session Sharing (same as V1 + workspaces)

- Share webhook endpoint link: `https://hooktrap.dev/h/{short_id}` (anyone can view)
- Share workspace: Invite team member (requires email + role)

---

## 15. Rate Limiting & Abuse Prevention (Updated)

### Rate Limits by Plan

| Action | Anonymous | Free | Pro | Team/Business |
|--------|-----------|------|-----|---------------|
| Webhook captures | 50/day | 100/day | Unlimited | Unlimited |
| Mock API requests | N/A | 200/day | 10,000/day | 100,000/day |
| Mock endpoints | N/A | 2 | 15 | 50 or Unlimited |
| Replay requests | N/A | 10/min | 60/min | 120/min |
| Endpoint creation | 1 total | 3 | 20 | 50+ |
| Workspaces | N/A | 1 | 5 | Unlimited |
| Members per workspace | N/A | 1 | 5 (+$8/extra) | Unlimited (+$6/extra) |
| OpenAPI imports | N/A | N/A | 3 specs | Unlimited |
| API calls (general) | 60/min | 120/min | 600/min | 1200/min |
| WebSocket connections | 1 | 3 | 10 | 50 |

### Implementation

Use slowapi (FastAPI rate limiting library):

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/v1/captures")
@limiter.limit("100/minute")
async def create_capture(request: Request):
    ...

@app.post("/m/{workspace_short_id}/{path:path}")
@limiter.limit("1000/minute")  # Mock serves more calls
async def serve_mock(workspace_short_id: str, path: str, request: Request):
    ...
```

Also check database-level plan limits on workspace creation.

---

## 16. Cleanup & Data Retention (Updated)

### Retention Policies

- Webhook captures: Delete after 30 days (free), 90 days (pro), unlimited (enterprise)
- Mock request logs: Delete after 7 days (all plans) or 30 days (pro+)
- Replay requests: Delete after 7 days

### Cleanup Job

APScheduler task runs daily at 2 AM UTC:

```python
@app.on_event("startup")
async def start_cleanup_job():
    scheduler.add_job(
        cleanup_old_captures,
        "cron",
        hour=2,
        minute=0,
        timezone="UTC"
    )

async def cleanup_old_captures():
    """Delete old webhook captures and mock logs based on plan."""
    # Query users with different plans
    # Delete captures older than retention period
    # Log deletion counts to Sentry
```

---

## 17. Deployment & DevOps (same as V1)

### Docker

Backend Dockerfile:
```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY ./app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Frontend Dockerfile:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: hooktrap
      POSTGRES_PASSWORD: $DB_PASSWORD
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:$DB_PASSWORD@postgres/hooktrap
      REDIS_URL: redis://redis:6379
      SECRET_KEY: $SECRET_KEY
      ENVIRONMENT: development
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### Hosting: Railway

Deploy both backend and frontend to Railway.

Backend:
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Postgres and Redis as Railway services

Frontend:
- Build command: `npm install && npm run build`
- Start command: `npm start`

---

## 18. Environment Variables (Updated)

### Backend (.env)

```
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost/hooktrap
REDIS_URL=redis://localhost:6379

# Auth
SECRET_KEY=your-secret-key-here-min-32-chars
MAGIC_LINK_EXPIRY_HOURS=24

# Email
SENDGRID_API_KEY=sg_...
SENDGRID_FROM_EMAIL=noreply@hooktrap.dev

# App
ENVIRONMENT=development
API_BASE_URL=https://hooktrap.dev
FRONTEND_BASE_URL=https://app.hooktrap.dev

# Monitoring
SENTRY_DSN=https://key@sentry.io/project

# OAuth (optional, for future)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REDIS_URL=redis://localhost:6379
```

### Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=https://api.hooktrap.dev
NEXT_PUBLIC_WS_URL=wss://api.hooktrap.dev
NEXT_PUBLIC_APP_NAME=HookTrap
```

---

## 19. Testing Requirements (Updated)

### Test Coverage

Minimum 80% code coverage.

### Tests by Category

#### 1. Auth Tests (`test_auth.py`)

- Magic link request → email sent
- Invalid email → 400
- Callback with valid token → session created
- Callback with expired token → 401
- Logout → session deleted

#### 2. Webhook Capture Tests (`test_webhook_capture.py`)

- POST /h/{id} with JSON body → 200, captured
- POST /h/{id} with form data → 200, captured
- POST /h/{id} with any headers → 200, all headers stored
- GET /h/{id} → 404 (no direct access)
- Non-existent endpoint → 404

#### 3. Replay Tests (`test_replay.py`)

- Create replay session → 201
- Add replay request → 201, response stored
- Replay request timeout → error message logged
- Modify body in replay → modifications applied

#### 4. Mock Serve Tests (`test_mock_serve.py`)

- GET /m/{ws}/api/users → 200 with configured response
- GET /m/{ws}/api/users/123 → path param :id extracted, available in template
- GET /m/{nonexistent_ws}/anything → 404
- POST /m/{ws}/api/users with body matching rule → rule response returned
- POST /m/{ws}/api/users with body NOT matching any rule → default response
- Multiple rules: higher priority checked first
- Error rate simulation: returns error at configured percentage
- Delay simulation: response delayed by configured ms
- CORS headers on all mock responses
- OPTIONS preflight returns correct CORS headers
- Template {{randomUUID}} → valid UUID in response body
- Template {{faker.name}} → non-empty string in response
- Template {{request.body.email}} → echoes request body field
- Template {{request.query.page}} → echoes query param
- Mock request logged in mock_request_logs table
- WebSocket publishes mock:workspace_id with request data

#### 5. Mock CRUD Tests (`test_mock_crud.py`)

- Create mock endpoint → 201, returns mock_url
- List mocks in workspace → returns only that workspace's mocks
- Update mock response body → 200
- Delete mock → 200, cascades to rules and logs
- Cannot create mock with invalid path → 400
- Cannot create mock with invalid method → 400
- Free tier: max 2 endpoints → 403 on 3rd
- Pro tier: max 15 endpoints → 403 on 16th
- Create response rule → 201
- Rule with invalid operator → 400
- List rules sorted by priority → DESC order
- Delete rule → 200

#### 6. Mock Rule Matching Tests (`test_mock_rules.py`)

- Rule: field "query.role" equals "admin" → matches GET /api?role=admin
- Rule: field "query.role" equals "admin" → doesn't match GET /api?role=user
- Rule: field "headers.x-token" starts_with "Bearer" → matches with Bearer header
- Rule: field "body.tier" equals "premium" → matches JSON with tier=premium
- Rule: field "params.id" exists → matches /api/users/123
- Rule: operator "regex" with pattern "^[0-9]+$" → matches numeric strings
- Rule: operator "gt" on "query.age" → numeric comparison
- Multiple conditions (AND logic) → all must match
- Rule priority: check highest priority first
- No matching rules → use default response

#### 7. Template Engine Tests (`test_template_engine.py`)

- {{randomUUID}} → valid UUID format
- {{randomInt 1 100}} → integer in range [1, 100]
- {{randomFloat 0 100 2}} → float with 2 decimals in range
- {{randomString 10}} → 10-char alphanumeric
- {{randomBool}} → "true" or "false"
- {{faker.name}} → non-empty string
- {{faker.email}} → valid email format
- {{faker.address.city}} → city name
- {{faker.phone_number}} → phone format
- {{faker.company}} → company name
- {{request.body.email}} with context → returns correct value
- {{request.query.page}} → returns query param value
- {{request.params.id}} → returns path parameter
- {{request.headers.authorization}} → returns header value
- {{now}} → current ISO timestamp
- {{timestamp}} → Unix timestamp (integer)
- {{oneOf "a" "b" "c"}} → one of the values
- Nested templates: body with multiple {{}} → all replaced
- Unknown template variable → returned as-is (e.g., {{undefined}})
- Template in headers → processed

#### 8. OpenAPI Import Tests (`test_openapi_import.py`)

- Valid OpenAPI 3.0 YAML → mock endpoints created
- Valid OpenAPI 3.1 JSON → mock endpoints created
- Schema with example values → example used in response
- Schema with $ref to component → reference resolved
- Invalid OpenAPI spec → 400 with validation errors
- Path parameter conversion: {id} → :id
- Deeply nested schema (depth > 5) → handled without recursion error
- Import overwrites existing mocks for same path/method
- File upload multipart/form-data → parsed correctly

#### 9. Workspace Tests (`test_workspaces.py`)

- Create workspace → 201, short_id generated
- List workspaces → returns only user's workspaces
- Update workspace name → 200
- Delete workspace → 200, cascades to mocks and logs
- Invite member by email → added to workspace_members
- Invite non-existing email → user created, invited
- Remove member → 200
- Cannot remove owner → 403
- Change member role → 200
- Viewer role: cannot create/edit mocks → 403
- Free tier: max 1 workspace → 403 on 2nd
- Pro tier: max 5 workspaces → 403 on 6th
- Cannot delete workspace as non-owner → 403

#### 10. Contract Validation Tests (`test_contract_validation.py`)

- OpenAPI spec linked to workspace
- Mock request matches spec → contract_valid = true
- Mock request doesn't match spec → contract_valid = false with errors
- Response status in spec → logged in contract_errors

### Test Fixtures

```python
@pytest.fixture
async def test_user(client, db):
    user = await create_test_user("test@example.com")
    return user

@pytest.fixture
async def auth_headers(test_user):
    token = generate_magic_link_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def test_workspace(client, auth_headers):
    response = await client.post(
        "/api/v1/workspaces",
        json={"name": "Test Workspace"},
        headers=auth_headers,
    )
    return response.json()["data"]

@pytest.fixture
async def test_mock(client, test_workspace, auth_headers):
    response = await client.post(
        f"/api/v1/workspaces/{test_workspace['short_id']}/mocks",
        json={
            "path": "/api/users",
            "method": "GET",
            "name": "List Users",
            "response_body": '{"users": [{"id": "{{randomUUID}}", "name": "Test User"}]}',
        },
        headers=auth_headers,
    )
    return response.json()["data"]

@pytest.fixture
async def test_mock_with_rule(client, test_mock, auth_headers):
    response = await client.post(
        f"/api/v1/mocks/{test_mock['id']}/rules",
        json={
            "name": "Admin Check",
            "priority": 10,
            "match_conditions": [
                {"field": "query.role", "operator": "equals", "value": "admin"}
            ],
            "response_status": 200,
            "response_body": '{"users": [{"id": "1", "name": "Admin", "role": "admin"}]}',
        },
        headers=auth_headers,
    )
    return test_mock
```

---

## 20. Implementation Phases

### Phase 1: Core Webhook Capture (Week 1–2)

**Milestones:**
- Webhook capture route working
- Database models for endpoints and captures
- Basic API CRUD
- Real-time WebSocket for dashboard

**Tasks:**
1. Set up FastAPI project, database migrations, authentication
2. Implement POST /h/{endpoint_id} webhook capture
3. Implement GET /api/v1/captures, GET /api/v1/endpoints
4. Implement WebSocket endpoint
5. Create Next.js project with login page
6. Create dashboard home + capture list page
7. Implement real-time updates via WebSocket
8. Deploy to Railway

**Tests:** Auth, webhook capture basics, API CRUD

---

### Phase 2: Webhook Inspection & Replay (Week 3–4)

**Milestones:**
- Can inspect captured webhooks in detail
- Can replay webhooks with modifications
- Sharing via short URL

**Tasks:**
1. Implement GET /api/v1/captures/{id} detail endpoint
2. Implement replay session CRUD endpoints
3. Implement replay request sending (httpx for outbound)
4. Create capture detail page with request/response viewer
5. Create replay session UI
6. Implement webhook sharing (public link)
7. Add cURL copy functionality

**Tests:** Replay, HTTP client, sharing

---

### Phase 3: Workspace & Team Foundations (Week 5)

**Milestones:**
- Can create workspaces
- Can invite team members
- Team members can access shared workspace

**Tasks:**
1. Create workspace model + migrations
2. Create workspace_members model + migrations
3. Implement workspace CRUD endpoints
4. Implement member invite/remove endpoints
5. Implement invitation email sending
6. Create workspace creation flow in frontend
7. Create workspace list page
8. Create members management page
9. Add role-based access control middleware

**Tests:** Workspace CRUD, team member management, role checks

---

### Phase 4: Mock Endpoints - Basic (Week 6)

**Milestones:**
- Can create mock endpoints
- Can serve mock responses at /m/{ws}/{path}
- Response rules with condition matching

**Tasks:**
1. Create mock_endpoints model + migration
2. Create mock_response_rules model + migration
3. Implement /m/{ws_short_id}/{path:path} serving route
4. Implement path parameter matching (/api/users/:id)
5. Implement rule condition evaluation (equals, contains, starts_with, etc.)
6. Implement mock CRUD endpoints
7. Implement mock rules CRUD endpoints
8. Create mock list page in frontend
9. Create mock editor page (basic: response body, status)
10. Create rule editor UI
11. Add real-time mock request logs via WebSocket
12. Test all path matching and rule evaluation

**Tests:** Mock serve, path matching, rule evaluation, CRUD

---

### Phase 5: Mock Endpoints - Advanced (Week 7–8)

**Milestones:**
- Template engine for realistic mock responses
- Error simulation and delays
- Sequences for multi-step flows
- OpenAPI import

**Tasks:**
1. Implement template engine ({{randomUUID}}, {{faker.name}}, {{request.body.email}}, etc.)
2. Implement Faker integration for realistic data
3. Implement error rate simulation
4. Implement response delay simulation
5. Create mock_sequences model + migration
6. Implement sequence endpoint CRUD
7. Implement sequence step progression (Redis-backed session state)
8. Implement OpenAPI spec parsing and import
9. Implement OpenAPI → mock endpoint generation
10. Create template helper picker sidebar
11. Create sequence editor UI
12. Create OpenAPI import wizard
13. Create contract validation service (validate request against spec)
14. Add contract validation to mock logs

**Tests:** Template engine, Faker, OpenAPI import, sequences, contract validation

---

### Phase 6: Polish & Features (Week 9–10)

**Milestones:**
- Mock URL bar with copy + "Try It"
- Full-featured mock editor (all tabs working)
- Contract validation dashboard
- Workspace settings page

**Tasks:**
1. Create mock URL bar component (copy to clipboard)
2. Create "Try It" modal for testing mocks
3. Create logs tab in mock editor (real-time)
4. Create contract tab in mock editor
5. Create workspace settings page (name, mock URL, delete)
6. Add OpenAPI spec management (list, delete)
7. Add mock duplication feature
8. Add export mock config as JSON
9. Implement plan-based rate limiting (mock request limits, endpoint limits)
10. Add usage dashboard
11. Create billing page (placeholder for Stripe integration)

**Tests:** All feature integration tests

---

### Phase 7: Billing & Launch (Week 11–12)

**Milestones:**
- Payment processing working
- Plan enforcement in place
- Production deployment
- Marketing landing page

**Tasks:**
1. Integrate Stripe for payments
2. Create pricing page with plan comparison
3. Implement plan selection on signup
4. Implement plan-based limits (enforce on endpoints creation, mock requests)
5. Add upgrade prompts when hitting limits
6. Create usage tracking dashboard
7. Create marketing landing page (SEO optimized)
8. Do full end-to-end testing
9. Deploy to production (hooktrap.dev)
10. Set up monitoring (Sentry, monitoring dashboard)
11. Create documentation (README, deployment guide)
12. Soft launch (beta users)

**Tests:** Full E2E tests, payment flow, limits enforcement

---

## 21. Appendix A: Short ID Generation

Generate short, unique IDs for endpoints and workspaces.

```python
import string
import secrets

def generate_short_id(length: int = 10) -> str:
    """
    Generate a random short ID: mix of lowercase letters and numbers.
    Used for webhooks, workspaces, etc.
    """
    alphabet = string.ascii_lowercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))
```

For workspaces, optionally include hyphens for readability:
```python
def generate_workspace_short_id() -> str:
    """Generate human-readable workspace ID like 'ecom-xyz-123'"""
    part1 = ''.join(secrets.choice(string.ascii_lowercase) for _ in range(3))
    part2 = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(3))
    return f"{part1}-{part2}"
```

---

## 22. Appendix B: cURL Copy Generation

Generate cURL commands for easy testing.

```python
def generate_curl_command(capture: WebhookCapture) -> str:
    """
    Generate a cURL command from a captured webhook for easy replay.
    """
    cmd = f"curl -X {capture.http_method} '{capture.endpoint_url}'"

    # Add headers
    for key, value in capture.headers.items():
        if key.lower() not in ['host', 'content-length']:
            cmd += f" -H '{key}: {value}'"

    # Add body
    if capture.body:
        body_escaped = capture.body.replace("'", "'\"'\"'")
        cmd += f" -d '{body_escaped}'"

    return cmd
```

---

## 23. Appendix C: Mock Template Engine (NEW)

Full template engine for response bodies with variable substitution.

```python
import re
import uuid
import random
import time
import string
from datetime import datetime, timezone
from faker import Faker

fake = Faker()

TEMPLATE_PATTERN = re.compile(r'\{\{(.+?)\}\}')

def process_template(template: str, context: dict) -> str:
    """
    Process a response body template, replacing {{variables}} with values.

    Supported:
      {{randomUUID}}                    → UUID v4
      {{randomInt min max}}             → integer in range
      {{randomFloat min max decimals}}  → float
      {{randomBool}}                    → true/false
      {{randomString length}}           → alphanumeric
      {{now}}                           → ISO timestamp
      {{timestamp}}                     → Unix seconds
      {{request.path}}                  → request path
      {{request.method}}                → HTTP method
      {{request.query.paramName}}       → query param
      {{request.body.fieldName}}        → body field (dot notation)
      {{request.headers.headerName}}    → header value
      {{request.params.paramName}}      → URL param
      {{faker.name}}                    → fake name
      {{faker.email}}                   → fake email
      {{faker.address.city}}            → fake city
      {{faker.phone_number}}            → fake phone
      {{faker.company}}                 → fake company
      {{faker.text max=200}}            → fake paragraph
      {{oneOf "a" "b" "c"}}             → random pick
      {{repeat 3 '...'}}                → repeat template
    """
    def replacer(match):
        expression = match.group(1).strip()
        return str(evaluate_expression(expression, context))

    return TEMPLATE_PATTERN.sub(replacer, template)

def evaluate_expression(expr: str, ctx: dict) -> any:
    """Evaluate a single template expression."""
    parts = expr.split()
    func_name = parts[0]
    args = parts[1:] if len(parts) > 1 else []

    # Random generators
    if func_name == "randomUUID":
        return uuid.uuid4()
    elif func_name == "randomInt":
        lo = int(args[0]) if args else 1
        hi = int(args[1]) if len(args) > 1 else 1000
        return random.randint(lo, hi)
    elif func_name == "randomFloat":
        lo = float(args[0]) if args else 0.0
        hi = float(args[1]) if len(args) > 1 else 100.0
        dec = int(args[2]) if len(args) > 2 else 2
        return round(random.uniform(lo, hi), dec)
    elif func_name == "randomString":
        length = int(args[0]) if args else 10
        return ''.join(random.choices(
            string.ascii_letters + string.digits, k=length
        ))
    elif func_name == "randomBool":
        return "true" if random.choice([True, False]) else "false"

    # Time
    elif func_name == "now":
        return datetime.now(timezone.utc).isoformat()
    elif func_name == "timestamp":
        return int(time.time())

    # Request context
    elif func_name.startswith("request."):
        path = func_name[8:]  # remove "request."
        return get_nested_value(ctx.get("request", {}), path) or ""

    # Faker
    elif func_name.startswith("faker."):
        method_name = func_name[6:]
        try:
            method = getattr(fake, method_name)
            return method()
        except AttributeError:
            return f"{{{{unknown: {func_name}}}}}"

    # List selection
    elif func_name == "oneOf":
        choices = [a.strip('"').strip("'") for a in args]
        return random.choice(choices) if choices else ""

    # Repeat
    elif func_name == "repeat":
        count = int(args[0]) if args else 1
        template = ' '.join(args[1:]) if len(args) > 1 else ""
        return ','.join([
            process_template(template, ctx) for _ in range(count)
        ])

    return f"{{{{{expr}}}}}"

def get_nested_value(data: dict, dotpath: str):
    """Get value from nested dict: 'body.user.email' """
    keys = dotpath.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list) and key.isdigit():
            current = current[int(key)]
        else:
            return None
    return current
```

---

## 24. Appendix D: OpenAPI Import Logic (NEW)

Parse and import OpenAPI specifications to auto-generate mocks.

```python
import yaml
import json
from openapi_spec_validator import validate
from openapi_spec_validator.exceptions import OpenAPIValidationError

async def import_openapi_spec(
    workspace_id: str,
    spec_content: str,
    spec_format: str,  # "yaml" or "json"
    name: str,
    db: AsyncSession,
) -> dict:
    """
    Parse OpenAPI spec and create/update mock endpoints.
    Supports OpenAPI 3.0.x and 3.1.x.
    """
    try:
        # 1. Parse
        if spec_format == "yaml":
            spec = yaml.safe_load(spec_content)
        else:
            spec = json.loads(spec_content)

        # 2. Validate against OpenAPI standard
        validate(spec)

    except (yaml.YAMLError, json.JSONDecodeError, OpenAPIValidationError) as e:
        return {
            "success": False,
            "error": f"Invalid OpenAPI spec: {str(e)}"
        }

    # 3. Extract metadata
    spec_title = spec.get("info", {}).get("title", "Imported API")
    spec_version = spec.get("info", {}).get("version", "1.0")
    base_path = ""
    if "servers" in spec and spec["servers"]:
        from urllib.parse import urlparse
        server_url = spec["servers"][0].get("url", "")
        parsed = urlparse(server_url)
        base_path = parsed.path.rstrip("/")

    # 4. Process paths
    results = []
    for path, path_item in spec.get("paths", {}).items():
        # Convert {id} → :id
        hooktrap_path = re.sub(r'\{(\w+)\}', r':\1', path)
        full_path = f"{base_path}{hooktrap_path}"

        for method in ["get", "post", "put", "patch", "delete"]:
            if method not in path_item:
                continue

            operation = path_item[method]

            # Generate mock response body from schema
            response_body = generate_response_from_schema(
                operation, spec.get("components", {}).get("schemas", {})
            )

            # Create or update mock
            existing = await db.scalar(
                select(MockEndpoint).where(
                    MockEndpoint.workspace_id == workspace_id,
                    MockEndpoint.path == full_path,
                    MockEndpoint.method == method.upper(),
                )
            )

            if existing:
                existing.response_body = json.dumps(response_body, indent=2)
                existing.name = operation.get("summary", existing.name)
                existing.description = operation.get("description")
                results.append({
                    "path": full_path,
                    "method": method.upper(),
                    "action": "updated",
                    "summary": operation.get("summary")
                })
            else:
                mock = MockEndpoint(
                    workspace_id=workspace_id,
                    path=full_path,
                    method=method.upper(),
                    name=operation.get("summary", f"{method.upper()} {path}"),
                    description=operation.get("description"),
                    response_body=json.dumps(response_body, indent=2),
                    response_status=200,
                )
                db.add(mock)
                results.append({
                    "path": full_path,
                    "method": method.upper(),
                    "action": "created",
                    "summary": operation.get("summary")
                })

    # Save spec for contract validation
    openapi_spec = OpenAPISpec(
        workspace_id=workspace_id,
        name=name or spec_title,
        version=spec_version,
        spec_content=spec_content,
        spec_format=spec_format,
    )
    db.add(openapi_spec)

    await db.commit()

    created = sum(1 for r in results if r["action"] == "created")
    updated = sum(1 for r in results if r["action"] == "updated")

    return {
        "success": True,
        "data": {
            "spec_id": str(openapi_spec.id),
            "endpoints_created": created,
            "endpoints_updated": updated,
            "details": results
        }
    }

def generate_response_from_schema(operation: dict, schemas: dict) -> any:
    """Generate mock response body from OpenAPI schema."""
    responses = operation.get("responses", {})

    # Find first 2xx response
    response = None
    for status in ["200", "201", "202", "204"]:
        if status in responses:
            response = responses[status]
            break

    if not response:
        return {"message": "OK"}

    content = response.get("content", {})
    json_content = content.get("application/json", {})
    schema = json_content.get("schema", {})

    # Check for example
    if "example" in json_content:
        return json_content["example"]
    if "example" in schema:
        return schema["example"]

    # Resolve $ref
    if "$ref" in schema:
        ref_name = schema["$ref"].split("/")[-1]
        schema = schemas.get(ref_name, {})

    return generate_from_type(schema, schemas)

def generate_from_type(schema: dict, schemas: dict, depth: int = 0) -> any:
    """Generate mock data from JSON Schema type."""
    if depth > 5:  # Prevent infinite recursion
        return None

    if "$ref" in schema:
        ref_name = schema["$ref"].split("/")[-1]
        schema = schemas.get(ref_name, {})

    schema_type = schema.get("type", "object")

    if "example" in schema:
        return schema["example"]
    if "enum" in schema:
        return schema["enum"][0]
    if "default" in schema:
        return schema["default"]

    match schema_type:
        case "string":
            fmt = schema.get("format", "")
            if fmt == "email": return "{{faker.email}}"
            if fmt == "uuid": return "{{randomUUID}}"
            if fmt == "date-time": return "{{now}}"
            if fmt == "date": return "2026-04-08"
            if fmt == "uri": return "https://example.com"
            return "{{faker.word}}"

        case "integer":
            return "{{randomInt 1 1000}}"

        case "number":
            return "{{randomFloat 0 100 2}}"

        case "boolean":
            return True

        case "array":
            items = schema.get("items", {})
            item = generate_from_type(items, schemas, depth + 1)
            return [item, item]

        case "object":
            result = {}
            for prop_name, prop_schema in schema.get("properties", {}).items():
                result[prop_name] = generate_from_type(prop_schema, schemas, depth + 1)
            return result

        case _:
            return None
```

---

## 25. Appendix E: Python Dependencies

```txt
# backend/requirements.txt

# FastAPI & Server
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
python-multipart>=0.0.9

# Database
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
alembic>=1.13.0

# Validation & Serialization
pydantic>=2.9.0
pydantic-settings>=2.5.0
jsonschema>=4.23.0

# Redis & Async
redis>=5.0.0
aioredis>=2.0.0

# HTTP & Networking
httpx>=0.27.0
slowapi>=0.1.9

# Authentication
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
cryptography>=42.0.0

# Email
emails>=0.6
sendgrid>=6.10.0

# Scheduling
apscheduler>=3.10.0

# Monitoring
sentry-sdk[fastapi]>=2.0.0

# OpenAPI & Validation (Mock Feature)
pyyaml>=6.0
openapi-spec-validator>=0.7.0

# Realistic Data Generation (Mock Feature)
faker>=30.0.0

# Development/Testing
pytest>=8.0.0
pytest-asyncio>=0.23.0
pytest-cov>=5.0.0
black>=24.0.0
flake8>=7.0.0
mypy>=1.10.0
```

---

## Summary

This document provides a complete technical specification for building HookTrap V2 from scratch. It includes:

- **Two core features**: Webhook testing sandbox + Mock API server for teams
- **Full database schema** with workspace, mock, and team management
- **Complete REST API** with 40+ endpoints for all functionality
- **Mock serving engine** with template engine, rule matching, sequences
- **Frontend architecture** with 10+ new pages for workspace and mock management
- **Testing requirements** covering all major features
- **8-phase implementation plan** spanning 12 weeks
- **Appendices** with specific algorithms for templates, path matching, OpenAPI import

The document is implementation-ready for Claude Code. All endpoints, database schemas, and algorithms are fully specified.

End of specification V2. This document contains everything needed to build HookTrap with Mock API support from scratch. Feed it to Claude Code and start with Phase 1.
