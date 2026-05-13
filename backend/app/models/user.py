import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    endpoints = relationship("Endpoint", back_populates="user", cascade="all, delete-orphan")
    replay_sessions = relationship("ReplaySession", back_populates="user", cascade="all, delete-orphan")
