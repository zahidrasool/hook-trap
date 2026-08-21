import uuid
from datetime import datetime

from pydantic import BaseModel


class InboxAttachment(BaseModel):
    filename: str
    content_type: str
    size: int
    content_base64: str | None = None  # Only included in detail view


class InboxEmailSummary(BaseModel):
    id: uuid.UUID
    from_address: str
    to_addresses: list[str]
    subject: str | None
    is_read: bool
    received_at: datetime
    raw_size: int
    has_attachments: bool

    model_config = {"from_attributes": True}


class InboxEmailResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    message_id: str | None
    from_address: str
    to_addresses: list[str]
    cc_addresses: list[str]
    bcc_addresses: list[str]
    subject: str | None
    text_body: str | None
    html_body: str | None
    headers: dict
    attachments: list[InboxAttachment]
    raw_size: int
    is_read: bool
    received_at: datetime

    model_config = {"from_attributes": True}


class InboxEmailSummaryListResponse(BaseModel):
    data: list[InboxEmailSummary]
    total: int
    unread_count: int


class SmtpCredentialsResponse(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    connection_url: str
