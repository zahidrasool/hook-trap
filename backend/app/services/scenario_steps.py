"""Execution of a single scenario step.

Each executor returns a result dict in the shape `record_step_result` stores,
so the worker never has to know what a step type does. Errors are returned as
results rather than raised: one bad step should fail its step and let the run
report on the rest, not abort the run with a traceback.

The distinction the whole feature rests on is preserved here — an assertion
that fails is `failed`, while the engine being unable to run the step at all is
`error`. CI needs to tell "your app returned the wrong status" from "we could
not reach your app".
"""

import asyncio
import json
import time
from datetime import datetime, timezone

from app.services.assertions import evaluate_all
from app.services.http_client import safe_request
from app.services.scenario_variables import (
    InterpolationTooDeep,
    UnresolvedVariable,
    capture_values,
    interpolate,
)
from app.services.ssrf_guard import BlockedAddress

SUPPORTED_STEP_TYPES = frozenset({"delay", "http_request"})

MAX_DELAY_SECONDS = 300


def _now():
    return datetime.now(timezone.utc)


def _error(step_type: str, started, message: str) -> dict:
    return {
        "status": "error",
        "started_at": started,
        "finished_at": _now(),
        "assertions": [],
        "captured": {},
        "error": message,
    }


async def execute_step(step: dict, namespace: dict, *, client=None) -> dict:
    """Run one step against the current variable namespace."""
    started = _now()
    step_type = (step or {}).get("type")

    if step_type not in SUPPORTED_STEP_TYPES:
        return _error(step_type, started, f"Unsupported step type: {step_type!r}")

    try:
        resolved = interpolate(step, namespace)
    except (UnresolvedVariable, InterpolationTooDeep) as exc:
        return _error(step_type, started, str(exc))

    if step_type == "delay":
        return await _delay(resolved, started)
    return await _http_request(resolved, started, client)


async def _delay(step: dict, started) -> dict:
    seconds = step.get("seconds", 0)
    try:
        seconds = float(seconds)
    except (TypeError, ValueError):
        return _error("delay", started, f"delay.seconds is not a number: {seconds!r}")

    # Refused rather than silently clamped. A scenario asking to wait ten
    # minutes has a problem the author needs told about, and quietly waiting a
    # different length than the definition says makes the run report a lie.
    if seconds > MAX_DELAY_SECONDS:
        return _error(
            "delay",
            started,
            f"delay.seconds is {seconds}, above the {MAX_DELAY_SECONDS}s maximum",
        )

    await asyncio.sleep(max(0.0, seconds))
    return {
        "status": "passed",
        "started_at": started,
        "finished_at": _now(),
        "assertions": [],
        "captured": {},
        "error": None,
    }


def _parse_body(text: str):
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return text


async def _http_request(step: dict, started, client) -> dict:
    url = step.get("url")
    if not url:
        return _error("http_request", started, "http_request has no url")

    method = (step.get("method") or "GET").upper()
    headers = step.get("headers") or {}
    body = step.get("body")
    content = json.dumps(body) if isinstance(body, (dict, list)) else body
    timeout = float(step.get("timeout_seconds") or 30)

    request_record = {"method": method, "url": url, "headers": headers, "body": body}

    try:
        response = await safe_request(
            method, url, headers=headers, content=content, timeout=timeout, client=client
        )
    except BlockedAddress as exc:
        return {**_error("http_request", started, str(exc)), "request": request_record}
    except Exception as exc:
        message = str(exc) or exc.__class__.__name__
        return {**_error("http_request", started, message), "request": request_record}

    parsed = _parse_body(response.text)
    response_record = {
        "status_code": response.status_code,
        "headers": response.headers,
        "body": parsed,
        "time_ms": response.elapsed_ms,
        "truncated": response.truncated,
    }

    context = {
        "status": response.status_code,
        "response": {
            "body": parsed,
            "headers": response.headers,
            "time_ms": response.elapsed_ms,
        },
        "body": parsed,
    }

    assertions = evaluate_all(step.get("assert") or [], context)

    try:
        captured = capture_values(step.get("capture") or {}, context)
    except UnresolvedVariable as exc:
        return {
            **_error("http_request", started, str(exc)),
            "request": request_record,
            "response": response_record,
            "assertions": assertions,
        }

    return {
        "status": "passed" if all(a["passed"] for a in assertions) else "failed",
        "started_at": started,
        "finished_at": _now(),
        "request": request_record,
        "response": response_record,
        "assertions": assertions,
        "captured": captured,
        "error": None,
    }
