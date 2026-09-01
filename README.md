# MockLane

**Webhook capture, mock API builder, and request replay — all in one platform.**

MockLane is a developer tool that lets you capture incoming webhooks, build mock API endpoints with dynamic data generators, and replay requests — all from a single, team-friendly dashboard.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Docker (Recommended)](#option-1-docker-recommended)
  - [Manual Setup](#option-2-manual-setup)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Fake SMTP Inbox** — Capture all outgoing emails from your app. Point your SMTP config to MockLane and emails land in your workspace inbox instead of reaching real recipients. Preview HTML, inspect headers, download attachments
- **Webhook Capture** — Generate unique URLs, receive and inspect incoming webhook payloads in real time
- **Mock API Builder** — Define endpoints with custom status codes, headers, and response bodies
- **200+ Data Generators** — Use `{{faker.name}}`, `{{faker.email}}`, `{{faker.uuid}}` and more for realistic dynamic responses
- **Template Engine** — Handlebars-style templates with conditionals, loops, and request context variables
- **Conditional Rules** — Route responses based on request headers, query params, or body content
- **Response Sequences** — Return different responses on successive calls (rotate, loop, or exhaust)
- **OpenAPI Import** — Drop in a Swagger/OpenAPI spec and auto-generate mock endpoints
- **YAML Config Import** — Define mock endpoints declaratively with YAML configuration files
- **Request Replay** — Replay any captured webhook with one click; modify headers/body before resending
- **Team Workspaces** — Collaborate with role-based access control (viewer, editor, admin)
- **Contract Validation** — Validate mock responses against OpenAPI schemas
- **REST API** — Full CRUD API with filtering, sorting, pagination, and nested resources
- **Request Logs** — Searchable log of every request hitting your mock endpoints
- **CORS Support** — Configurable cross-origin headers for browser-based testing
- **Self-Hostable** — Deploy with Docker, AWS Lambda, or App Runner

---

## Architecture

```
                         ┌──────────────────────────────────────┐
                         │            Client / Browser          │
                         └──────────────┬───────────────────────┘
                                        │
                         ┌──────────────▼───────────────────────┐
                         │        Next.js Frontend (:3000)      │
                         │                                      │
                         │  Landing ─ Dashboard ─ Docs ─ Why    │
                         │  Captures ─ Mocks ─ Workspaces       │
                         │  Auth ─ Settings ─ Import Wizard     │
                         └──────────────┬───────────────────────┘
                                        │ HTTP / WebSocket
                         ┌──────────────▼───────────────────────┐
                         │       FastAPI Backend (:8000)         │
                         │                                      │
                         │  /api/v1/auth      Auth & Sessions   │
                         │  /api/v1/endpoints Webhook Endpoints  │
                         │  /api/v1/captures  Captured Requests  │
                         │  /api/v1/workspaces  Workspaces      │
                         │  /api/v1/mocks     Mock CRUD          │
                         │  /api/v1/mock-rules  Rules & Seqs    │
                         │  /api/v1/mock-logs   Request Logs    │
                         │  /api/v1/openapi   OpenAPI Import    │
                         │  /api/v1/config    YAML Import       │
                         │  /mock/*           Mock Serving       │
                         │  /replay/*         Request Replay     │
                         │                                      │
                         │  SMTP Server (:2525)  Email Capture  │
                         └─────┬──────────────────┬─────────────┘
                               │                  │
                  ┌────────────▼────┐    ┌────────▼────────┐
                  │  PostgreSQL 15  │    │   Redis 7       │
                  │                 │    │                 │
                  │  Users          │    │  Sessions       │
                  │  Workspaces     │    │  Rate Limits    │
                  │  Endpoints      │    │  Cache          │
                  │  Captures       │    │  WebSocket Pub  │
                  │  Mock Endpoints │    │                 │
                  │  Mock Rules     │    │                 │
                  │  Mock Sequences │    │                 │
                  │  Request Logs   │    │                 │
                  │  OpenAPI Specs  │    │                 │
                  │  Inbox Emails   │    │                 │
                  └─────────────────┘    └─────────────────┘
```

### Request Flow

1. **Webhook Capture**: External service → `POST /w/{endpoint_id}` → Backend stores payload → WebSocket pushes to dashboard
2. **Mock Serving**: Client → `GET/POST /mock/{workspace}/{path}` → Template engine renders response with faker data → Returns dynamic JSON
3. **Fake Inbox**: App SMTP → `SMTP :2525` (authenticated per workspace) → Backend parses email → Stores in PostgreSQL → Dashboard shows in Inbox tab
4. **Replay**: Dashboard → `POST /api/v1/replay/{capture_id}` → Backend re-sends original request to target URL

---

## Tech Stack

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS      |
| **State**    | Zustand (global), TanStack Query (server), Socket.IO (realtime)  |
| **Backend**  | FastAPI, Python 3.12, Uvicorn, Pydantic v2                       |
| **Database** | PostgreSQL 15 (via SQLAlchemy 2.0 async + asyncpg)               |
| **Cache**    | Redis 7 (sessions, rate limiting, pub/sub)                       |
| **Auth**     | Passwordless magic links (JOSE JWT tokens)                       |
| **Email**    | SendGrid (magic link delivery)                                   |
| **Mock Data**| Faker (200+ generators), custom template engine                  |
| **SMTP**     | aiosmtpd (fake inbox email capture server)                       |
| **Import**   | openapi-spec-validator, PyYAML                                   |
| **Infra**    | Docker, AWS Lambda (Mangum), App Runner, SAM, Amplify            |

---

## Project Structure

```
MockLane/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── auth.py            # Magic link auth endpoints
│   │   │   │   ├── endpoints.py       # Webhook endpoint CRUD
│   │   │   │   ├── webhook.py         # Capture listing & retrieval
│   │   │   │   ├── replay.py          # Request replay
│   │   │   │   ├── workspaces.py      # Workspace CRUD & members
│   │   │   │   ├── mocks.py           # Mock endpoint CRUD
│   │   │   │   ├── mock_rules.py      # Conditional rules & sequences
│   │   │   │   ├── mock_logs.py       # Request log queries
│   │   │   │   ├── openapi_import.py  # OpenAPI/Swagger import
│   │   │   │   ├── config_import.py   # YAML config import
│   │   │   │   └── router.py          # API router aggregation
│   │   │   ├── mock_serve.py          # Mock endpoint serving engine
│   │   │   └── deps.py               # Dependency injection
│   │   ├── models/                    # SQLAlchemy ORM models
│   │   ├── schemas/                   # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── auth_service.py        # JWT & magic link logic
│   │   │   ├── template_engine.py     # Handlebars-style template rendering
│   │   │   ├── mock_service.py        # Mock endpoint business logic
│   │   │   ├── webhook_service.py     # Webhook capture logic
│   │   │   ├── replay_service.py      # HTTP replay logic
│   │   │   ├── workspace_service.py   # Workspace & member management
│   │   │   ├── openapi_import_service.py
│   │   │   ├── config_import_service.py
│   │   │   ├── contract_validator.py  # Schema validation
│   │   │   └── email_service.py       # SendGrid integration
│   │   ├── utils/                     # CORS, rate limiting, validators
│   │   ├── db/                        # Database & Redis connections
│   │   ├── config.py                  # Pydantic settings
│   │   └── main.py                    # FastAPI app entry point
│   ├── alembic/                       # Database migrations
│   ├── tests/                         # Pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # Landing page
│   │   │   ├── docs/page.tsx          # Documentation (Nextra-style)
│   │   │   ├── why/page.tsx           # Why MockLane + competitor comparison
│   │   │   ├── auth/login/page.tsx    # Magic link login
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx           # Dashboard home
│   │   │   │   ├── captures/          # Webhook capture viewer
│   │   │   │   ├── settings/          # User settings
│   │   │   │   └── workspace/[id]/
│   │   │   │       ├── mocks/         # Mock endpoint management
│   │   │   │       ├── members/       # Team member management
│   │   │   │       ├── settings/      # Workspace settings
│   │   │   │       └── import/        # OpenAPI/YAML import
│   │   │   └── api/auth/             # Auth API routes (callback, logout)
│   │   ├── components/
│   │   │   ├── common/               # Button, Card, Dialog, Badge, etc.
│   │   │   ├── layout/               # Header, Sidebar, Footer
│   │   │   ├── mock/                 # MockEditor, ResponseRuleEditor, etc.
│   │   │   ├── webhook/              # CaptureList, CaptureDetail, Replay
│   │   │   └── workspace/            # MemberList, WorkspaceStats, etc.
│   │   ├── hooks/                    # useAuth, useWorkspace, useWebSocket
│   │   ├── stores/                   # Zustand stores
│   │   ├── lib/                      # API client, utils
│   │   └── types/                    # TypeScript type definitions
│   ├── Dockerfile
│   ├── tailwind.config.ts
│   └── package.json
├── infrastructure/
│   ├── template.yaml                 # AWS SAM (Lambda + API Gateway)
│   ├── apprunner.yaml                # AWS App Runner
│   ├── amplify.yml                   # AWS Amplify (frontend)
│   ├── buildspec.yml                 # CodeBuild spec
│   └── deploy.sh                     # Deployment script
├── docker-compose.yml
└── README.md
```

---

## Prerequisites

- **Docker** & **Docker Compose** (for containerized setup)
- **Node.js** >= 20 and **npm** (for frontend development)
- **Python** >= 3.12 (for backend development)
- **PostgreSQL** 15+ (or use Docker)
- **Redis** 7+ (or use Docker)

---

## Getting Started

### Option 1: Docker (Recommended)

The fastest way to get everything running:

```bash
# Clone the repo
git clone https://github.com/your-org/mocklane.git
cd mocklane

# Start all services
docker-compose up
```

This launches:

| Service      | URL                    |
| ------------ | ---------------------- |
| Frontend     | http://localhost:3000   |
| Backend API  | http://localhost:8000   |
| API Docs     | http://localhost:8000/docs |
| PostgreSQL   | localhost:5432         |
| Redis        | localhost:6379         |

### Option 2: Manual Setup

#### 1. Start databases

```bash
# Using Docker for just the databases
docker-compose up postgres redis
```

Or install PostgreSQL and Redis locally.

#### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp ../.env.example .env
# Edit .env and set a strong SECRET_KEY (min 32 chars)

# Run database migrations
alembic upgrade head

# Start the backend
uvicorn app.main:app --reload --port 8000
```

#### 3. Frontend

```bash
cd frontend

# Create environment file
cp .env.example .env.local

# Install dependencies
npm install

# Start the dev server
npm run dev
```

#### 4. Open the app

- **App**: http://localhost:3000
- **Documentation**: http://localhost:3000/docs
- **Why MockLane**: http://localhost:3000/why
- **API Swagger UI**: http://localhost:8000/docs

---

## Configuration

### Backend Environment Variables

| Variable                 | Default                          | Description                              |
| ------------------------ | -------------------------------- | ---------------------------------------- |
| `DATABASE_URL`           | `postgresql+asyncpg://postgres:postgres@localhost:5432/mocklane` | PostgreSQL connection string |
| `REDIS_URL`              | `redis://localhost:6379`         | Redis connection string                  |
| `SECRET_KEY`             | *(must change)*                  | JWT signing key (min 32 characters)      |
| `MAGIC_LINK_EXPIRY_HOURS`| `24`                            | Magic link expiration time               |
| `SESSION_EXPIRY_DAYS`   | `30`                             | Session token lifetime                   |
| `SENDGRID_API_KEY`       | —                                | SendGrid API key for magic link emails   |
| `SENDGRID_FROM_EMAIL`    | `noreply@mocklane.com`          | Sender email address                     |
| `ENVIRONMENT`            | `development`                   | `development` / `production`             |
| `API_BASE_URL`           | `http://localhost:8000`         | Backend base URL (for email links)       |
| `FRONTEND_BASE_URL`      | `http://localhost:3000`         | Frontend base URL (for email links)      |
| `SENTRY_DSN`             | —                                | Sentry error tracking (optional)         |
| `SMTP_SERVER_HOST`       | `0.0.0.0`                       | SMTP server bind address                 |
| `SMTP_SERVER_PORT`       | `2525`                          | SMTP server port for fake inbox          |
| `SMTP_SERVER_HOSTNAME`   | `inbox.mocklane.com`            | SMTP server advertised hostname          |
| `RATE_LIMIT_ENABLED`     | `true`                          | Enable API rate limiting                 |

### Frontend Environment Variables

| Variable               | Default                    | Description                    |
| ---------------------- | -------------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL`  | `http://localhost:8000`    | Backend API base URL           |
| `NEXT_PUBLIC_WS_URL`   | `ws://localhost:8000`      | WebSocket connection URL       |
| `NEXT_PUBLIC_APP_NAME` | `MockLane`                 | App name shown in UI           |

---

## API Reference

The backend exposes a RESTful API with automatic Swagger documentation at `/docs`.

### Key Endpoints

| Method   | Path                                    | Description                     |
| -------- | --------------------------------------- | ------------------------------- |
| `POST`   | `/api/v1/auth/magic-link`               | Request a magic link            |
| `GET`    | `/api/v1/auth/verify`                   | Verify magic link token         |
| `GET`    | `/api/v1/workspaces`                    | List user workspaces            |
| `POST`   | `/api/v1/workspaces`                    | Create a workspace              |
| `GET`    | `/api/v1/endpoints`                     | List webhook endpoints          |
| `POST`   | `/api/v1/endpoints`                     | Create a webhook endpoint       |
| `GET`    | `/api/v1/captures`                      | List captured webhooks          |
| `POST`   | `/api/v1/replay/{capture_id}`           | Replay a captured request       |
| `GET`    | `/api/v1/workspaces/{id}/mocks`         | List mock endpoints             |
| `POST`   | `/api/v1/workspaces/{id}/mocks`         | Create a mock endpoint          |
| `POST`   | `/api/v1/workspaces/{id}/openapi/import`| Import OpenAPI spec             |
| `GET`    | `/api/v1/workspaces/{id}/inbox`         | List captured emails            |
| `GET`    | `/api/v1/workspaces/{id}/inbox/{email}` | Get email with full body        |
| `GET`    | `/api/v1/workspaces/{id}/inbox/smtp-credentials` | Get SMTP credentials |
| `ANY`    | `/mock/{workspace}/{path}`              | Serve mock responses            |
| `POST`   | `/w/{endpoint_id}`                      | Receive webhooks                |

Full interactive documentation is available at `http://localhost:8000/docs` when the backend is running.

---

## Deployment

### AWS Serverless (Lambda)

```bash
cd infrastructure
sam build
sam deploy --guided
```

Uses `template.yaml` — deploys FastAPI on Lambda via Mangum adapter with API Gateway, Aurora Serverless, and ElastiCache.

### AWS App Runner

```bash
cd infrastructure
# Edit apprunner.yaml with your ECR image URI
aws apprunner create-service --cli-input-yaml file://apprunner.yaml
```

Better for steady traffic and WebSocket support.

### AWS Amplify (Frontend)

Connect your repo to AWS Amplify and it will auto-detect the `amplify.yml` build spec in `/infrastructure`.

### Docker (Self-Hosted)

```bash
docker-compose -f docker-compose.yml up -d
```

For production, update environment variables (especially `SECRET_KEY`, `SENDGRID_API_KEY`) and use a managed database.

---

## Running Tests

```bash
cd backend

# Install dev dependencies
pip install -r requirements-dev.txt

# Run all tests
pytest

# Run with coverage
pytest --cov=app
```

---

## Contributing

For team members with repository access:

1. Create a feature branch (`git checkout -b feat/your-feature`)
2. Commit your changes (`git commit -m 'feat: add your feature'`)
3. Push to the branch (`git push origin feat/your-feature`)
4. Open a Pull Request for review

---

## License

Copyright &copy; MockLane. All rights reserved.

This is proprietary software. The source code is not licensed for redistribution,
modification, or commercial use without express written permission.
