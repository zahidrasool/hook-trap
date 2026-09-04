from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.database import engine
from app.models.base import Base
from app.models import *  # noqa: F401 — ensure all models are registered with Base.metadata
from app.db.redis import redis_client
from app.api.v1.router import api_router
from app.api.v1.captures import router as captures_router
from app.api.mock_serve import router as mock_serve_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Add new columns to existing tables (safe: IF NOT EXISTS)
        from sqlalchemy import text
        migrations = [
            "ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE",
            "ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS api_key VARCHAR(64)",
            "ALTER TABLE mock_endpoints ADD COLUMN IF NOT EXISTS static_data JSONB",
            "ALTER TABLE mock_endpoints ADD COLUMN IF NOT EXISTS is_immutable BOOLEAN DEFAULT FALSE",
            "ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS smtp_username VARCHAR(64) UNIQUE",
            "ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS smtp_password VARCHAR(128)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) UNIQUE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE",
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
        ]
        for sql in migrations:
            await conn.execute(text(sql))

    try:
        await redis_client.initialize()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Redis unavailable, continuing without it: %s", e)

    # Start fake SMTP inbox server
    try:
        from app.services.smtp_server import start_smtp_server, stop_smtp_server
        await start_smtp_server()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("SMTP server failed to start: %s", e)

    yield

    # Shutdown
    try:
        from app.services.smtp_server import stop_smtp_server
        await stop_smtp_server()
    except Exception:
        pass
    await redis_client.close()
    await engine.dispose()


settings = get_settings()

app = FastAPI(
    title="MockLane",
    description="Webhook testing sandbox & mock API platform",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS for the dashboard API: a strict allow-list, with credentials, so only
# our own frontend may call it from a browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_base_url,
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Public ingest paths accept unauthenticated writes, so cap the body. Without
# this a single script can fill the volume that Postgres, the app and the SMTP
# server all share on this host.
MAX_INGEST_BODY_BYTES = 1_048_576  # 1 MiB


@app.middleware("http")
async def limit_public_ingest(request, call_next):
    from fastapi.responses import JSONResponse

    path = request.url.path
    is_capture = path.startswith("/h/")
    # Scenario URLs are the same serving path under a different namespace, so
    # they share the mock budget rather than getting an unmetered one.
    is_mock = path.startswith("/m/") or path.startswith("/s/")

    if is_capture or is_mock:
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > MAX_INGEST_BODY_BYTES:
            return JSONResponse(
                {"error": "Request body too large", "max_bytes": MAX_INGEST_BODY_BYTES},
                status_code=413,
                headers={"Access-Control-Allow-Origin": "*"},
            )

        # Capture writes a row per request, so it gets the tighter budget.
        from app.services.rate_limit import (
            check_rate_limit_detailed,
            client_ip,
            rate_limit_headers,
        )

        bucket = "capture" if is_capture else "mock"
        limit = 60 if is_capture else 300
        allowed, retry, remaining = await check_rate_limit_detailed(
            f"{bucket}:{client_ip(request)}", limit=limit, window=60
        )
        headers = rate_limit_headers(limit, remaining, retry or 60)

        if not allowed:
            return JSONResponse(
                {"error": "Rate limit exceeded", "retry_after_seconds": retry},
                status_code=429,
                headers={
                    **headers,
                    "Retry-After": str(retry),
                    "Access-Control-Allow-Origin": "*",
                },
            )

        # Advertise the budget on every response, so a client can back off
        # before it is blocked rather than discovering the limit by hitting it.
        response = await call_next(request)
        for name, value in headers.items():
            response.headers[name] = value
        return response

    return await call_next(request)


# Mock endpoints have the opposite requirement: any origin must be able to call
# them, since the point is to stand in for a backend that a customer's frontend
# talks to.
#
# CORSMiddleware answers preflights itself and rejects unknown origins with 400
# before routing, so the handler in mock_serve never saw them and every
# cross-origin POST/PUT/DELETE failed. Registered after CORSMiddleware, which
# in Starlette means it wraps it and runs first, so /m/ preflights are answered
# here and never reach the strict allow-list.
#
# Being outermost also means preflights are answered before the limiter below,
# which is deliberate: they write nothing and should not consume a client's
# budget for real requests.
@app.middleware("http")
async def allow_any_origin_for_mocks(request, call_next):
    if request.url.path.startswith(("/m/", "/s/")) and request.method == "OPTIONS":
        from fastapi.responses import Response

        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
                "Access-Control-Allow-Headers": request.headers.get(
                    "Access-Control-Request-Headers",
                    "Content-Type, Authorization, X-Requested-With",
                ),
                "Access-Control-Max-Age": "86400",
            },
        )
    return await call_next(request)

# API routes
app.include_router(api_router, prefix="/api/v1")

# Webhook capture route (top-level, no prefix)
app.include_router(captures_router)

# Mock serving route (top-level, no prefix)
app.include_router(mock_serve_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}
