import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.redis import redis_client
from app.models.endpoint import Endpoint
from app.models.webhook import WebhookCapture
from app.schemas.webhook import WebhookCaptureResponse, CaptureListResponse, CaptureAckResponse
from app.api.deps import get_current_user
from app.models.user import User
from app.services.usage_service import consume_quota
from fastapi.responses import JSONResponse

router = APIRouter()


@router.api_route("/h/{endpoint_short_id}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
async def capture_webhook(
    endpoint_short_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Capture incoming webhook - accepts any HTTP method and body."""
    # Look up endpoint
    result = await db.execute(
        select(Endpoint).where(Endpoint.short_id == endpoint_short_id)
    )
    endpoint = result.scalar_one_or_none()

    if not endpoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    # Monthly quota, charged to the endpoint's owner. Checked before the body is
    # read so an exhausted account cannot keep writing rows; the 429 tells the
    # sender to stop rather than silently dropping their webhook.
    owner = await db.get(User, endpoint.user_id)
    if owner is not None:
        allowed, used, limit = await consume_quota(owner, "webhook_captures", db)
        if not allowed:
            return JSONResponse(
                {
                    "error": "Monthly webhook capture quota exceeded",
                    "used": used,
                    "limit": limit,
                    "upgrade": "https://mocklane.com/pricing",
                },
                status_code=429,
                headers={"X-Quota-Limit": str(limit), "X-Quota-Used": str(used)},
            )

    # Extract request details
    body = None
    try:
        body_bytes = await request.body()
        body = body_bytes.decode("utf-8") if body_bytes else None
    except Exception:
        body = None

    headers = dict(request.headers)
    query_params = dict(request.query_params)
    content_type = request.headers.get("content-type")
    source_ip = request.client.host if request.client else None

    capture = WebhookCapture(
        endpoint_id=endpoint.id,
        http_method=request.method,
        path=str(request.url.path),
        query_params=query_params,
        headers=headers,
        body=body,
        body_size=len(body) if body else 0,
        content_type=content_type,
        source_ip=source_ip,
    )
    db.add(capture)
    await db.flush()

    # Publish to Redis for real-time updates (fire and forget)
    try:
        await redis_client.publish(
            f"webhook:{endpoint.id}",
            json.dumps({
                "type": "webhook_captured",
                "endpoint_id": str(endpoint.id),
                "capture_id": str(capture.id),
                "method": request.method,
                "path": str(request.url.path),
                "captured_at": capture.captured_at.isoformat(),
            })
        )
    except Exception:
        pass  # Don't fail the capture if Redis is down

    return CaptureAckResponse(
        status="captured",
        timestamp=capture.captured_at,
    )
