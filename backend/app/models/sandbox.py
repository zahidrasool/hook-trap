import uuid
from datetime import datetime

from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Sandbox(BaseModel):
    __tablename__ = "sandboxes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email_prefix: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email_address: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    smtp_username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    smtp_password: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_retention_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sandboxes")
    emails = relationship("SandboxEmail", back_populates="sandbox", cascade="all, delete-orphan")
