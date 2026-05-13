import uuid

from sqlalchemy import String, Text, Integer, Float, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class MockEndpoint(BaseModel):
    __tablename__ = "mock_endpoints"
    __table_args__ = (
        UniqueConstraint("workspace_id", "path", "method"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    response_status: Mapped[int] = mapped_column(Integer, default=200)
    response_headers: Mapped[dict] = mapped_column(JSONB, default=lambda: {"Content-Type": "application/json"})
    response_body: Mapped[str | None] = mapped_column(Text)
    response_delay_ms: Mapped[int] = mapped_column(Integer, default=0)
    error_rate: Mapped[float] = mapped_column(Float, default=0.0)
    error_status: Mapped[int] = mapped_column(Integer, default=500)
    error_body: Mapped[str | None] = mapped_column(Text, default='{"error": "Internal server error"}')
    request_count: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    workspace = relationship("Workspace", back_populates="mock_endpoints")
    rules = relationship("MockResponseRule", back_populates="mock_endpoint", cascade="all, delete-orphan")
    sequences = relationship("MockSequence", back_populates="mock_endpoint", cascade="all, delete-orphan")
    request_logs = relationship("MockRequestLog", back_populates="mock_endpoint", cascade="all, delete-orphan")
