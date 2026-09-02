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
from app.services.openapi_import_service import import_openapi_spec
from app.services.spec_format import detect_spec_format
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

    # An OpenAPI document pasted here is dispatched to the OpenAPI importer
    # rather than rejected for lacking a 'models' key.
    if detect_spec_format(body.config) == "openapi":
        spec_result = await import_openapi_spec(
            workspace_id=workspace.id,
            spec_content=body.config,
            spec_format="json" if body.config.lstrip().startswith("{") else "yaml",
            name=None,
            uploaded_by=user.id,
            db=db,
        )
        if not spec_result["success"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=spec_result["error"]
            )
        await db.commit()

        data = spec_result["data"]
        # Reported through the same response shape; an OpenAPI spec has paths
        # rather than models, so models_processed stays 0.
        return ConfigImportResponse(
            success=True,
            models_processed=0,
            endpoints_created=[
                ConfigImportEndpoint(
                    method=ep.get("method", "GET"),
                    path=ep.get("path", ""),
                    name=ep.get("summary") or ep.get("path", ""),
                    status_code=200,
                )
                for ep in data.get("endpoints", [])
            ],
            errors=[],
        )

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
