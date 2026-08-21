import uuid
from datetime import datetime
from pydantic import BaseModel


class OpenAPIImportRequest(BaseModel):
    spec: str
    format: str = "yaml"
    name: str | None = None


class OpenAPIImportResult(BaseModel):
    path: str
    method: str
    action: str
    summary: str | None = None


class OpenAPIImportResponse(BaseModel):
    success: bool
    data: dict | None = None
    error: str | None = None


class OpenAPISpecResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str | None
    version: str | None
    spec_format: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OpenAPISpecListResponse(BaseModel):
    data: list[OpenAPISpecResponse]
