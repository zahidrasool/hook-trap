"""The single outbound HTTP entry point.

Every request to a user-supplied address goes through here, so the address
policy is applied in exactly one place. Redirects are followed manually
rather than by httpx, because each hop has to be re-validated — a public URL
that 302s to the instance metadata service is the bypass this exists to stop.

Response bodies are capped: a scenario step stores what it received, and an
unbounded body would let one request fill the volume Postgres and the app share.
"""

import asyncio
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpx

from app.services.ssrf_guard import validate_url

MAX_BODY_BYTES = 256 * 1024

MAX_HEADER_VALUE_BYTES = 4096

# Dropped when a redirect crosses to a different origin. Browsers do this for
# Authorization and curl requires --location-trusted to do otherwise; a replay
# tool forwarding a captured webhook's headers must not be more permissive than
# a browser, or a captured provider signature follows the redirect to whoever
# the target chose.
_CROSS_ORIGIN_STRIP = ("authorization", "cookie", "proxy-authorization", "x-api-key")


def _same_origin(a: str, b: str) -> bool:
    first, second = urlparse(a), urlparse(b)
    return (first.scheme, first.hostname, first.port) == (
        second.scheme,
        second.hostname,
        second.port,
    )


def _strip_cross_origin_headers(headers: dict) -> dict:
    kept = {}
    for name, value in headers.items():
        lowered = name.lower()
        if lowered in _CROSS_ORIGIN_STRIP or "signature" in lowered:
            continue
        kept[name] = value
    return kept


@dataclass
class SafeResponse:
    status_code: int
    headers: dict
    text: str
    truncated: bool
    elapsed_ms: int
    final_url: str


@asynccontextmanager
async def _client_for(client: httpx.AsyncClient | None, timeout: float):
    """Use the caller's client if given (tests), otherwise own one."""
    if client is not None:
        yield client
        return
    async with httpx.AsyncClient(timeout=timeout) as owned:
        yield owned


def _truncate(body: bytes) -> tuple[str, bool]:
    if len(body) <= MAX_BODY_BYTES:
        return body.decode("utf-8", errors="replace"), False

    text = body[:MAX_BODY_BYTES].decode("utf-8", errors="replace")
    # Each undecodable byte becomes U+FFFD, which re-encodes to three bytes, so
    # a byte-slice alone can still overrun the cap threefold. Re-slice the
    # encoded form; errors="ignore" drops a trailing partial character rather
    # than adding another replacement.
    encoded = text.encode("utf-8")
    if len(encoded) > MAX_BODY_BYTES:
        text = encoded[:MAX_BODY_BYTES].decode("utf-8", errors="ignore")
    return text, True


async def _read_capped(response: httpx.Response) -> bytes:
    """Read at most one byte past the cap, then stop pulling from the socket.

    One byte past, not exactly the cap: `_truncate` decides truncation by
    comparing against MAX_BODY_BYTES, so a body of exactly the cap must not be
    reported as truncated while one larger must. Stopping the iteration closes
    the response, so a target streaming forever is disconnected rather than
    followed.
    """
    chunks: list[bytes] = []
    total = 0
    async for chunk in response.aiter_bytes():
        chunks.append(chunk)
        total += len(chunk)
        if total > MAX_BODY_BYTES:
            break
    return b"".join(chunks)


def _cap_header_value(value: str) -> str:
    """Cap a header value by its UTF-8 byte length, not Python string length.

    A non-ASCII value can sit within MAX_HEADER_VALUE_BYTES characters yet
    exceed it in bytes, so indexing by character doesn't bound storage the
    way the name promises. errors="ignore" on the trailing decode drops a
    partial multi-byte character rather than mangling it, matching how the
    body cap above handles the same edge.
    """
    encoded = value.encode("utf-8")
    if len(encoded) <= MAX_HEADER_VALUE_BYTES:
        return value
    return encoded[:MAX_HEADER_VALUE_BYTES].decode("utf-8", errors="ignore")


def _pin(url: str, ip: str) -> tuple[str, str]:
    """Rewrite `url` to address `ip` directly, returning (wire_url, host_header).

    `validate_url` resolves a hostname and checks every address it returns, and
    then httpx resolves the same name a second time when it connects. Between
    those two lookups the answer can change — a DNS rebinding attack is exactly
    an attacker returning a public address to the first query and 169.254.169.254
    to the second. Connecting to the address that was actually validated closes
    that window, and closes the matching gap where the guard's IDNA handling and
    httpx's disagree about what a hostname means.

    TLS still verifies against the ORIGINAL hostname: the caller passes
    sni_hostname so the handshake presents and checks the real name, not the
    literal IP. Without that this would silently downgrade certificate
    validation, trading one security hole for a worse one.
    """
    parsed = urlparse(url)
    # An IPv6 literal has to be bracketed in an authority, an IPv4 one must not.
    literal = f"[{ip}]" if ":" in ip else ip
    authority = f"{literal}:{parsed.port}" if parsed.port else literal
    # The Host header keeps the original name AND its port: virtual hosting and
    # many frameworks' absolute-URL generation both read it.
    host_header = parsed.netloc.rsplit("@", 1)[-1]
    return parsed._replace(netloc=authority).geturl(), host_header


