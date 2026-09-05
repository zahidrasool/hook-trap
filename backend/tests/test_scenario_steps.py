import ipaddress
import socket
import time
from types import SimpleNamespace

import httpx
import pytest

from app.services.scenario_steps import execute_step


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    """Hostnames resolve to one public address; IP literals resolve to themselves.

    Mirroring the real resolver matters. `getaddrinfo` on an IP literal returns
    that IP unchanged, so a mock that laundered every host into a public
    address would quietly make the blocked-address tests vacuous — the metadata
    address would "resolve" to something public and sail through the guard.
    """

    def _getaddrinfo(host, port, *args, **kwargs):
        bare = host.strip("[]")
        try:
            ipaddress.ip_address(bare)
            resolved = bare
        except ValueError:
            resolved = "93.184.216.34"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (resolved, port or 0))]

    monkeypatch.setattr(socket, "getaddrinfo", _getaddrinfo)


def _client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_delay_waits_and_passes():
    result = await execute_step({"type": "delay", "seconds": 0}, {})

    assert result["status"] == "passed"
    assert result["assertions"] == []


@pytest.mark.asyncio
async def test_unknown_step_type_is_an_error_not_a_crash():
    result = await execute_step({"type": "teleport"}, {})

    assert result["status"] == "error"
    assert "teleport" in result["error"]


@pytest.mark.asyncio
async def test_http_request_records_request_and_response():
    def handler(request):
        assert request.headers["content-type"] == "application/json"
        return httpx.Response(200, json={"paymentId": "pay_1"})

    result = await execute_step(
        {
            "type": "http_request",
            "method": "POST",
            "url": "{{baseUrl}}/payments",
            "headers": {"Content-Type": "application/json"},
            "body": {"amount": 4900},
            "assert": ["status == 200", "response.body.paymentId exists"],
            "capture": {"paymentId": "response.body.paymentId"},
        },
        {"baseUrl": "https://example.com"},
        client=_client(handler),
    )

    assert result["status"] == "passed"
    assert result["request"]["url"] == "https://example.com/payments"
    assert result["response"]["status_code"] == 200
    assert result["captured"] == {"paymentId": "pay_1"}
    assert all(a["passed"] for a in result["assertions"])


@pytest.mark.asyncio
async def test_a_failed_assertion_fails_the_step_and_reports_actual():
    def handler(request):
        return httpx.Response(500, json={})

    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "assert": ["status == 200"],
        },
        {},
        client=_client(handler),
    )

    assert result["status"] == "failed"
    failed = [a for a in result["assertions"] if not a["passed"]]
    assert failed[0]["expected"] == 200
    assert failed[0]["actual"] == 500


@pytest.mark.asyncio
async def test_an_unresolved_variable_is_a_step_error():
    result = await execute_step(
        {"type": "http_request", "method": "GET", "url": "{{missing}}/x"}, {}
    )

    assert result["status"] == "error"
    assert "missing" in result["error"]


@pytest.mark.asyncio
async def test_a_blocked_target_is_a_step_error_not_a_crash():
    def handler(request):  # pragma: no cover - must not run
        raise AssertionError("the guard should have blocked this")

    result = await execute_step(
        {"type": "http_request", "method": "GET", "url": "http://169.254.169.254/latest/"},
        {},
        client=_client(handler),
    )

    assert result["status"] == "error"
    assert "not a public address" in result["error"]


@pytest.mark.asyncio
async def test_capturing_a_missing_path_fails_the_step():
    def handler(request):
        return httpx.Response(200, json={})

    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "capture": {"id": "response.body.nope"},
        },
        {},
        client=_client(handler),
    )

    assert result["status"] == "error"


@pytest.mark.asyncio
async def test_a_non_json_response_body_is_still_recorded():
    def handler(request):
        return httpx.Response(200, text="plain text")

    result = await execute_step(
        {"type": "http_request", "method": "GET", "url": "https://example.com/x"},
        {},
        client=_client(handler),
    )

    assert result["status"] == "passed"
    assert result["response"]["body"] == "plain text"


@pytest.mark.asyncio
async def test_a_truthy_non_dict_step_is_an_error_not_a_crash():
    result = await execute_step("x", {})

    assert result["status"] == "error"
    assert "str" in result["error"]


@pytest.mark.asyncio
async def test_a_non_serialisable_body_is_a_step_error():
    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "body": {"data": {1, 2, 3}},
        },
        {},
    )

    assert result["status"] == "error"
    assert "body" in result["error"]


