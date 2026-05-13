from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.endpoints import router as endpoints_router
from app.api.v1.webhook import router as webhook_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(endpoints_router, prefix="/endpoints", tags=["endpoints"])
api_router.include_router(webhook_router, prefix="/captures", tags=["captures"])

# Future phase routers (uncomment when implemented):
# from app.api.v1.workspaces import router as workspaces_router
# from app.api.v1.mocks import router as mocks_router
# api_router.include_router(workspaces_router, prefix="/workspaces", tags=["workspaces"])
# api_router.include_router(mocks_router, tags=["mocks"])
