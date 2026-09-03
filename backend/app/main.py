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


# Mock endpoints have the opposite requirement: any origin must be able to call
# them, since the point is to stand in for a backend that a customer's frontend
# talks to.
#
# CORSMiddleware answers preflights itself and rejects unknown origins with 400
# before routing, so the handler in mock_serve never saw them and every
# cross-origin POST/PUT/DELETE failed. Registered after CORSMiddleware, which
# in Starlette means it wraps it and runs first, so /m/ preflights are answered
# here and never reach the strict allow-list.
@app.middleware("http")
async def allow_any_origin_for_mocks(request, call_next):
    if request.url.path.startswith("/m/") and request.method == "OPTIONS":
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
