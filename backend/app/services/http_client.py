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
            await asyncio.to_thread(validate_url, current_url)

            response = await http.request(
                method,
                current_url,
                headers=sent_headers,
                content=content,
                follow_redirects=False,
                timeout=remaining,
            )

            location = response.headers.get("location")
            is_redirect = 300 <= response.status_code < 400 and bool(location)

            if is_redirect and redirects_followed < max_redirects:
                # Derive the next URL ourselves rather than reading
                # response.next_request: httpx only populates that when it is
                # doing the following, and here it is not.
                next_url = urljoin(current_url, location)
                if not _same_origin(current_url, next_url):
                    sent_headers = _strip_cross_origin_headers(sent_headers)
                current_url = next_url
                # A redirected request carries no body, and its method becomes
                # GET for 301/302/303 exactly as a browser would do.
                if response.status_code in (301, 302, 303):
                    method, content = "GET", None
                redirects_followed += 1
                continue

            if is_redirect and max_redirects > 0:
                # Budget was non-zero and the chain outran it — that is the
                # only case that raises. max_redirects == 0 means "don't
                # follow", not "budget of zero to exceed", so it falls through
                # to return the redirect response itself below.
                raise httpx.TooManyRedirects(
                    f"Exceeded {max_redirects} redirects starting from {url}"
                )

            text, truncated = _truncate(response.content)
            return SafeResponse(
                status_code=response.status_code,
                headers=dict(response.headers),
                text=text,
                truncated=truncated,
                elapsed_ms=int((time.monotonic() - started) * 1000),
                final_url=current_url,
            )
