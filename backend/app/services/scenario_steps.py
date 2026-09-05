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


def _error(started, message: str) -> dict:
    return {
        "status": "error",
        "started_at": started,
        "finished_at": _now(),
        "assertions": [],
        "captured": {},
        "error": message,
    }


async def execute_step(
    step: dict, namespace: dict, *, client=None, budget_seconds: float | None = None
) -> dict:
    """Run one step against the current variable namespace.

    `budget_seconds`, when given, is the remaining wall-clock allowance for
    the whole run — the caller (the worker's per-step loop) derives it from
    the scenario's declared `timeout_seconds`. Passing None (the default)
    keeps every existing caller, including the tests that call this directly
    with no budget, working exactly as before: no clamping is applied.
    """
    started = _now()

    if not isinstance(step, dict):
        return _error(started, f"Step must be an object, got {type(step).__name__}")

    step_type = step.get("type")

    if step_type not in SUPPORTED_STEP_TYPES:
        return _error(started, f"Unsupported step type: {step_type!r}")

    try:
        resolved = interpolate(step, namespace)
    except (UnresolvedVariable, InterpolationTooDeep) as exc:
        return _error(started, str(exc))

    try:
        if step_type == "delay":
            return await _delay(resolved, started, budget_seconds=budget_seconds)
        return await _http_request(resolved, started, client, budget_seconds=budget_seconds)
    except Exception as exc:
        # A malformed step definition must fail its step, never abort the run
        # with a traceback. The specific shapes are validated in the
        # executors below so the message is diagnosable; this is the net that
        # catches whatever they miss.
        return _error(started, str(exc) or exc.__class__.__name__)


async def _delay(step: dict, started, *, budget_seconds: float | None = None) -> dict:
    seconds = step.get("seconds", 0)
    try:
        seconds = float(seconds)
    except (TypeError, ValueError):
        return _error(started, f"delay.seconds is not a number: {seconds!r}")

    # Refused rather than silently clamped. A scenario asking to wait ten
    # minutes has a problem the author needs told about, and quietly waiting a
    # different length than the definition says makes the run report a lie.
    # The same reasoning applies below zero: clamping a negative to 0 would
    # run the step for a different duration than the definition asked for.
    if seconds < 0:
        return _error(started, f"delay.seconds is {seconds}, must not be negative")

    if seconds > MAX_DELAY_SECONDS:
        return _error(
            started,
            f"delay.seconds is {seconds}, above the {MAX_DELAY_SECONDS}s maximum",
        )

    # Only the sleep itself is clamped, never the reported/validated value —
    # the run budget is the engine's problem, not a different delay.seconds
    # the scenario author never asked for.
    sleep_for = seconds
    if budget_seconds is not None:
        sleep_for = max(0.0, min(sleep_for, budget_seconds))

    await asyncio.sleep(sleep_for)
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


async def _http_request(
    step: dict, started, client, *, budget_seconds: float | None = None
) -> dict:
    url = step.get("url")
    if not url:
        return _error(started, "http_request has no url")

    method = step.get("method")
    if not method:
        method = "GET"
    elif not isinstance(method, str):
        return _error(
            started,
            f"http_request.method must be a string, got {type(method).__name__}",
        )
    method = method.upper()

    headers = step.get("headers")
    if not headers:
        headers = {}
    elif not isinstance(headers, dict):
        return _error(
            started,
            f"http_request.headers must be an object, got {type(headers).__name__}",
        )

    body = step.get("body")
    content = body
    if isinstance(body, (dict, list)):
        try:
            content = json.dumps(body)
        except TypeError as exc:
            return _error(started, f"http_request.body is not JSON-serialisable: {exc}")

    timeout_raw = step.get("timeout_seconds")
    if not timeout_raw:
        timeout_raw = 30
    try:
        timeout = float(timeout_raw)
    except (TypeError, ValueError):
        return _error(
            started,
            f"http_request.timeout_seconds is not a number: {timeout_raw!r}",
        )

    # A step's own timeout_seconds is a ceiling the step author chose, not a
    # budget the run has to honor if it would blow past the run's own
    # deadline — clamp down to whatever of the run's budget remains, never up.
    if budget_seconds is not None:
        timeout = min(timeout, budget_seconds)

    capture_spec = step.get("capture")
    if not capture_spec:
        capture_spec = {}
    elif not isinstance(capture_spec, dict):
        return _error(
            started,
            f"http_request.capture must be an object, got {type(capture_spec).__name__}",
        )

    assert_spec = step.get("assert")
    if not assert_spec:
        assert_spec = []
    elif not isinstance(assert_spec, list):
        return _error(
            started,
            f"http_request.assert must be a list, got {type(assert_spec).__name__}",
        )

    request_record = {"method": method, "url": url, "headers": headers, "body": body}

    try:
        response = await safe_request(
            method, url, headers=headers, content=content, timeout=timeout, client=client
        )
    except BlockedAddress as exc:
        return {**_error(started, str(exc)), "request": request_record}
    except Exception as exc:
        message = str(exc) or exc.__class__.__name__
        return {**_error(started, message), "request": request_record}

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

    assertions = evaluate_all(assert_spec, context)

    try:
        captured = capture_values(capture_spec, context)
    except UnresolvedVariable as exc:
        return {
            **_error(started, str(exc)),
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
