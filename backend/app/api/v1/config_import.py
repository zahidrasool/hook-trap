from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.config_import import (
    ConfigImportRequest,
    ConfigImportEndpoint,
    ConfigImportResponse,
)
from app.services.config_import_service import import_config
from app.services.workspace_service import get_workspace_by_short_id, check_workspace_access

router = APIRouter()


@router.post(
    "/workspaces/{short_id}/import-config",
    response_model=ConfigImportResponse,
    status_code=status.HTTP_200_OK,
)
async def import_yaml_config(
    short_id: str,
    body: ConfigImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a YAML config to auto-generate CRUD mock endpoints."""
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    result = await import_config(
        config_yaml=body.config,
        workspace_id=workspace.id,
        created_by=user.id,
        db=db,
        overwrite=body.overwrite,
    )

    await db.commit()

    return ConfigImportResponse(
        success=True,
        models_processed=result["models_processed"],
        endpoints_created=[
            ConfigImportEndpoint(**ep) for ep in result["created"]
        ],
        errors=result["errors"],
    )


@router.post(
    "/workspaces/{short_id}/import-config-file",
    response_model=ConfigImportResponse,
    status_code=status.HTTP_200_OK,
)
async def import_yaml_config_file(
    short_id: str,
    file: UploadFile = File(...),
    overwrite: bool = Form(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a YAML config file to auto-generate CRUD mock endpoints."""
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    content = await file.read()
    config_yaml = content.decode("utf-8")

    result = await import_config(
        config_yaml=config_yaml,
        workspace_id=workspace.id,
        created_by=user.id,
        db=db,
        overwrite=overwrite,
    )

    await db.commit()

    return ConfigImportResponse(
        success=True,
        models_processed=result["models_processed"],
        endpoints_created=[
            ConfigImportEndpoint(**ep) for ep in result["created"]
        ],
        errors=result["errors"],
    )
