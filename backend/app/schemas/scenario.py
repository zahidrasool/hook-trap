import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ScenarioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class ScenarioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    steps: list | None = None
    variables: dict | None = None
    timeout_seconds: int | None = Field(default=None, ge=1, le=3600)
    is_active: bool | None = None


class ScenarioResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    short_id: str
    name: str
    slug: str
    description: str | None
    steps: list
    variables: dict
    timeout_seconds: int
    is_active: bool
    # Where this scenario's mocks serve, and where its webhooks land.
    scenario_url: str
    capture_url: str | None
    created_at: datetime


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioResponse]
    total: int
