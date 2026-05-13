import uuid

from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Endpoint(BaseModel):
    __tablename__ = "endpoints"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    short_id: Mapped[str] = mapped_column(String(12), unique=True, nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)

    # Relationships
    user = relationship("User", back_populates="endpoints")
    captures = relationship("WebhookCapture", back_populates="endpoint", cascade="all, delete-orphan")
