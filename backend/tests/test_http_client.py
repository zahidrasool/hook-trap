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


@pytest.mark.asyncio
async def test_response_body_cap_holds_for_non_utf8_content():
    """A byte-slice alone can overrun the cap: each undecodable byte becomes
    U+FFFD, which re-encodes to three bytes. 0xFF is never a valid UTF-8
    continuation or lead byte, so every byte in this body decodes to a
    replacement character."""

    def handler(request):
        return httpx.Response(200, content=b"\xff" * (MAX_BODY_BYTES + 5000))

    result = await safe_request("GET", "https://example.com/binary", client=_client(handler))

    assert result.truncated is True
    assert len(result.text.encode("utf-8")) <= MAX_BODY_BYTES


@pytest.mark.asyncio
async def test_cross_host_redirect_strips_sensitive_headers():
    """The classic bypass this closes: a captured provider signature or a
    bearer token must not follow a redirect to a host the caller didn't ask
    for."""
    captured = {}

    def handler(request):
        if request.url.host == "example.com":
            return httpx.Response(302, headers={"Location": "https://attacker.example/steal"})
        captured["headers"] = request.headers
        return httpx.Response(200, text="ok")

    await safe_request(
        "GET",
        "https://example.com/start",
        headers={
            "Authorization": "Bearer secret",
            "Cookie": "session=abc",
            "X-Hub-Signature": "sha256=deadbeef",
            "Accept": "application/json",
        },
        client=_client(handler),
    )

    headers = captured["headers"]
    assert "authorization" not in headers
    assert "cookie" not in headers
    assert "x-hub-signature" not in headers
    assert headers.get("accept") == "application/json"


@pytest.mark.asyncio
async def test_same_host_redirect_keeps_sensitive_headers():
    """Stripping unconditionally would be its own bug: a same-origin redirect
    (pagination, trailing-slash normalization, etc.) must not drop auth."""
    captured = {}

    def handler(request):
        if request.url.path == "/start":
            return httpx.Response(302, headers={"Location": "https://example.com/end"})
        captured["headers"] = request.headers
        return httpx.Response(200, text="ok")

    await safe_request(
        "GET",
        "https://example.com/start",
        headers={
            "Authorization": "Bearer secret",
            "Cookie": "session=abc",
            "X-Hub-Signature": "sha256=deadbeef",
        },
        client=_client(handler),
    )

    headers = captured["headers"]
    assert headers.get("authorization") == "Bearer secret"
    assert headers.get("cookie") == "session=abc"
    assert headers.get("x-hub-signature") == "sha256=deadbeef"


@pytest.mark.asyncio
async def test_307_redirect_preserves_method_and_body_cross_host():
    captured = {}

    def handler(request):
        if request.url.host == "example.com":
            return httpx.Response(307, headers={"Location": "https://other.example/end"})
        captured["method"] = request.method
        captured["body"] = request.content
        return httpx.Response(200, text="ok")

    await safe_request(
        "POST", "https://example.com/start", content=b'{"a":1}', client=_client(handler)
    )

    assert captured["method"] == "POST"
    assert captured["body"] == b'{"a":1}'


@pytest.mark.asyncio
async def test_302_redirect_downgrades_to_get_with_no_body():
    captured = {}

    def handler(request):
        if request.url.host == "example.com":
            return httpx.Response(302, headers={"Location": "https://other.example/end"})
        captured["method"] = request.method
        captured["body"] = request.content
        return httpx.Response(200, text="ok")

    await safe_request(
        "POST", "https://example.com/start", content=b'{"a":1}', client=_client(handler)
    )

    assert captured["method"] == "GET"
    assert captured["body"] == b""


@pytest.mark.asyncio
async def test_redirect_chain_of_exactly_max_redirects_succeeds():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] <= 3:
            return httpx.Response(
                302, headers={"Location": f"https://example.com/hop{calls['n']}"}
            )
        return httpx.Response(200, text="arrived")

    result = await safe_request(
        "GET", "https://example.com/start", max_redirects=3, client=_client(handler)
    )

    assert result.status_code == 200
    assert result.text == "arrived"


@pytest.mark.asyncio
async def test_redirect_chain_of_max_redirects_plus_one_raises():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        return httpx.Response(302, headers={"Location": f"https://example.com/hop{calls['n']}"})

    with pytest.raises(httpx.TooManyRedirects):
        await safe_request(
            "GET", "https://example.com/start", max_redirects=3, client=_client(handler)
        )


@pytest.mark.asyncio
async def test_max_redirects_zero_returns_the_redirect_instead_of_raising():
    """max_redirects=0 means 'don't follow', matching httpx's own
    follow_redirects=False — not 'a budget of zero to exceed'."""

    def handler(request):
        return httpx.Response(302, headers={"Location": "https://example.com/end"})

    result = await safe_request(
        "GET", "https://example.com/start", max_redirects=0, client=_client(handler)
    )

    assert result.status_code == 302
    assert result.final_url == "https://example.com/start"
