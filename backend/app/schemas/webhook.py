import uuid
from datetime import datetime

from pydantic import BaseModel


class WebhookCaptureResponse(BaseModel):
    id: uuid.UUID
    endpoint_id: uuid.UUID
    http_method: str
    path: str | None
    query_params: dict
    headers: dict
    body: str | None
    body_size: int
    content_type: str | None
    source_ip: str | None
    captured_at: datetime

    model_config = {"from_attributes": True}


class CaptureListResponse(BaseModel):
    data: list[WebhookCaptureResponse]
    total: int
    limit: int
    offset: int


class CaptureAckResponse(BaseModel):
    status: str = "captured"
    timestamp: datetime
