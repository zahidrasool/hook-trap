import json
import random
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Request, Depends
from fastapi.responses import Response, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.redis import redis_client
from app.services.mock_service import (
    get_active_mocks_for_workspace,
    match_mock_endpoint,
    get_active_rules_for_mock,
    all_conditions_match,
    get_active_sequence,
    get_sequence_steps,
    increment_request_count,
    log_mock_request,
)
from app.services.template_engine import process_template, process_template_dict
from app.models.workspace import Workspace
from sqlalchemy import select

router = APIRouter()


async def parse_body(request: Request) -> dict | str | None:
    try:
        return await request.json()
    except Exception:
        try:
            body = await request.body()
            return body.decode("utf-8") if body else None
        except Exception:
            return None


# Mocks are called from other origins by design (a customer's frontend hitting
# a stand-in backend), so every response here carries permissive CORS headers,
# errors included. Without them a browser reports an opaque CORS failure rather
# than the actual 404/401, which is unhelpful when debugging a mock.
MOCK_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
}


@router.api_route(
    "/m/{workspace_short_id}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
)
async def serve_mock(
    workspace_short_id: str,
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Step 0: CORS preflight.
    #
    # Answered before any lookup. A browser sends OPTIONS ahead of any request
    # that is not "simple" — POST with application/json, PUT, DELETE, PATCH, or
    # anything carrying a custom header. Falling through to endpoint matching
    # meant the preflight 404'd or 400'd with no CORS headers, so the browser
    # blocked the real request. Mocks exist to be called from other origins, so
    # this always succeeds, even for a path that has no mock defined.
    if request.method == "OPTIONS":
        requested_headers = request.headers.get(
            "Access-Control-Request-Headers", "Content-Type, Authorization, X-Requested-With"
        )
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
                "Access-Control-Allow-Headers": requested_headers,
                "Access-Control-Max-Age": "86400",
            },
        )

    # Step 1: Lookup workspace
    result = await db.execute(
        select(Workspace).where(Workspace.short_id == workspace_short_id)
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        return JSONResponse(
            {"error": "Workspace not found"},
            status_code=404,
            headers=MOCK_CORS_HEADERS,
        )

    # Check workspace privacy
    if not workspace.is_public:
        api_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
        if api_key != workspace.api_key:
            return JSONResponse(
                {"error": "Unauthorized. API key required for this workspace."},
                status_code=401,
                headers={"WWW-Authenticate": "ApiKey", **MOCK_CORS_HEADERS},
            )

    # Step 2: Normalize path
    if not path.startswith("/"):
        path = "/" + path

    # Step 3: Find matching mock
    mocks = await get_active_mocks_for_workspace(workspace.id, db)
    mock_endpoint, path_params = match_mock_endpoint(path, request.method, mocks)

    if not mock_endpoint:
        return JSONResponse(
            {"error": f"No mock endpoint defined for {request.method} {path}"},
            status_code=404,
            headers=MOCK_CORS_HEADERS,
        )

    # Check immutable mode
    if mock_endpoint.is_immutable and request.method.upper() in ("POST", "PUT", "PATCH", "DELETE"):
        return JSONResponse(
            {"error": "Method not allowed. This endpoint is read-only (immutable mode)."},
            status_code=405,
            headers={"Allow": "GET, HEAD, OPTIONS", **MOCK_CORS_HEADERS},
        )

    # Check for static data
    if mock_endpoint.static_data is not None:
        data = mock_endpoint.static_data
        # Check if requesting a specific item by ID (last path segment is numeric or UUID)
        path_segments = path.strip("/").split("/")
        last_segment = path_segments[-1] if path_segments else ""

        # Try to match by ID
        if last_segment and last_segment != mock_endpoint.path.strip("/").split("/")[-1]:
            # Looks like /collection/123 pattern
            found = None
            for item in data:
                if isinstance(item, dict):
                    item_id = str(item.get("id", ""))
                    if item_id == last_segment:
                        found = item
                        break
            if found:
                return JSONResponse(
                    found,
                    status_code=200,
                    headers={**dict(mock_endpoint.response_headers or {}), **MOCK_CORS_HEADERS},
                )
            else:
                return JSONResponse(
                    {"error": "Not found"}, status_code=404, headers=MOCK_CORS_HEADERS
                )

        # Apply query param filtering
        filtered = data
        for param_key, param_value in request.query_params.items():
            if param_key == "api_key":
                continue
            filtered = [
                item for item in filtered
                if isinstance(item, dict) and str(item.get(param_key, "")) == param_value
            ]

        return JSONResponse(
            filtered,
            status_code=200,
            headers={**dict(mock_endpoint.response_headers or {}), **MOCK_CORS_HEADERS},
        )

    # Step 4: Error simulation
    if mock_endpoint.error_rate and mock_endpoint.error_rate > 0:
        if random.random() < mock_endpoint.error_rate:
            error_body = mock_endpoint.error_body or '{"error": "Internal server error"}'
            try:
                error_json = json.loads(error_body)
            except json.JSONDecodeError:
                error_json = {"error": error_body}
            return JSONResponse(
                error_json,
                status_code=mock_endpoint.error_status or 500,
                headers=MOCK_CORS_HEADERS,
            )

    # Build request context
    body_raw = None
    body_parsed = None
    try:
        body_bytes = await request.body()
        body_raw = body_bytes.decode("utf-8") if body_bytes else None
        if body_raw:
            try:
                body_parsed = json.loads(body_raw)
            except json.JSONDecodeError:
                body_parsed = body_raw
    except Exception:
        pass

    request_context = {
        "method": request.method,
        "path": path,
        "query": dict(request.query_params),
        "headers": dict(request.headers),
        "body": body_parsed if body_parsed else {},
        "params": path_params,
    }

    response_status = mock_endpoint.response_status
    response_headers = mock_endpoint.response_headers or {}
    response_body = mock_endpoint.response_body
    response_delay = mock_endpoint.response_delay_ms or 0
    matched_rule_id = None
    matched_sequence_id = None
    use_sequence = False

    # Step 5: Check sequence
    sequence = await get_active_sequence(mock_endpoint.id, db)
    if sequence:
        steps = await get_sequence_steps(sequence.id, db)
        if steps:
            seq_key = f"seq:{mock_endpoint.id}:{workspace.id}"
            current_step_str = await redis_client.get(seq_key)
            current_step = int(current_step_str) if current_step_str else 0

            if current_step < len(steps):
                step = steps[current_step]
            else:
                step = steps[-1]

            response_status = step.response_status
            response_headers = step.response_headers or {}
            response_body = step.response_body
            response_delay = step.response_delay_ms or 0
            matched_sequence_id = sequence.id
            use_sequence = True

            next_step = current_step + 1
            if next_step >= len(steps):
                next_step = 0 if sequence.loop else len(steps) - 1
            await redis_client.setex(seq_key, 3600, str(next_step))

    # Step 6: Evaluate rules (if not sequence)
    if not use_sequence:
        rules = await get_active_rules_for_mock(mock_endpoint.id, db)
        for rule in rules:
            if all_conditions_match(rule.match_conditions, request_context):
                response_status = rule.response_status
                response_headers = rule.response_headers or {}
                response_body = rule.response_body
                response_delay = rule.response_delay_ms or 0
                matched_rule_id = rule.id
                break

    # Step 7: Process templates
    template_context = {
        "request": request_context,
        "now": datetime.now(timezone.utc).isoformat(),
        "timestamp": int(datetime.now(timezone.utc).timestamp()),
    }
    processed_body = process_template(response_body, template_context)
    processed_headers = process_template_dict(response_headers, template_context)

    # Step 8: Delay
    if response_delay > 0:
        await asyncio.sleep(response_delay / 1000)

    # Step 9: Log (non-blocking)
    source_ip = request.client.host if request.client else None
    try:
        await log_mock_request(
            mock_endpoint_id=mock_endpoint.id,
            workspace_id=workspace.id,
            method=request.method,
            path=path,
            query_params=dict(request.query_params),
            headers=dict(request.headers),
            body=body_raw,
            content_type=request.headers.get("content-type"),
            source_ip=source_ip,
            response_status=response_status,
            response_delay_ms=response_delay,
            matched_rule_id=matched_rule_id,
            matched_sequence_id=matched_sequence_id,
            db=db,
        )
        await increment_request_count(mock_endpoint.id, db)
    except Exception:
        pass

    # Publish to Redis
    try:
        await redis_client.publish(f"mock:{workspace.id}", json.dumps({
            "type": "mock_request",
            "workspace_id": str(workspace.id),
            "mock_endpoint_id": str(mock_endpoint.id),
            "method": request.method,
            "path": path,
            "response_status": response_status,
        }))
    except Exception:
        pass

    # Step 10: Return
    final_headers = {**processed_headers, **MOCK_CORS_HEADERS}

    return Response(
        content=processed_body,
        status_code=response_status,
        headers=final_headers,
        media_type=processed_headers.get("Content-Type", "application/json"),
    )
