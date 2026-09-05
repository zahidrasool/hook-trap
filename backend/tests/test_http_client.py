import ipaddress
import socket

import httpx
import pytest

from app.services.http_client import MAX_BODY_BYTES, MAX_HEADER_VALUE_BYTES, safe_request
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
        # Dispatch on the Host header, not request.url.host: connections are
        # pinned to the validated IP, so the URL's host is an address and the
        # original name travels in Host — which is what a real server reads.
        if request.headers.get("host", "").startswith("example.com"):
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
        # Host header, not request.url.host — connections are pinned to the
        # validated IP, so the URL carries an address.
        if request.headers.get("host", "").startswith("example.com"):
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


@pytest.mark.asyncio
async def test_response_headers_are_capped():
    def handler(request):
        return httpx.Response(200, headers={"X-Huge": "v" * 20000}, text="ok")

    result = await safe_request("GET", "https://example.com/x", client=_client(handler))

    assert len(result.headers["x-huge"]) <= MAX_HEADER_VALUE_BYTES


# --- bounded memory, not just bounded storage -------------------------------


@pytest.mark.asyncio
async def test_an_endless_body_is_not_read_to_the_end():
    """The cap has to bound MEMORY, not only what gets stored.

    Reading response.content first materialises the whole body and only then
    truncates it, so a target streaming without end could make the process
    allocate arbitrarily much before the cap was ever consulted. This asserts
    the socket stops being pulled, by counting what the server actually got
    asked for: an unbounded generator that is never stopped would spin here
    forever rather than fail, so the ceiling is what keeps the test honest.
    """
    from app.services.http_client import MAX_BODY_BYTES

    produced = {"bytes": 0}
    chunk = b"x" * 8192
    ceiling = MAX_BODY_BYTES * 8

    async def endless():
        while produced["bytes"] < ceiling:
            produced["bytes"] += len(chunk)
            yield chunk

    def handler(request):
        return httpx.Response(200, content=endless())

    response = await safe_request("GET", "https://example.com/", client=_client(handler))

    assert response.truncated
    assert produced["bytes"] < ceiling, "the generator ran to its ceiling — nothing stopped it"
    # One chunk of slack past the cap: the reader stops on the first chunk that
    # crosses it, and cannot stop mid-chunk.
    assert produced["bytes"] <= MAX_BODY_BYTES + len(chunk)


@pytest.mark.asyncio
async def test_a_body_exactly_at_the_cap_is_not_reported_truncated():
    """The boundary the reader's 'one byte past' rule exists to get right."""
    from app.services.http_client import MAX_BODY_BYTES

    def handler(request):
        return httpx.Response(200, content=b"y" * MAX_BODY_BYTES)

    response = await safe_request("GET", "https://example.com/", client=_client(handler))

    assert not response.truncated
    assert len(response.text) == MAX_BODY_BYTES


@pytest.mark.asyncio
async def test_a_redirect_body_is_never_downloaded():
    """A redirect's body is discarded, so streaming should skip it entirely."""
    from app.services.http_client import MAX_BODY_BYTES

    produced = {"bytes": 0}

    def handler(request):
        if request.url.path == "/start":
            async def body():
                produced["bytes"] += MAX_BODY_BYTES
                yield b"z" * MAX_BODY_BYTES

            return httpx.Response(
                302, headers={"location": "https://example.com/end"}, content=body()
            )
        return httpx.Response(200, text="arrived")

    response = await safe_request(
        "GET", "https://example.com/start", client=_client(handler)
    )

    assert response.text == "arrived"
    assert produced["bytes"] == 0, "the redirect's body was downloaded and thrown away"


# --- connection pinning -----------------------------------------------------


@pytest.mark.asyncio
async def test_the_connection_goes_to_the_validated_address_not_the_name():
    """Closes the DNS rebinding window between validation and connection.

    The guard resolves a name and checks every address it gets back; httpx then
    resolves the same name again when it connects. An attacker who controls the
    zone can answer the first query with a public address and the second with
    169.254.169.254. Dialling the address that was actually validated is what
    makes those two answers impossible to differ.
    """
    seen = {}

    def handler(request):
        seen["url_host"] = request.url.host
        seen["host_header"] = request.headers.get("host")
        return httpx.Response(200, text="ok")

    await safe_request("GET", "https://example.com/path", client=_client(handler))

    # 93.184.216.34 is what this module's getaddrinfo fixture resolves names to.
    assert seen["url_host"] == "93.184.216.34", "connected to the name, not the checked address"
    assert seen["host_header"].startswith("example.com"), (
        "the original hostname must still travel in Host, or virtual hosting breaks"
    )


@pytest.mark.asyncio
async def test_pinning_preserves_the_port_and_path():
    """A non-default port must survive the rewrite, or requests silently
    retarget to 443."""
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["host_header"] = request.headers.get("host")
        return httpx.Response(200, text="ok")

    await safe_request("GET", "https://example.com:8443/deep/path?q=1", client=_client(handler))

    assert seen["url"] == "https://93.184.216.34:8443/deep/path?q=1"
    assert seen["host_header"] == "example.com:8443"


@pytest.mark.asyncio
async def test_an_explicit_host_header_from_the_caller_is_not_overwritten():
    """setdefault, not assignment: a scenario author who sets Host deliberately
    (testing virtual-host routing) must keep the value they wrote."""
    seen = {}

    def handler(request):
        seen["host_header"] = request.headers.get("host")
        return httpx.Response(200, text="ok")

    await safe_request(
        "GET",
        "https://example.com/",
        headers={"Host": "chosen.example"},
        client=_client(handler),
    )

    assert seen["host_header"] == "chosen.example"


@pytest.mark.asyncio
async def test_final_url_reports_the_logical_url_not_the_pinned_address():
    """The caller asked for a name; the report must answer in those terms."""

    def handler(request):
        return httpx.Response(200, text="ok")

    response = await safe_request("GET", "https://example.com/x", client=_client(handler))

    assert response.final_url == "https://example.com/x"