@pytest.mark.asyncio
async def test_capture_as_a_list_instead_of_a_dict_is_a_step_error():
    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "capture": ["paymentId"],
        },
        {},
    )

    assert result["status"] == "error"
    assert "capture" in result["error"]


@pytest.mark.asyncio
async def test_a_non_numeric_timeout_is_a_step_error():
    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "timeout_seconds": "abc",
        },
        {},
    )

    assert result["status"] == "error"
    assert "timeout_seconds" in result["error"]


@pytest.mark.asyncio
async def test_a_non_string_method_is_a_step_error():
    result = await execute_step(
        {"type": "http_request", "method": 5, "url": "https://example.com/x"}, {}
    )

    assert result["status"] == "error"
    assert "method" in result["error"]


@pytest.mark.asyncio
async def test_assert_as_a_string_instead_of_a_list_is_a_step_error():
    """A string is iterable, so without a guard each character becomes a
    bogus 'could not parse' pseudo-assertion instead of failing cleanly."""

    def handler(request):
        return httpx.Response(200, json={})

    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "assert": "status == 200",
        },
        {},
        client=_client(handler),
    )

    assert result["status"] == "error"
    assert "assert" in result["error"]


@pytest.mark.asyncio
async def test_a_negative_delay_is_a_step_error_not_silently_clamped():
    result = await execute_step({"type": "delay", "seconds": -5}, {})

    assert result["status"] == "error"
    assert "-5" in result["error"]


@pytest.mark.asyncio
async def test_execute_step_with_no_budget_is_unaffected():
    """The default (`budget_seconds=None`) must behave exactly as before —
    every existing caller, including every test above, calls execute_step
    with no budget at all."""
    result = await execute_step({"type": "delay", "seconds": 0}, {})

    assert result["status"] == "passed"


@pytest.mark.asyncio
async def test_a_delay_step_is_clamped_to_the_remaining_run_budget():
    """A single step must not be able to exceed the run's remaining budget —
    otherwise one long delay step could hold the single global worker well
    past the scenario's declared timeout_seconds."""
    started = time.monotonic()

    result = await execute_step({"type": "delay", "seconds": 5}, {}, budget_seconds=0.05)

    elapsed = time.monotonic() - started
    assert result["status"] == "passed"
    assert elapsed < 2, "the sleep should have been clamped to ~0.05s, not the requested 5s"


@pytest.mark.asyncio
async def test_a_negative_delay_still_errors_even_with_a_budget():
    """Clamping must never mask the existing validation: a negative
    delay.seconds is still refused before any clamping is considered."""
    result = await execute_step({"type": "delay", "seconds": -5}, {}, budget_seconds=10)

    assert result["status"] == "error"
    assert "-5" in result["error"]


@pytest.mark.asyncio
async def test_a_steps_own_timeout_is_clamped_to_the_run_budget(monkeypatch):
    """A step's own timeout_seconds is a ceiling the step author chose, not a
    budget the run must honor if it would blow past the run's own deadline —
    the value actually reaching safe_request must be clamped down to
    whatever of the run's budget remains."""
    captured = {}

    async def fake_safe_request(method, url, *, headers, content, timeout, client):
        captured["timeout"] = timeout
        return SimpleNamespace(
            status_code=200, headers={}, text="{}", elapsed_ms=1, truncated=False
        )

    monkeypatch.setattr("app.services.scenario_steps.safe_request", fake_safe_request)

    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "timeout_seconds": 30,
        },
        {},
        budget_seconds=2.0,
    )

    assert result["status"] == "passed"
    assert captured["timeout"] == 2.0


@pytest.mark.asyncio
async def test_a_steps_own_shorter_timeout_is_not_raised_by_the_budget(monkeypatch):
    """Clamping only ever pulls the timeout down, never up — a step that asks
    for a shorter timeout than the run's remaining budget keeps its own,
    smaller value."""
    captured = {}

    async def fake_safe_request(method, url, *, headers, content, timeout, client):
        captured["timeout"] = timeout
        return SimpleNamespace(
            status_code=200, headers={}, text="{}", elapsed_ms=1, truncated=False
        )

    monkeypatch.setattr("app.services.scenario_steps.safe_request", fake_safe_request)

    result = await execute_step(
        {
            "type": "http_request",
            "method": "GET",
            "url": "https://example.com/x",
            "timeout_seconds": 5,
        },
        {},
        budget_seconds=60.0,
    )

    assert result["status"] == "passed"
    assert captured["timeout"] == 5
