import ipaddress
import socket

import httpx
import pytest

from app.services.http_client import MAX_BODY_BYTES, safe_request
from app.services.ssrf_guard import BlockedAddress


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    """Hostnames resolve to one public address; IP literals resolve to themselves.

    Mirroring the real resolver matters here. `getaddrinfo` on an IP literal
    returns that IP unchanged, so a mock that laundered every host into a
    public address would quietly make the blocked-address tests vacuous — the
    metadata address would "resolve" to something public and sail through.
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
async def test_blocked_target_never_reaches_the_transport():
    def handler(request):  # pragma: no cover - must never run
        raise AssertionError("the guard should have blocked this request")

    with pytest.raises(BlockedAddress):
        await safe_request("GET", "http://169.254.169.254/latest/", client=_client(handler))


@pytest.mark.asyncio
async def test_successful_request_returns_a_safe_response():
    def handler(request):
        assert request.headers["x-test"] == "yes"
        return httpx.Response(200, json={"ok": True})

    result = await safe_request(
        "POST",
        "https://example.com/hook",
        headers={"X-Test": "yes"},
        content='{"a":1}',
        client=_client(handler),
    )

    assert result.status_code == 200
    assert '"ok"' in result.text
    assert result.truncated is False
    assert result.final_url == "https://example.com/hook"
    assert result.elapsed_ms >= 0


@pytest.mark.asyncio
async def test_response_body_is_capped_and_flagged():
    def handler(request):
        return httpx.Response(200, content=b"x" * (MAX_BODY_BYTES + 5000))

    result = await safe_request("GET", "https://example.com/big", client=_client(handler))

    assert result.truncated is True
    assert len(result.text.encode("utf-8")) <= MAX_BODY_BYTES


@pytest.mark.asyncio
async def test_redirects_are_followed_and_revalidated():
    def handler(request):
        if request.url.path == "/start":
            return httpx.Response(302, headers={"Location": "https://example.com/end"})
        return httpx.Response(200, text="arrived")

    result = await safe_request("GET", "https://example.com/start", client=_client(handler))

    assert result.status_code == 200
    assert result.text == "arrived"
    assert result.final_url == "https://example.com/end"


@pytest.mark.asyncio
async def test_a_redirect_to_a_blocked_address_is_refused():
    """The classic bypass: a public URL that 302s to the metadata service."""

    def handler(request):
        if request.url.path == "/start":
            return httpx.Response(302, headers={"Location": "http://169.254.169.254/latest/"})
        raise AssertionError("must not follow the redirect")

    with pytest.raises(BlockedAddress):
        await safe_request("GET", "https://example.com/start", client=_client(handler))


@pytest.mark.asyncio
async def test_redirect_chains_are_bounded():
    def handler(request):
        return httpx.Response(302, headers={"Location": "https://example.com/again"})

    with pytest.raises(httpx.TooManyRedirects):
        await safe_request(
            "GET", "https://example.com/loop", max_redirects=3, client=_client(handler)
        )
