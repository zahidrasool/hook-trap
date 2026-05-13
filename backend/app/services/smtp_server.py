"""
Fake SMTP server that captures all incoming emails into workspace inboxes.

Uses aiosmtpd to accept SMTP connections. Each workspace gets unique
SMTP credentials (username/password). Emails are parsed and stored in
PostgreSQL, never forwarded to real recipients.
"""
import base64
import email
import email.policy
import logging
import threading
from email.message import EmailMessage

from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult, LoginPassword, SMTP

from app.config import get_settings
from app.models.inbox_email import InboxEmail
from app.models.sandbox import Sandbox
from app.models.sandbox_email import SandboxEmail
from app.models.workspace import Workspace
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session as SyncSession

logger = logging.getLogger(__name__)

_controller: Controller | None = None


def _get_sync_engine():
    """Create a sync SQLAlchemy engine for use in the SMTP server thread."""
    settings = get_settings()
    # Convert async URL to sync: postgresql+asyncpg -> postgresql+psycopg2 (or just postgresql)
    url = settings.database_url.replace("+asyncpg", "")
    return create_engine(url)


_sync_engine = None


def _get_sync_session() -> SyncSession:
    global _sync_engine
    if _sync_engine is None:
        _sync_engine = _get_sync_engine()
    return SyncSession(_sync_engine)


class HookTrapAuthenticator:
    """Authenticates SMTP connections using workspace or sandbox smtp_username/smtp_password.

    Uses synchronous DB access since the Controller runs in its own thread.
    """

    def __call__(self, server, session, envelope, mechanism, auth_data):
        if not isinstance(auth_data, LoginPassword):
            return AuthResult(success=False, handled=False)

        username = auth_data.login.decode() if isinstance(auth_data.login, bytes) else auth_data.login
        password = auth_data.password.decode() if isinstance(auth_data.password, bytes) else auth_data.password

        try:
            with _get_sync_session() as db:
                # Try workspace lookup first
                workspace = db.execute(
                    select(Workspace).where(Workspace.smtp_username == username)
                ).scalar_one_or_none()

                if workspace and workspace.smtp_password == password:
                    workspace_id = str(workspace.id)
                    session.workspace_id = workspace_id
                    # Also store on server instance as fallback
                    if not hasattr(server, "_auth_map"):
                        server._auth_map = {}
                    peer = session.peer
                    if peer:
                        server._auth_map[f"{peer[0]}:{peer[1]}"] = {"workspace_id": workspace_id}
                    logger.info("SMTP auth successful for workspace: %s (user: %s)", workspace_id, username)
                    return AuthResult(success=True)

                # Fallback: try sandbox lookup
                sandbox = db.execute(
                    select(Sandbox).where(Sandbox.smtp_username == username)
                ).scalar_one_or_none()

                if sandbox and sandbox.smtp_password == password and sandbox.is_active:
                    sandbox_id = str(sandbox.id)
                    session.sandbox_id = sandbox_id
                    # Also store on server instance as fallback
                    if not hasattr(server, "_auth_map"):
                        server._auth_map = {}
                    peer = session.peer
                    if peer:
                        server._auth_map[f"{peer[0]}:{peer[1]}"] = {"sandbox_id": sandbox_id}
                    logger.info("SMTP auth successful for sandbox: %s (user: %s)", sandbox_id, username)
                    return AuthResult(success=True)

        except Exception as e:
            logger.exception("SMTP auth DB error: %s", e)

        logger.warning("SMTP auth failed for user: %s", username)
        return AuthResult(success=False, handled=False)


