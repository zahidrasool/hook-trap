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


# --- Replay schemas (Phase 2) ---


class ReplaySessionCreate(BaseModel):
    name: str | None = None
    endpoint_id: uuid.UUID


class ReplaySessionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    endpoint_id: uuid.UUID
    name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReplayRequestCreate(BaseModel):
    capture_id: uuid.UUID
    target_url: str
    modifications: dict | None = None


class ReplayRequestResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    capture_id: uuid.UUID | None
    target_url: str
    modifications: dict | None
    response_status: int | None
    response_body: str | None
    response_time_ms: int | None
    error_message: str | None
    replayed_at: datetime

    model_config = {"from_attributes": True}


class ReplaySessionDetailResponse(ReplaySessionResponse):
    requests: list[ReplayRequestResponse] = []

    model_config = {"from_attributes": True}
