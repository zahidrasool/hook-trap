import json
import time

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhook import WebhookCapture
from app.models.session import ReplaySession, ReplayRequest
from app.services.http_client import safe_request
from app.services.ssrf_guard import BlockedAddress


async def replay_capture(
    capture: WebhookCapture,
    target_url: str,
    modifications: dict | None,
    session_id,
    db: AsyncSession,
) -> ReplayRequest:
    """Replay a captured webhook to the target URL with optional modifications."""
    # Build request from capture
    headers = dict(capture.headers)
    body = capture.body

    # Apply modifications
    if modifications:
        if "headers" in modifications:
            headers.update(modifications["headers"])
        if "body_overrides" in modifications and body:
            try:
                body_dict = json.loads(body)
                body_dict.update(modifications["body_overrides"])
                body = json.dumps(body_dict)
            except (json.JSONDecodeError, TypeError):
                pass

    # Remove hop-by-hop headers
    for h in ["host", "content-length", "transfer-encoding"]:
        headers.pop(h, None)

    # Send request
    start_time = time.time()
    response_status = None
    response_body = None
    response_time_ms = None
    error_message = None

    try:
        response = await safe_request(
            method=capture.http_method,
            url=target_url,
            headers=headers,
            content=body,
            timeout=30.0,
        )
        response_status = response.status_code
        response_body = response.text
        response_time_ms = response.elapsed_ms
    except BlockedAddress as exc:
        # A refused target is a user error, not a crash: record it on the row
        # so the dashboard can show why the replay did not go out.
        error_message = f"Refused to replay to this target: {exc}"
        response_time_ms = 0
    except Exception as exc:
        error_message = str(exc)
        response_time_ms = int((time.time() - start_time) * 1000)

    # Create replay request record
    replay_request = ReplayRequest(
        session_id=session_id,
        capture_id=capture.id,
        target_url=target_url,
        modifications=modifications,
        response_status=response_status,
        response_body=response_body,
        response_time_ms=response_time_ms,
        error_message=error_message,
    )
    db.add(replay_request)
    await db.flush()
    await db.refresh(replay_request)

    return replay_request
