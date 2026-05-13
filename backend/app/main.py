from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.database import engine, Base
from app.db.redis import redis_client
from app.api.v1.router import api_router
from app.api.v1.captures import router as captures_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await redis_client.initialize()
    yield
    # Shutdown
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


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}