async def safe_request(
    method: str,
    url: str,
    *,
    headers: dict | None = None,
    content: str | bytes | None = None,
    timeout: float = 30.0,
    max_redirects: int = 3,
    client: httpx.AsyncClient | None = None,
) -> SafeResponse:
    """Send one request, validating the address at every hop.

    `timeout` is the total wall-clock budget for the whole call, redirects
    included — not a per-hop value. A hostile target that 302s repeatedly
    cannot use each hop to buy itself a fresh `timeout` seconds; the budget is
    shared across every hop and enforced before each one is sent.

    Raises BlockedAddress if the target — or any redirect target — is not
    allowed, and httpx.TooManyRedirects if the chain exceeds a non-zero
    max_redirects. With max_redirects=0 a redirect response is returned as the
    final SafeResponse rather than followed or raised on — the same semantics
    as httpx's own follow_redirects=False.
    """
    started = time.monotonic()
    current_url = url
    sent_headers = dict(headers or {})
    redirects_followed = 0

    async with _client_for(client, timeout) as http:
        while True:
            remaining = timeout - (time.monotonic() - started)
            if remaining <= 0:
                raise httpx.TimeoutException(
                    f"Exceeded {timeout}s total wall-clock budget "
                    f"(redirects included) requesting {url}"
                )

            # getaddrinfo is blocking. Called inline it would freeze the event
            # loop for the resolver's whole budget on any hostname whose
            # nameserver blackholes queries, stalling every other request in
            # the process. httpx does its own resolution on a worker thread;
            # ours has to as well.
            resolved = await asyncio.to_thread(validate_url, current_url)

            # Address the validated IP rather than the name, so the connection
            # cannot land somewhere the guard never saw. Everything else — the
            # redirect bookkeeping, same-origin comparison, final_url — keeps
            # using the logical URL, because that is what the caller asked for
            # and what a redirect's Location is relative to.
            wire_url, host_header = _pin(current_url, resolved[0])
            hop_headers = dict(sent_headers)
            hop_headers.setdefault("Host", host_header)

            # stream(), not request(): reading response.content materialises
            # the whole body in memory before MAX_BODY_BYTES can bound it, so
            # the cap limited what was *stored* while a hostile target could
            # still make the process allocate a gigabyte. Streaming stops
            # reading once the cap is passed, which is the difference between
            # bounding storage and bounding memory — and it matters now that
            # several runs execute at once.
            async with http.stream(
                method,
                wire_url,
                headers=hop_headers,
                content=content,
                follow_redirects=False,
                timeout=remaining,
                # Present and verify the real hostname in the TLS handshake
                # even though we dialled an IP. Omitting this would make httpx
                # check the certificate against the IP literal, which no
                # ordinary certificate carries — every HTTPS call would fail,
                # or worse, appear to work with verification weakened.
                extensions={"sni_hostname": urlparse(current_url).hostname},
            ) as response:
                location = response.headers.get("location")
                is_redirect = 300 <= response.status_code < 400 and bool(location)

                if is_redirect and redirects_followed < max_redirects:
                    # Derive the next URL ourselves rather than reading
                    # response.next_request: httpx only populates that when it
                    # is doing the following, and here it is not. The body is
                    # never read on this path — a redirect's body is discarded
                    # anyway, so streaming lets us skip downloading it.
                    next_url = urljoin(current_url, location)
                    if not _same_origin(current_url, next_url):
                        sent_headers = _strip_cross_origin_headers(sent_headers)
                    current_url = next_url
                    # A redirected request carries no body, and its method
                    # becomes GET for 301/302/303 exactly as a browser would do.
                    if response.status_code in (301, 302, 303):
                        method, content = "GET", None
                    redirects_followed += 1
                    continue

                if is_redirect and max_redirects > 0:
                    # Budget was non-zero and the chain outran it — that is the
                    # only case that raises. max_redirects == 0 means "don't
                    # follow", not "budget of zero to exceed", so it falls
                    # through to return the redirect response itself below.
                    raise httpx.TooManyRedirects(
                        f"Exceeded {max_redirects} redirects starting from {url}"
                    )

                body = await _read_capped(response)
                text, truncated = _truncate(body)
                return SafeResponse(
                    status_code=response.status_code,
                    headers={
                        name: _cap_header_value(value)
                        for name, value in response.headers.items()
                    },
                    text=text,
                    truncated=truncated,
                    elapsed_ms=int((time.monotonic() - started) * 1000),
                    final_url=current_url,
                )