def _parse_email_content(envelope):
    """Parse raw email data into structured fields. Returns a dict."""
    raw_data = envelope.content
    if isinstance(raw_data, bytes):
        raw_str = raw_data.decode("utf-8", errors="replace")
    else:
        raw_str = raw_data

    msg = email.message_from_string(raw_str, policy=email.policy.default)

    # Extract fields
    from_addr = str(msg.get("From", envelope.mail_from or ""))
    to_addrs = [str(a).strip() for a in (msg.get("To", "") or "").split(",") if a.strip()]
    if not to_addrs:
        to_addrs = list(envelope.rcpt_tos)
    cc_addrs = [str(a).strip() for a in (msg.get("Cc", "") or "").split(",") if a.strip()]
    bcc_addrs = [str(a).strip() for a in (msg.get("Bcc", "") or "").split(",") if a.strip()]
    subject = str(msg.get("Subject", ""))
    message_id = str(msg.get("Message-ID", ""))

    # Extract body
    text_body = None
    html_body = None
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            if ct == "text/plain" and text_body is None:
                text_body = part.get_content()
            elif ct == "text/html" and html_body is None:
                html_body = part.get_content()
    else:
        ct = msg.get_content_type()
        content = msg.get_content()
        if ct == "text/html":
            html_body = content
        else:
            text_body = content

    # Extract headers
    headers = {k: str(v) for k, v in msg.items()}

    # Extract attachments
    attachments = []
    if msg.is_multipart():
        for part in msg.iter_attachments():
            filename = part.get_filename() or "untitled"
            content_type = part.get_content_type()
            payload = part.get_payload(decode=True) or b""
            if len(payload) > 10 * 1024 * 1024:
                payload = payload[: 10 * 1024 * 1024]
            attachments.append({
                "filename": filename,
                "content_type": content_type,
                "size": len(payload),
                "content_base64": base64.b64encode(payload).decode("ascii"),
            })

    return {
        "message_id": message_id or None,
        "from_address": from_addr,
        "to_addresses": to_addrs,
        "cc_addresses": cc_addrs,
        "bcc_addresses": bcc_addrs,
        "subject": subject or None,
        "text_body": text_body,
        "html_body": html_body,
        "headers": headers,
        "attachments": attachments,
        "raw_size": len(raw_str),
    }


class HookTrapSMTPHandler:
    """Handles incoming SMTP messages — parses and stores them in the database."""

    async def handle_RCPT(self, server, session, envelope, address, rcpt_options):
        envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server, session, envelope):
        # Try session attributes first, then fallback to server's auth map
        workspace_id = getattr(session, "workspace_id", None)
        sandbox_id = getattr(session, "sandbox_id", None)

        if not workspace_id and not sandbox_id:
            auth_map = getattr(server, "_auth_map", {})
            peer = getattr(session, "peer", None)
            if peer:
                auth_entry = auth_map.pop(f"{peer[0]}:{peer[1]}", None)
                if auth_entry:
                    workspace_id = auth_entry.get("workspace_id")
                    sandbox_id = auth_entry.get("sandbox_id")

        if not workspace_id and not sandbox_id:
            return "550 Authentication required"

        try:
            parsed = _parse_email_content(envelope)

            # Store in database (sync, runs in Controller's thread)
            with _get_sync_session() as db:
                if workspace_id:
                    record = InboxEmail(workspace_id=workspace_id, **parsed)
                    logger.info(
                        "Captured email for workspace %s: %s -> %s (%s)",
                        workspace_id,
                        parsed["from_address"],
                        parsed["to_addresses"],
                        parsed["subject"],
                    )
                elif sandbox_id:
                    record = SandboxEmail(sandbox_id=sandbox_id, **parsed)
                    logger.info(
                        "Captured email for sandbox %s: %s -> %s (%s)",
                        sandbox_id,
                        parsed["from_address"],
                        parsed["to_addresses"],
                        parsed["subject"],
                    )
                db.add(record)
                db.commit()

            return "250 Message accepted for delivery"

        except Exception as e:
            logger.exception("Failed to process incoming email: %s", e)
            return "451 Temporary error processing message"


async def start_smtp_server():
    """Start the fake SMTP server."""
    global _controller

    settings = get_settings()
    handler = HookTrapSMTPHandler()
    authenticator = HookTrapAuthenticator()

    _controller = Controller(
        handler,
        hostname=settings.smtp_server_host,
        port=settings.smtp_server_port,
        authenticator=authenticator,
        auth_required=False,  # We validate in handle_DATA via workspace_id/sandbox_id
        auth_require_tls=False,
    )
    _controller.start()
    logger.info(
        "SMTP server started on %s:%s",
        settings.smtp_server_host,
        settings.smtp_server_port,
    )


async def stop_smtp_server():
    """Stop the fake SMTP server."""
    global _controller
    if _controller:
        _controller.stop()
        _controller = None
        logger.info("SMTP server stopped")
