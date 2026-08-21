import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.openapi_spec import OpenAPISpec
from app.models.user import User
from app.schemas.openapi import (
    OpenAPIImportRequest,
    OpenAPIImportResponse,
    OpenAPISpecResponse,
    OpenAPISpecListResponse,
)
from app.services.openapi_import_service import import_openapi_spec, parse_openapi_spec
from app.services.workspace_service import get_workspace_by_short_id, check_workspace_access

router = APIRouter()


# --- Preview endpoint (called by OpenAPI Import Wizard step 1) ---
@router.post("/workspaces/{short_id}/openapi/preview")
async def preview_openapi(
    short_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Parse an OpenAPI spec and return detected endpoints without importing."""
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    content = body.get("content", "")
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No spec content provided")

    result = parse_openapi_spec(content)
    if not result["success"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])

    return {"endpoints": result["endpoints"]}


# --- Import endpoint (called by OpenAPI Import Wizard step 2) ---
@router.post("/workspaces/{short_id}/openapi/import")
async def import_openapi_selected(
    short_id: str,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import selected endpoints from an OpenAPI spec."""
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    content = body.get("content", "")
    selected_endpoints = body.get("endpoints")

    # Detect format
    spec_format = "yaml"
    try:
        import json as _json
        _json.loads(content)
        spec_format = "json"
    except Exception:
        pass

    result = await import_openapi_spec(
        workspace_id=workspace.id,
        spec_content=content,
        spec_format=spec_format,
        name=None,
        uploaded_by=user.id,
        db=db,
        selected_endpoints=selected_endpoints,
    )

    if not result["success"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])

    await db.commit()

    data = result["data"]
    return {
        "created": data.get("endpoints_created", 0),
        "skipped": data.get("endpoints_skipped", 0),
        "errors": [],
    }


# --- Legacy import endpoint ---
@router.post(
    "/workspaces/{short_id}/import-openapi",
    response_model=OpenAPIImportResponse,
    status_code=status.HTTP_200_OK,
)
async def import_openapi(
    short_id: str,
    body: OpenAPIImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import an OpenAPI spec from a JSON request body."""
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    result = await import_openapi_spec(
        workspace_id=workspace.id,
        spec_content=body.spec,
        spec_format=body.format,
        name=body.name,
        uploaded_by=user.id,
        db=db,
    )

    if not result["success"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])

    await db.commit()
    return OpenAPIImportResponse(success=True, data=result["data"])


@router.post(
    "/workspaces/{short_id}/import-openapi/upload",
    response_model=OpenAPIImportResponse,
    status_code=status.HTTP_200_OK,
)
async def import_openapi_file(
    short_id: str,
    file: UploadFile = File(...),
    name: str | None = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import an OpenAPI spec from a file upload."""
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    content = await file.read()
    spec_content = content.decode("utf-8")

    # Detect format from filename
    filename = file.filename or ""
    if filename.endswith(".json"):
        spec_format = "json"
    else:
        spec_format = "yaml"

    result = await import_openapi_spec(
        workspace_id=workspace.id,
        spec_content=spec_content,
        spec_format=spec_format,
        name=name,
        uploaded_by=user.id,
        db=db,
    )

    if not result["success"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result["error"])

    await db.commit()
    return OpenAPIImportResponse(success=True, data=result["data"])


@router.get(
    "/workspaces/{short_id}/openapi-specs",
    response_model=OpenAPISpecListResponse,
)
async def list_openapi_specs(
    short_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded OpenAPI specs for a workspace."""
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(OpenAPISpec)
        .where(OpenAPISpec.workspace_id == workspace.id)
        .order_by(OpenAPISpec.created_at.desc())
    )
    specs = result.scalars().all()

    return OpenAPISpecListResponse(
        data=[OpenAPISpecResponse.model_validate(s) for s in specs]
    )


@router.delete(
    "/workspaces/{short_id}/openapi-specs/{spec_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_openapi_spec(
    short_id: str,
    spec_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an uploaded OpenAPI spec."""
    workspace = await get_workspace_by_short_id(short_id, db)
    if not workspace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    member = await check_workspace_access(workspace.id, user.id, db, min_role="editor")
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required")

    result = await db.execute(
        select(OpenAPISpec).where(
            OpenAPISpec.id == spec_id,
            OpenAPISpec.workspace_id == workspace.id,
        )
    )
    spec = result.scalar_one_or_none()
    if not spec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spec not found")

    await db.delete(spec)
    await db.commit()
