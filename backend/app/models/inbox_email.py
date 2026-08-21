import uuid
from datetime import datetime

from sqlalchemy import String, Text, Boolean, Integer, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class InboxEmail(Base):
    __tablename__ = "inbox_emails"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_id: Mapped[str | None] = mapped_column(String(500), nullable=True)
    from_address: Mapped[str] = mapped_column(String(500), nullable=False)
    to_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    cc_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    bcc_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    subject: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    text_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    html_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    headers: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    attachments: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    raw_size: Mapped[int] = mapped_column(Integer, default=0)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="inbox_emails")
