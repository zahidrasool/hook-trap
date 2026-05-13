import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, func, UniqueConstraint, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class MockSequence(Base):
    __tablename__ = "mock_sequences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    mock_endpoint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mock_endpoints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    loop: Mapped[bool] = mapped_column(Boolean, default=False)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    mock_endpoint = relationship("MockEndpoint", back_populates="sequences")
    steps = relationship("MockSequenceStep", back_populates="sequence", cascade="all, delete-orphan")


class MockSequenceStep(Base):
    __tablename__ = "mock_sequence_steps"
    __table_args__ = (
        UniqueConstraint("sequence_id", "step_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sequence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mock_sequences.id", ondelete="CASCADE"), nullable=False, index=True
    )
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    response_status: Mapped[int] = mapped_column(Integer, default=200)
    response_headers: Mapped[dict] = mapped_column(JSONB, default=dict)
    response_body: Mapped[str | None] = mapped_column(Text)
    response_delay_ms: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    sequence = relationship("MockSequence", back_populates="steps")
