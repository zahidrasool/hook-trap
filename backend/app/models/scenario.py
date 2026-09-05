import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Scenario(BaseModel):
    """A named, ordered workflow across mocks, captures and inboxes.

    `steps` is a JSONB document rather than a child table because steps are
    always read and written whole, never queried individually, and keeping them
    inline makes edit-and-save atomic.
    """

    __tablename__ = "scenarios"
    __table_args__ = (UniqueConstraint("workspace_id", "slug"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    short_id: Mapped[str] = mapped_column(String(12), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    variables: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    workspace = relationship("Workspace", back_populates="scenarios")
    # cascade="all, delete-orphan" is the load-bearing part. Both scenario_id
    # columns are nullable, so a relationship WITHOUT it de-associates children
    # on delete — SQLAlchemy UPDATEs scenario_id to NULL rather than deleting —
    # which would silently turn a deleted scenario's mocks into workspace mocks
    # and leak them onto /m/. Do not drop it.
    #
    # passive_deletes=True is an optimisation on top: it stops SQLAlchemy
    # loading every child just to DELETE it one row at a time, and defers to
    # the ON DELETE CASCADE already declared on both foreign keys.
    runs = relationship(
        "ScenarioRun",
        back_populates="scenario",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    mock_endpoints = relationship(
        "MockEndpoint",
        back_populates="scenario",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    capture_endpoints = relationship(
        "Endpoint",
        back_populates="scenario",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ScenarioRun(BaseModel):
    __tablename__ = "scenario_runs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'running', 'passed', 'failed', 'error', 'timeout', 'cancelled')",
            name="ck_scenario_runs_status",
        ),
        CheckConstraint(
            "trigger IN ('manual', 'api', 'ci')",
            name="ck_scenario_runs_trigger",
        ),
    )

    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Denormalised: run listing and quota counting are the two hottest queries
    # and both would otherwise join through scenarios.
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    trigger: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    variables: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Engine or network fault, deliberately distinct from an assertion failing.
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    scenario = relationship("Scenario", back_populates="runs")
    step_results = relationship(
        "ScenarioStepResult",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="ScenarioStepResult.step_index",
    )


class ScenarioStepResult(BaseModel):
    """Per-step outcome, including what we sent and what came back.

    Storing request and response is what makes a failed run debuggable; a red X
    with no payload is useless.
    """

    __tablename__ = "scenario_step_results"
    __table_args__ = (
        CheckConstraint(
            "status IN ('passed', 'failed', 'skipped', 'error', 'timeout')",
            name="ck_scenario_step_results_status",
        ),
    )

    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenario_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    request: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # The capture or email row that satisfied a wait step.
    matched_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    assertions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    captured: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    run = relationship("ScenarioRun", back_populates="step_results")
