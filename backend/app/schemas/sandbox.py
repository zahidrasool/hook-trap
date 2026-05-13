import uuid
import re
from datetime import datetime

from pydantic import BaseModel, field_validator

RESERVED_PREFIXES = {
    "admin", "postmaster", "abuse", "noreply", "support",
    "test", "info", "help", "billing", "sales",
}

PREFIX_PATTERN = re.compile(r"^[a-z][a-z0-9-]*[a-z0-9]$")


class SandboxCreate(BaseModel):
    name: str
    email_prefix: str
    description: str | None = None
    tags: list[str] = []
    email_retention_days: int | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("Name must be 1-100 characters")
        return v

    @field_validator("email_prefix")
    @classmethod
    def validate_prefix(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Prefix must be 3-50 characters")
        if not PREFIX_PATTERN.match(v):
            raise ValueError("Prefix must start with a letter, contain only lowercase letters, numbers, and hyphens, and not end with a hyphen")
        if "--" in v:
            raise ValueError("Prefix cannot contain consecutive hyphens")
        if v in RESERVED_PREFIXES:
            raise ValueError(f"Prefix '{v}' is reserved")
        return v

    @field_validator("email_retention_days")
    @classmethod
    def validate_retention(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("Retention must be at least 1 day")
        return v


class SandboxUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    is_active: bool | None = None
    email_retention_days: int | None = None


class SandboxResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    email_prefix: str
    email_address: str
    description: str | None
    tags: list[str]
    is_active: bool
    email_retention_days: int | None
    created_at: datetime
    updated_at: datetime
    email_count: int = 0
    unread_count: int = 0
    model_config = {"from_attributes": True}


class SandboxListResponse(BaseModel):
    data: list[SandboxResponse]
    total: int


class SandboxCredentialsResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    email_address: str
    connection_url: str


class SandboxEmailSummary(BaseModel):
    id: uuid.UUID
    from_address: str
    to_addresses: list[str]
    subject: str | None
    is_read: bool
    received_at: datetime
    raw_size: int
    has_attachments: bool
    model_config = {"from_attributes": True}


class SandboxEmailResponse(BaseModel):
    id: uuid.UUID
    sandbox_id: uuid.UUID
    message_id: str | None
    from_address: str
    to_addresses: list[str]
    cc_addresses: list[str]
    bcc_addresses: list[str]
    subject: str | None
    text_body: str | None
    html_body: str | None
    headers: dict
    attachments: list
    raw_size: int
    is_read: bool
    received_at: datetime
    model_config = {"from_attributes": True}


class SandboxEmailListResponse(BaseModel):
    data: list[SandboxEmailSummary]
    total: int
    unread_count: int


class PrefixCheckResponse(BaseModel):
    available: bool
    suggestion: str | None = None
