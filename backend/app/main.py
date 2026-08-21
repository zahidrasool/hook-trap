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
        ]
        for sql in migrations:
            await conn.execute(text(sql))

    await redis_client.initialize()

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
    title="HookTrap",
    description="Webhook testing sandbox & mock API platform",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
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

# API routes
app.include_router(api_router, prefix="/api/v1")

# Webhook capture route (top-level, no prefix)
app.include_router(captures_router)

# Mock serving route (top-level, no prefix)
app.include_router(mock_serve_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}
