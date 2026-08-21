import uuid
from datetime import datetime
from pydantic import BaseModel


class MockEndpointCreate(BaseModel):
    path: str
    method: str
    name: str | None = None
    description: str | None = None
    response_status: int = 200
    response_headers: dict | None = None
    response_body: str | None = None
    response_delay_ms: int = 0
    error_rate: float = 0.0
    error_status: int = 500
    error_body: str | None = None
    static_data: list | None = None
    is_immutable: bool = False


class MockEndpointUpdate(BaseModel):
    path: str | None = None
    method: str | None = None
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None
    priority: int | None = None
    response_status: int | None = None
    response_headers: dict | None = None
    response_body: str | None = None
    response_delay_ms: int | None = None
    error_rate: float | None = None
    error_status: int | None = None
    error_body: str | None = None
    static_data: list | None = None
    is_immutable: bool | None = None


class MockEndpointResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    path: str
    method: str
    name: str | None
    description: str | None = None
    mock_url: str | None = None
    is_active: bool
    priority: int
    response_status: int
    response_headers: dict | None
    response_body: str | None
    response_delay_ms: int
    error_rate: float
    error_status: int
    error_body: str | None
    request_count: int
    static_data: list | None = None
    is_immutable: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class MockEndpointListResponse(BaseModel):
    data: list[MockEndpointResponse]
    total: int


class MockEndpointDetailResponse(MockEndpointResponse):
    rules: list["MockRuleResponse"] = []
    sequences: list["MockSequenceResponse"] = []


# Rules
class MatchCondition(BaseModel):
    field: str
    operator: str
    value: str | None = None


class MockRuleCreate(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: int = 0
    is_active: bool = True
    match_conditions: list[MatchCondition]
    response_status: int = 200
    response_headers: dict | None = None
    response_body: str | None = None
    response_delay_ms: int = 0


class MockRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: int | None = None
    is_active: bool | None = None
    match_conditions: list[MatchCondition] | None = None
    response_status: int | None = None
    response_headers: dict | None = None
    response_body: str | None = None
    response_delay_ms: int | None = None


class MockRuleResponse(BaseModel):
    id: uuid.UUID
    mock_endpoint_id: uuid.UUID
    name: str | None
    description: str | None = None
    priority: int
    is_active: bool
    match_conditions: list[dict]
    response_status: int
    response_headers: dict | None
    response_body: str | None
    response_delay_ms: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MockRuleListResponse(BaseModel):
    data: list[MockRuleResponse]


# Sequences
class SequenceStepCreate(BaseModel):
    step_order: int
    response_status: int = 200
    response_headers: dict | None = None
    response_body: str | None = None
    response_delay_ms: int = 0


class MockSequenceCreate(BaseModel):
    name: str | None = None
    is_active: bool = True
    loop: bool = False
    steps: list[SequenceStepCreate] = []


class MockSequenceUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    loop: bool | None = None
    steps: list[SequenceStepCreate] | None = None


class SequenceStepResponse(BaseModel):
    id: uuid.UUID
    step_order: int
    response_status: int
    response_headers: dict | None
    response_body: str | None
    response_delay_ms: int

    model_config = {"from_attributes": True}


class MockSequenceResponse(BaseModel):
    id: uuid.UUID
    mock_endpoint_id: uuid.UUID
    name: str | None
    is_active: bool
    loop: bool
    current_step: int
    steps: list[SequenceStepResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class MockSequenceListResponse(BaseModel):
    data: list[MockSequenceResponse]


# Logs
class MockLogResponse(BaseModel):
    id: uuid.UUID
    mock_endpoint_id: uuid.UUID
    method: str
    path: str
    query_params: dict
    headers: dict
    body: str | None = None
    matched_rule_id: uuid.UUID | None
    matched_sequence_id: uuid.UUID | None
    response_status: int | None
    response_delay_ms: int | None
    contract_valid: bool | None
    received_at: datetime

    model_config = {"from_attributes": True}


class MockLogListResponse(BaseModel):
    data: list[MockLogResponse]
    total: int
