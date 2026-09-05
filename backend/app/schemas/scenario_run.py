import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RunTrigger(BaseModel):
    variables: dict = Field(default_factory=dict)


class RunAcceptedResponse(BaseModel):
    run_id: uuid.UUID
    status: str


class StepResultResponse(BaseModel):
    step_index: int
    step_type: str
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    request: dict | None
    response: dict | None
    assertions: list
    captured: dict
    error: str | None
    matched_id: uuid.UUID | None


class RunResponse(BaseModel):
    id: uuid.UUID
    scenario_id: uuid.UUID
    status: str
    trigger: str
    variables: dict
    started_at: datetime | None
    finished_at: datetime | None
    duration_ms: int | None
    error: str | None
    created_at: datetime
    step_results: list[StepResultResponse]


class RunSummaryResponse(BaseModel):
    """A run without its step results.

    Deliberately not RunResponse: a history list of fifty runs would otherwise
    carry every step's request and response body, which is the bulk of the
    payload and none of what a list view shows.
    """

    id: uuid.UUID
    scenario_id: uuid.UUID
    status: str
    trigger: str
    started_at: datetime | None
    finished_at: datetime | None
    duration_ms: int | None
    error: str | None
    created_at: datetime
    step_count: int


class RunListResponse(BaseModel):
    runs: list[RunSummaryResponse]
    total: int
