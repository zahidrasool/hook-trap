import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: str


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    id: uuid.UUID
    email_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MagicLinkRequest(BaseModel):
    email: str


class MagicLinkResponse(BaseModel):
    status: str = "link_sent"
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(UserBase):
    id: uuid.UUID
    email_verified: bool
    plan: str = "free"
    is_admin: bool = False
    is_blocked: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
