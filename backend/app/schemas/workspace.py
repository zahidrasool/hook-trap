import uuid
from datetime import datetime
from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str
    description: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_public: bool | None = None


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    short_id: str
    name: str
    description: str | None
    mock_base_url: str
    owner_id: uuid.UUID
    created_at: datetime
    member_count: int = 1
    mock_count: int = 0
    role: str | None = None
    is_public: bool = True
    api_key: str | None = None

    model_config = {"from_attributes": True}


class WorkspaceListResponse(BaseModel):
    data: list[WorkspaceResponse]


class MemberInvite(BaseModel):
    email: str
    role: str = "editor"


class MemberUpdate(BaseModel):
    role: str


class MemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    email: str | None = None
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class MemberListResponse(BaseModel):
    data: list[MemberResponse]
