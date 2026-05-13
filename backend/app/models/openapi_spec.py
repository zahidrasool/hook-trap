import uuid
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, DateTime, func, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class OpenAPISpec(BaseModel):
    __tablename__ = "openapi_specs"
    __table_args__ = (
        CheckConstraint("spec_format IN ('yaml', 'json')"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str | None] = mapped_column(String(200))
    version: Mapped[str | None] = mapped_column(String(50))
    spec_content: Mapped[str] = mapped_column(Text, nullable=False)
    spec_format: Mapped[str] = mapped_column(String(10), default="yaml")
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
