"""The single outbound HTTP entry point.

Every request the product makes on a user's behalf goes through here, so the
address policy is applied in exactly one place. Redirects are followed manually
rather than by httpx, because each hop has to be re-validated — a public URL
that 302s to the instance metadata service is the bypass this exists to stop.

Response bodies are capped: a scenario step stores what it received, and an
unbounded body would let one request fill the volume Postgres and the app share.
"""

import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from urllib.parse import urljoin

import httpx

from app.services.ssrf_guard import validate_url

MAX_BODY_BYTES = 256 * 1024


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
    return body[:MAX_BODY_BYTES].decode("utf-8", errors="replace"), True


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

    Raises BlockedAddress if the target — or any redirect target — is not
    allowed, and httpx.TooManyRedirects if the chain exceeds max_redirects.
    """
    started = time.monotonic()
    current_url = url
    sent_headers = dict(headers or {})

    async with _client_for(client, timeout) as http:
        for _ in range(max_redirects + 1):
            validate_url(current_url)

            response = await http.request(
                method,
                current_url,
                headers=sent_headers,
                content=content,
                follow_redirects=False,
                timeout=timeout,
            )

            location = response.headers.get("location")
            if 300 <= response.status_code < 400 and location:
                # Derive the next URL ourselves rather than reading
                # response.next_request: httpx only populates that when it is
                # doing the following, and here it is not.
                current_url = urljoin(current_url, location)
                # A redirected request carries no body, and its method becomes
                # GET for 301/302/303 exactly as a browser would do.
                if response.status_code in (301, 302, 303):
                    method, content = "GET", None
                continue

            text, truncated = _truncate(response.content)
            return SafeResponse(
                status_code=response.status_code,
                headers=dict(response.headers),
                text=text,
                truncated=truncated,
                elapsed_ms=int((time.monotonic() - started) * 1000),
                final_url=current_url,
            )

    raise httpx.TooManyRedirects(
        f"Exceeded {max_redirects} redirects starting from {url}"
    )
