import uuid
from datetime import datetime

from pydantic import BaseModel


class EndpointCreate(BaseModel):
    name: str | None = None
    description: str | None = None


class EndpointResponse(BaseModel):
    id: uuid.UUID
    short_id: str
    name: str | None
    description: str | None
    endpoint_url: str
    created_at: datetime

    model_config = {"from_attributes": True}


class EndpointListResponse(BaseModel):
    data: list[EndpointResponse]
    total: int
