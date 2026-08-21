import uuid
from datetime import datetime

from sqlalchemy import String, Text, Boolean, ForeignKey, DateTime, func, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel, Base


class Workspace(BaseModel):
    __tablename__ = "workspaces"

    short_id: Mapped[str] = mapped_column(String(12), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    api_key: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)

    # SMTP Inbox credentials
    smtp_username: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    smtp_password: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Relationships
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    mock_endpoints = relationship("MockEndpoint", back_populates="workspace", cascade="all, delete-orphan")
    inbox_emails = relationship("InboxEmail", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id"),
        CheckConstraint("role IN ('owner', 'admin', 'editor', 'viewer')"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), default="member")
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="members")
