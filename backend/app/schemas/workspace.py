# Workspace schemas - placeholder for Phase 3
import uuid
from datetime import datetime
from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str
    description: str | None = None


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    short_id: str
    name: str
    description: str | None
    mock_base_url: str
    owner_id: uuid.UUID
    created_at: datetime
    member_count: int = 1

    model_config = {"from_attributes": True}
