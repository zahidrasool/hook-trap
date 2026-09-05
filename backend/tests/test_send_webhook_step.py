import ipaddress
import json
import socket

import httpx
import pytest

from app.services.scenario_steps import execute_step


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    """Hostnames resolve to one public address; IP literals resolve to themselves."""

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
async def test_send_webhook_posts_the_event_body():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        seen["type"] = request.headers.get("x-mocklane-event")
        return httpx.Response(200, json={"ok": True})

    result = await execute_step(
        {
            "type": "send_webhook",
            "url": "{{appUrl}}/webhooks/payment",
            "event": "payment.completed",
            "body": {"paymentId": "{{paymentId}}"},
            "assert": ["status == 200"],
        },
        {"appUrl": "https://example.com", "paymentId": "pay_1"},
        client=_client(handler),
    )

    assert result["status"] == "passed"
    assert seen["url"] == "https://example.com/webhooks/payment"
    assert seen["body"] == {"paymentId": "pay_1"}
    assert seen["type"] == "payment.completed"


@pytest.mark.asyncio
async def test_send_webhook_to_a_blocked_address_is_an_error():
    def handler(request):  # pragma: no cover - must not run
        raise AssertionError("the guard should have blocked this")

    result = await execute_step(
        {"type": "send_webhook", "url": "http://169.254.169.254/latest/", "event": "x"},
        {},
        client=_client(handler),
    )

    assert result["status"] == "error"
    assert "not a public address" in result["error"]


@pytest.mark.asyncio
async def test_send_webhook_requires_a_url():
    result = await execute_step({"type": "send_webhook", "event": "x"}, {})

    assert result["status"] == "error"
    assert "url" in result["error"]


@pytest.mark.asyncio
async def test_send_webhook_failing_assertion_fails_the_step():
    def handler(request):
        return httpx.Response(500, json={})

    result = await execute_step(
        {
            "type": "send_webhook",
            "url": "https://example.com/hook",
            "event": "x",
            "assert": ["status == 200"],
        },
        {},
        client=_client(handler),
    )

    assert result["status"] == "failed"
