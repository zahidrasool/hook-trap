from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.endpoints import router as endpoints_router
from app.api.v1.webhook import router as webhook_router
from app.api.v1.replay import router as replay_router
from app.api.v1.workspaces import router as workspaces_router
from app.api.v1.mocks import router as mocks_router
from app.api.v1.mock_rules import router as mock_rules_router
from app.api.v1.mock_logs import router as mock_logs_router
from app.api.v1.openapi_import import router as openapi_import_router
from app.api.v1.config_import import router as config_import_router
from app.api.v1.inbox import router as inbox_router
from app.api.v1.sandboxes import router as sandboxes_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(endpoints_router, prefix="/endpoints", tags=["endpoints"])
api_router.include_router(webhook_router, prefix="/captures", tags=["captures"])
api_router.include_router(replay_router, tags=["replay"])
api_router.include_router(workspaces_router, prefix="/workspaces", tags=["workspaces"])
api_router.include_router(mocks_router, tags=["mocks"])
api_router.include_router(mock_rules_router, tags=["mock-rules"])
api_router.include_router(mock_logs_router, tags=["mock-logs"])
api_router.include_router(openapi_import_router, tags=["openapi"])
api_router.include_router(config_import_router, tags=["config-import"])
api_router.include_router(inbox_router, tags=["inbox"])
api_router.include_router(sandboxes_router, tags=["sandboxes"])
