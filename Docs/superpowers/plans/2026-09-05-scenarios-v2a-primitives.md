# Scenarios v2a — Execution Primitives

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three pure building blocks the scenario engine needs — an SSRF policy for outbound requests, a run-scoped variable namespace, and an assertion parser/evaluator — and close the live SSRF hole in replay while doing it.

**Architecture:** Four self-contained modules with no database access and no engine. Everything here is unit-testable in isolation and consumed by Plan 2b's worker. The one integration point is `replay_service`, which is retrofitted onto the new safe HTTP client — that retrofit is the reason this plan ships value before the engine exists.

**Tech Stack:** Python 3.12, httpx, pytest. No new dependencies.

## Global Constraints

- Backend Python runs from `backend/.venv`. Commands assume cwd `D:\Personal\etc\HookTrap\backend`.
- Tests run against PostgreSQL `mocklane_test`. SQLite is not supported.
- **Tests must never make outbound network calls, and must never perform real DNS resolution.** `socket.getaddrinfo` is monkeypatched in every test that needs name resolution; blocked-address tests use IP literals so no resolution happens at all.
- Every module in this plan is pure: no `AsyncSession`, no model imports, no Redis. The only exception is Task 2's retrofit of `replay_service`, which already has a session.
- Deny by default. A URL that cannot be parsed, resolved, or classified is blocked, never allowed through.
- Do not modify anything under `app/models/` or `app/api/` — this plan adds services and changes one existing service.

---

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `backend/app/services/ssrf_guard.py` | Scheme allow-list and address classification for outbound URLs |
| `backend/app/services/http_client.py` | The only outbound HTTP entry point: applies the guard, bounds redirects and response size |
| `backend/app/services/scenario_variables.py` | Run variable namespace: seeding, interpolation, capture |
| `backend/app/services/assertions.py` | Parse assertion strings into structured form and evaluate them |
| `backend/tests/test_ssrf_guard.py` | Address policy |
| `backend/tests/test_http_client.py` | Guard enforcement, redirect bounding, body cap |
| `backend/tests/test_scenario_variables.py` | Namespace precedence, interpolation, capture |
| `backend/tests/test_assertions.py` | Parsing and evaluation |

**Modified**

| File | Change |
| --- | --- |
| `backend/app/services/replay_service.py` | Route outbound calls through `safe_request`; record a blocked target as an error rather than crashing |

---

### Task 1: The SSRF address policy

**Files:**
- Create: `backend/app/services/ssrf_guard.py`
- Create: `backend/tests/test_ssrf_guard.py`

**Interfaces:**
- Produces:
  - `ALLOWED_SCHEMES: tuple[str, ...]`
  - `class BlockedAddress(Exception)`
  - `validate_url(url: str) -> list[str]` — returns the validated resolved IPs, or raises `BlockedAddress` with a reason in `str(exc)`

This task is pure policy: no HTTP. Task 2 enforces it.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_ssrf_guard.py`:

```python
import socket

import pytest

from app.services.ssrf_guard import ALLOWED_SCHEMES, BlockedAddress, validate_url


def _fake_resolver(mapping):
    """Stand in for socket.getaddrinfo so no test performs real DNS."""

    def _getaddrinfo(host, port, *args, **kwargs):
        if host not in mapping:
            raise socket.gaierror(f"unknown host {host}")
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port or 0))
            for ip in mapping[host]
        ]

    return _getaddrinfo


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data/",  # EC2 instance metadata
        "http://127.0.0.1:8000/health",
        "http://localhost:8000/health",
        "https://10.0.0.5/internal",
        "https://192.168.1.1/admin",
        "https://172.16.0.1/admin",
        "http://[::1]:8000/",
        "http://0.0.0.0/",
        "http://[::ffff:127.0.0.1]/",  # IPv4-mapped loopback
    ],
)
def test_private_and_reserved_addresses_are_blocked(url, monkeypatch):
    monkeypatch.setattr(
        socket, "getaddrinfo", _fake_resolver({"localhost": ["127.0.0.1"]})
    )
    with pytest.raises(BlockedAddress):
        validate_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/x",
        "file:///etc/passwd",
        "gopher://example.com/",
        "//example.com/no-scheme",
    ],
)
def test_only_http_and_https_are_allowed(url):
    with pytest.raises(BlockedAddress):
        validate_url(url)


def test_public_address_is_allowed(monkeypatch):
    monkeypatch.setattr(
        socket, "getaddrinfo", _fake_resolver({"example.com": ["93.184.216.34"]})
    )
    assert validate_url("https://example.com/webhooks") == ["93.184.216.34"]


def test_every_resolved_address_must_be_public(monkeypatch):
    """A name resolving to one public and one private address is blocked.

    Round-robin DNS with a single internal answer is the cheapest bypass;
    validating only the first record would let it through.
    """
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        _fake_resolver({"sneaky.test": ["93.184.216.34", "10.0.0.5"]}),
    )
    with pytest.raises(BlockedAddress):
        validate_url("https://sneaky.test/x")


def test_unresolvable_host_is_blocked(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_resolver({}))
    with pytest.raises(BlockedAddress):
        validate_url("https://nope.invalid/x")


def test_missing_host_is_blocked():
    with pytest.raises(BlockedAddress):
        validate_url("http:///nohost")


def test_blocked_reason_names_the_problem(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _fake_resolver({}))

    with pytest.raises(BlockedAddress) as exc:
        validate_url("ftp://example.com/x")
    assert "scheme" in str(exc.value).lower()

    with pytest.raises(BlockedAddress) as exc:
        validate_url("http://127.0.0.1/x")
    assert "127.0.0.1" in str(exc.value)


def test_allowed_schemes_are_exactly_http_and_https():
    assert set(ALLOWED_SCHEMES) == {"http", "https"}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_ssrf_guard.py -q`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.ssrf_guard'`

- [ ] **Step 3: Write the guard**

Create `backend/app/services/ssrf_guard.py`:

```python
"""Address policy for outbound requests.

Scenarios make outbound HTTP routine rather than user-triggered, so SSRF stops
being theoretical. The policy is deny-by-default: `http`/`https` only, and
*every* address the hostname resolves to must be public unicast. Validating
only the first answer would be defeated by round-robin DNS with one internal
record.

The address that matters most here is 169.254.169.254 — on EC2 that is the
instance metadata service, and reaching it exposes the instance role's
credentials.

**Known limitation, stated rather than hidden.** This resolves the name, checks
the answers, and then hands the URL to the HTTP client, which resolves it
again. A name whose DNS answer changes between those two moments (DNS
rebinding) is not defeated. Closing that requires pinning the connection to the
validated IP and carrying the original Host header; it is not implemented here.
Do not describe this module as SSRF-proof.
"""

import ipaddress
import socket
from urllib.parse import urlparse

ALLOWED_SCHEMES = ("http", "https")


class BlockedAddress(Exception):
    """Raised when a URL may not be requested. The message names the reason."""


def _is_public_unicast(raw_ip: str) -> bool:
    try:
        ip = ipaddress.ip_address(raw_ip)
    except ValueError:
        return False

    # ::ffff:127.0.0.1 is loopback wearing an IPv6 costume.
    if ip.version == 6 and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped

    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def validate_url(url: str) -> list[str]:
    """Return the resolved IPs for `url`, or raise BlockedAddress."""
    try:
        parsed = urlparse(url)
    except ValueError as exc:
        raise BlockedAddress(f"Could not parse URL: {exc}") from exc

    if parsed.scheme not in ALLOWED_SCHEMES:
        raise BlockedAddress(
            f"Scheme {parsed.scheme!r} is not allowed; only {', '.join(ALLOWED_SCHEMES)}"
        )

    host = parsed.hostname
    if not host:
        raise BlockedAddress("URL has no host")

    try:
        answers = socket.getaddrinfo(host, parsed.port or None, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError, ValueError) as exc:
        raise BlockedAddress(f"Could not resolve {host!r}: {exc}") from exc

    resolved = [answer[4][0] for answer in answers]
    if not resolved:
        raise BlockedAddress(f"{host!r} resolved to no addresses")

    for raw_ip in resolved:
        if not _is_public_unicast(raw_ip):
            raise BlockedAddress(
                f"{host!r} resolves to {raw_ip}, which is not a public address"
            )

    return resolved
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_ssrf_guard.py -q`

Expected: `19 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ssrf_guard.py backend/tests/test_ssrf_guard.py
git commit -m "feat(security): add an address policy for outbound requests"
```

---

### Task 2: The safe HTTP client, and closing the replay SSRF hole

`replay_service.replay_capture` currently sends a request to any `target_url` a
user supplies, with no scheme check, no address check and
unbounded response size. That is a live SSRF vector in deployed code. This task
builds the one outbound entry point and moves replay onto it.

**Files:**
- Create: `backend/app/services/http_client.py`
- Create: `backend/tests/test_http_client.py`
- Modify: `backend/app/services/replay_service.py`

**Interfaces:**
- Consumes: `validate_url`, `BlockedAddress` from Task 1.
- Produces:
  - `MAX_BODY_BYTES: int` (262144)
  - `@dataclass SafeResponse` with fields `status_code: int`, `headers: dict`, `text: str`, `truncated: bool`, `elapsed_ms: int`, `final_url: str`
  - `async safe_request(method: str, url: str, *, headers: dict | None = None, content: str | bytes | None = None, timeout: float = 30.0, max_redirects: int = 3, client: httpx.AsyncClient | None = None) -> SafeResponse`

The `client` parameter is a test seam: tests pass an `httpx.AsyncClient` built
on `httpx.MockTransport`. Production callers omit it.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_http_client.py`:

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_http_client.py -q`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.http_client'`

- [ ] **Step 3: Write the client**

Create `backend/app/services/http_client.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_http_client.py -q`

Expected: `6 passed`

- [ ] **Step 5: Write the failing test for the replay retrofit**

Append to `backend/tests/test_replay.py`, replacing its placeholder comment:

```python
import socket
import uuid

import pytest

from app.models.endpoint import Endpoint
from app.models.session import ReplaySession
from app.models.webhook import WebhookCapture
from app.services.replay_service import replay_capture


@pytest.mark.asyncio
async def test_replaying_to_a_private_address_is_recorded_as_an_error(
    db_session, test_user, monkeypatch
):
    """The SSRF hole this closes: replay used to send anywhere the user named."""

    def _getaddrinfo(host, port, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", port or 0))]

    monkeypatch.setattr(socket, "getaddrinfo", _getaddrinfo)

    endpoint = Endpoint(user_id=test_user.id, short_id="rep0000001")
    db_session.add(endpoint)
    await db_session.flush()

    capture = WebhookCapture(
        endpoint_id=endpoint.id, http_method="POST", headers={}, body='{"a":1}'
    )
    db_session.add(capture)
    await db_session.flush()

    session = ReplaySession(endpoint_id=endpoint.id, name="t", target_url="http://x")
    db_session.add(session)
    await db_session.flush()

    result = await replay_capture(
        capture, "http://169.254.169.254/latest/", None, session.id, db_session
    )

    assert result.response_status is None
    assert "not a public address" in (result.error_message or "")
```

Read `backend/app/models/session.py` first and adjust the `ReplaySession`
constructor arguments to match its actual required columns — the fields above
are the expected shape, not verified.

- [ ] **Step 6: Run it to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/test_replay.py -q`

Expected: FAIL — the request is attempted and the assertion on `error_message` does not match, because `replay_capture` still calls `httpx` directly.

- [ ] **Step 7: Retrofit replay onto the safe client**

In `backend/app/services/replay_service.py`, replace the `import httpx` line with:

```python
from app.services.http_client import safe_request
from app.services.ssrf_guard import BlockedAddress
```

and replace the whole `try/except` request block with:

```python
    try:
        response = await safe_request(
            method=capture.http_method,
            url=target_url,
            headers=headers,
            content=body,
            timeout=30.0,
        )
        response_status = response.status_code
        response_body = response.text
        response_time_ms = response.elapsed_ms
    except BlockedAddress as exc:
        # A refused target is a user error, not a crash: record it on the row
        # so the dashboard can show why the replay did not go out.
        error_message = f"Refused to replay to this target: {exc}"
        response_time_ms = 0
    except Exception as exc:
        error_message = str(exc)
        response_time_ms = int((time.time() - start_time) * 1000)
```

Note the timeout branch disappears — `safe_request` raises
`httpx.TimeoutException`, which the general handler already records. Keep the
`start_time` assignment; it is still used by the general handler.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_replay.py -q`

Expected: `1 passed`

- [ ] **Step 9: Run the whole suite and commit**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `64 passed` (57 existing + 6 http_client + 1 replay)

```bash
git add backend/app/services/http_client.py backend/app/services/replay_service.py backend/tests/test_http_client.py backend/tests/test_replay.py
git commit -m "feat(security): route outbound requests through an SSRF-checked client"
```

---

### Task 3: The run variable namespace

**Files:**
- Create: `backend/app/services/scenario_variables.py`
- Create: `backend/tests/test_scenario_variables.py`

**Interfaces:**
- Produces:
  - `MISSING` — a unique sentinel distinguishing "path not present" from "value is null"
  - `class UnresolvedVariable(Exception)`
  - `resolve_path(data, dotpath: str)` — returns the value or `MISSING`
  - `build_namespace(*layers: dict | None) -> dict` — later layers win
  - `interpolate(value, namespace: dict)` — recurses through str/dict/list, raises `UnresolvedVariable`
  - `capture_values(spec: dict[str, str], source: dict) -> dict`

`resolve_path` exists rather than reusing `template_engine.get_nested_value`
because that function returns `None` both for a missing key and for a key whose
value is `null` — which would make an `exists` assertion in Task 4 lie. The two
existing near-identical copies of `get_nested_value` (in `template_engine` and
`mock_service`) are a known duplication; consolidating them is not this plan's
job and must not be attempted here.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_scenario_variables.py`:

```python
import pytest

from app.services.scenario_variables import (
    MISSING,
    UnresolvedVariable,
    build_namespace,
    capture_values,
    interpolate,
    resolve_path,
)


def test_resolve_path_distinguishes_missing_from_null():
    data = {"a": {"b": None}}

    assert resolve_path(data, "a.b") is None
    assert resolve_path(data, "a.c") is MISSING
    assert resolve_path(data, "x.y.z") is MISSING


def test_resolve_path_indexes_lists():
    data = {"items": [{"id": 7}, {"id": 9}]}

    assert resolve_path(data, "items.1.id") == 9
    assert resolve_path(data, "items.5.id") is MISSING


def test_build_namespace_applies_layers_in_increasing_precedence():
    result = build_namespace(
        {"baseUrl": "https://env", "shared": "env"},
        {"baseUrl": "https://scenario"},
        {"baseUrl": "https://trigger"},
    )

    assert result == {"baseUrl": "https://trigger", "shared": "env"}


def test_build_namespace_ignores_none_layers():
    assert build_namespace({"a": 1}, None, {"b": 2}) == {"a": 1, "b": 2}


def test_interpolate_replaces_a_whole_string():
    assert interpolate("{{baseUrl}}/pay", {"baseUrl": "https://x"}) == "https://x/pay"


def test_interpolate_preserves_type_for_a_lone_placeholder():
    """{{amount}} alone yields the value, not its string form.

    A JSON body needs 4900, not "4900" — the difference decides whether the
    customer's API rejects the request.
    """
    assert interpolate("{{amount}}", {"amount": 4900}) == 4900
    assert interpolate("amount is {{amount}}", {"amount": 4900}) == "amount is 4900"


def test_interpolate_recurses_through_dicts_and_lists():
    result = interpolate(
        {"url": "{{base}}/x", "ids": ["{{one}}", "static"]},
        {"base": "https://x", "one": 1},
    )

    assert result == {"url": "https://x/x", "ids": [1, "static"]}


def test_interpolate_leaves_non_strings_alone():
    assert interpolate(7, {}) == 7
    assert interpolate(None, {}) is None
    assert interpolate(True, {}) is True


def test_an_unresolved_variable_is_an_error_not_an_empty_string():
    """Silently substituting nothing produces confusing downstream failures."""
    with pytest.raises(UnresolvedVariable) as exc:
        interpolate("{{nope}}/x", {"other": 1})
    assert "nope" in str(exc.value)


def test_capture_values_reads_dotted_paths_from_a_step_result():
    source = {"response": {"body": {"paymentId": "pay_1"}}, "captured_at": "t0"}

    assert capture_values(
        {"paymentId": "response.body.paymentId", "at": "captured_at"}, source
    ) == {"paymentId": "pay_1", "at": "t0"}


def test_capturing_a_missing_path_is_an_error():
    with pytest.raises(UnresolvedVariable):
        capture_values({"x": "response.body.nope"}, {"response": {"body": {}}})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_variables.py -q`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.scenario_variables'`

- [ ] **Step 3: Write the module**

Create `backend/app/services/scenario_variables.py`:

```python
"""The per-run variable namespace.

One namespace per run, seeded in increasing precedence from workspace defaults,
the scenario's own variables, and whatever was supplied at trigger time. Steps
read it through `{{name}}` interpolation and write to it via `capture`.

An unresolved `{{var}}` is an error, never an empty string. Substituting
nothing produces a request that looks plausible and fails somewhere else, which
is far harder to debug than the step failing where the variable was missing.
"""

import re

_PLACEHOLDER = re.compile(r"\{\{\s*([^}\s]+)\s*\}\}")


class _Missing:
    """Sentinel for 'this path is not present', distinct from a null value."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __repr__(self):
        return "MISSING"

    def __bool__(self):
        return False


MISSING = _Missing()


class UnresolvedVariable(Exception):
    """A referenced variable or captured path was not present."""


def resolve_path(data, dotpath: str):
    """Value at `dotpath`, or MISSING. Null values are returned as None."""
    if not dotpath:
        return MISSING

    current = data
    for key in dotpath.split("."):
        if isinstance(current, dict):
            if key not in current:
                return MISSING
            current = current[key]
        elif isinstance(current, list) and key.lstrip("-").isdigit():
            index = int(key)
            if not -len(current) <= index < len(current):
                return MISSING
            current = current[index]
        else:
            return MISSING
    return current


def build_namespace(*layers: dict | None) -> dict:
    """Merge variable layers, later ones winning."""
    namespace: dict = {}
    for layer in layers:
        if layer:
            namespace.update(layer)
    return namespace


def interpolate(value, namespace: dict):
    """Substitute {{name}} throughout `value`, recursing into dicts and lists."""
    if isinstance(value, dict):
        return {key: interpolate(item, namespace) for key, item in value.items()}
    if isinstance(value, list):
        return [interpolate(item, namespace) for item in value]
    if not isinstance(value, str):
        return value

    # A string that is exactly one placeholder yields the value itself, so a
    # number stays a number in a JSON body rather than becoming a string.
    # Matched without stripping on purpose: "  {{x}}  " contains more than the
    # placeholder, so it interpolates to a padded string rather than silently
    # discarding the padding and changing type.
    whole = _PLACEHOLDER.fullmatch(value)
    if whole:
        return _lookup(whole.group(1), namespace)

    def _replace(match):
        return str(_lookup(match.group(1), namespace))

    return _PLACEHOLDER.sub(_replace, value)


def _lookup(name: str, namespace: dict):
    found = resolve_path(namespace, name)
    if found is MISSING:
        raise UnresolvedVariable(
            f"Variable {{{{{name}}}}} is not defined in this run"
        )
    return found


def capture_values(spec: dict[str, str], source: dict) -> dict:
    """Extract `{name: dotted.path}` from a step's result into new variables."""
    captured = {}
    for name, dotpath in (spec or {}).items():
        found = resolve_path(source, dotpath)
        if found is MISSING:
            raise UnresolvedVariable(
                f"Cannot capture {name!r}: {dotpath!r} is not present in the step result"
            )
        captured[name] = found
    return captured
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_scenario_variables.py -q`

Expected: `11 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/scenario_variables.py backend/tests/test_scenario_variables.py
git commit -m "feat(scenarios): add the per-run variable namespace"
```

---

### Task 4: Assertion parsing and evaluation

**Files:**
- Create: `backend/app/services/assertions.py`
- Create: `backend/tests/test_assertions.py`

**Interfaces:**
- Consumes: `MISSING`, `resolve_path` from Task 3.
- Produces:
  - `class AssertionSyntaxError(Exception)`
  - `@dataclass Assertion` with `raw: str`, `kind: str`, `path: str`, `op: str | None`, `expected`
  - `parse_assertion(raw: str) -> Assertion`
  - `evaluate(assertion: Assertion, context: dict) -> dict` — returns `{"assertion", "passed", "expected", "actual"}`
  - `evaluate_all(raws: list[str], context: dict) -> list[dict]`

**The evaluation context is a flat dict the step builds.** Assertion paths
resolve against it with `resolve_path`. Plan 2b's step executors are
responsible for populating it; this plan only defines the contract:

| key | meaning |
| --- | --- |
| `status` | HTTP status of the step's response |
| `response.body` | parsed response body |
| `response.headers` | response headers |
| `response.time_ms` | round-trip time |
| `body` | for wait steps, the matched payload |
| `subject` | for email steps |
| `_elapsed_s` | seconds the step waited, read by `received_within` |

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_assertions.py`:

```python
import pytest

from app.services.assertions import (
    AssertionSyntaxError,
    evaluate,
    evaluate_all,
    parse_assertion,
)

CONTEXT = {
    "status": 200,
    "response": {
        "body": {"paymentId": "pay_1", "amount": 4900, "note": None},
        "time_ms": 812,
    },
    "body": {"event": "payment.completed"},
    "subject": "Payment confirmed for order 7",
    "_elapsed_s": 3.2,
}


@pytest.mark.parametrize(
    "raw,kind,path,op",
    [
        ("status == 200", "comparison", "status", "=="),
        ("response.time_ms < 2000", "comparison", "response.time_ms", "<"),
        ("status != 500", "comparison", "status", "!="),
        ("response.body.paymentId exists", "existence", "response.body.paymentId", None),
        ('subject contains "Payment"', "containment", "subject", None),
        ("received_within 10s", "timing", "_elapsed_s", None),
    ],
)
def test_parses_each_supported_form(raw, kind, path, op):
    parsed = parse_assertion(raw)

    assert parsed.raw == raw
    assert parsed.kind == kind
    assert parsed.path == path
    assert parsed.op == op


@pytest.mark.parametrize(
    "raw",
    ["", "   ", "status", "status ~= 200", "contains 'x'", "received_within soon"],
)
def test_unparseable_assertions_are_rejected(raw):
    with pytest.raises(AssertionSyntaxError):
        parse_assertion(raw)


def test_comparison_passes_and_reports_both_sides():
    result = evaluate(parse_assertion("status == 200"), CONTEXT)

    assert result == {
        "assertion": "status == 200",
        "passed": True,
        "expected": 200,
        "actual": 200,
    }


def test_a_failure_reports_the_actual_value():
    """A red X with no actual value is useless — this is the whole point."""
    result = evaluate(parse_assertion("status == 201"), CONTEXT)

    assert result["passed"] is False
    assert result["expected"] == 201
    assert result["actual"] == 200


def test_numeric_comparison():
    assert evaluate(parse_assertion("response.time_ms < 2000"), CONTEXT)["passed"] is True
    assert evaluate(parse_assertion("response.time_ms > 2000"), CONTEXT)["passed"] is False


def test_string_equality_on_a_path():
    parsed = parse_assertion('body.event == "payment.completed"')
    assert evaluate(parsed, CONTEXT)["passed"] is True


def test_existence_distinguishes_missing_from_null():
    assert evaluate(parse_assertion("response.body.paymentId exists"), CONTEXT)["passed"] is True
    assert evaluate(parse_assertion("response.body.nope exists"), CONTEXT)["passed"] is False
    # Present but null counts as existing — the key was returned by the API.
    assert evaluate(parse_assertion("response.body.note exists"), CONTEXT)["passed"] is True


def test_containment():
    assert evaluate(parse_assertion('subject contains "Payment"'), CONTEXT)["passed"] is True
    assert evaluate(parse_assertion('subject contains "Refund"'), CONTEXT)["passed"] is False


def test_timing():
    assert evaluate(parse_assertion("received_within 10s"), CONTEXT)["passed"] is True
    assert evaluate(parse_assertion("received_within 2s"), CONTEXT)["passed"] is False


def test_comparing_a_missing_path_fails_rather_than_erroring():
    result = evaluate(parse_assertion("response.body.nope == 1"), CONTEXT)

    assert result["passed"] is False
    assert result["actual"] is None


def test_comparing_incomparable_types_fails_cleanly():
    result = evaluate(parse_assertion("subject < 5"), CONTEXT)

    assert result["passed"] is False


def test_evaluate_all_returns_one_result_per_assertion_in_order():
    results = evaluate_all(["status == 200", "status == 500"], CONTEXT)

    assert [r["passed"] for r in results] == [True, False]
    assert [r["assertion"] for r in results] == ["status == 200", "status == 500"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/test_assertions.py -q`

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.assertions'`

- [ ] **Step 3: Write the module**

Create `backend/app/services/assertions.py`:

```python
"""Assertion strings, parsed into a structured form and evaluated.

Strings keep the YAML readable; parsing keeps the results machine-checkable.
Every evaluation returns the assertion, whether it passed, what was expected
and what was actually there — because a failed run whose report says only
"failed" tells the user nothing about why.

The set is deliberately small. Anything not expressible here belongs in the
customer's own test suite, not in a mock platform's assertion language.
"""

import json
import re
from dataclasses import dataclass

from app.services.scenario_variables import MISSING, resolve_path

COMPARISONS = ("==", "!=", "<=", ">=", "<", ">")

_TIMING = re.compile(r"^received_within\s+(\d+(?:\.\d+)?)\s*s$")
_EXISTENCE = re.compile(r"^(?P<path>\S+)\s+exists$")
_CONTAINMENT = re.compile(r"^(?P<path>\S+)\s+contains\s+(?P<value>.+)$")


class AssertionSyntaxError(Exception):
    """The assertion string could not be parsed."""


@dataclass
class Assertion:
    raw: str
    kind: str          # comparison | existence | containment | timing
    path: str
    op: str | None
    expected: object


def _literal(token: str):
    """Interpret a right-hand side: quoted string, number, bool, or null."""
    token = token.strip()
    if len(token) >= 2 and token[0] == token[-1] and token[0] in "\"'":
        return token[1:-1]
    lowered = token.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    if lowered in ("null", "none"):
        return None
    try:
        return json.loads(token)
    except (json.JSONDecodeError, ValueError):
        return token


def parse_assertion(raw: str) -> Assertion:
    text = (raw or "").strip()
    if not text:
        raise AssertionSyntaxError("Empty assertion")

    timing = _TIMING.match(text)
    if timing:
        return Assertion(raw, "timing", "_elapsed_s", None, float(timing.group(1)))

    existence = _EXISTENCE.match(text)
    if existence:
        return Assertion(raw, "existence", existence.group("path"), None, None)

    containment = _CONTAINMENT.match(text)
    if containment:
        return Assertion(
            raw,
            "containment",
            containment.group("path"),
            None,
            _literal(containment.group("value")),
        )

    # Longest operators first, so "<=" is not read as "<".
    for op in sorted(COMPARISONS, key=len, reverse=True):
        marker = f" {op} "
        if marker in text:
            left, _, right = text.partition(marker)
            if left.strip() and right.strip():
                return Assertion(raw, "comparison", left.strip(), op, _literal(right))

    raise AssertionSyntaxError(f"Could not parse assertion: {raw!r}")


def _compare(op: str, actual, expected) -> bool:
    try:
        if op == "==":
            return actual == expected
        if op == "!=":
            return actual != expected
        if op == "<":
            return actual < expected
        if op == "<=":
            return actual <= expected
        if op == ">":
            return actual > expected
        if op == ">=":
            return actual >= expected
    except TypeError:
        # Comparing a string to a number is a failed assertion, not a crash.
        return False
    return False


def evaluate(assertion: Assertion, context: dict) -> dict:
    found = resolve_path(context, assertion.path)
    actual = None if found is MISSING else found

    if assertion.kind == "existence":
        passed = found is not MISSING
        expected = "present"
        actual = "present" if passed else "missing"
    elif assertion.kind == "containment":
        passed = found is not MISSING and str(assertion.expected) in str(found)
        expected = assertion.expected
    elif assertion.kind == "timing":
        passed = found is not MISSING and _compare("<=", found, assertion.expected)
        expected = f"within {assertion.expected}s"
    else:
        passed = found is not MISSING and _compare(assertion.op, found, assertion.expected)
        expected = assertion.expected

    return {
        "assertion": assertion.raw,
        "passed": passed,
        "expected": expected,
        "actual": actual,
    }


def evaluate_all(raws: list[str], context: dict) -> list[dict]:
    """Evaluate every assertion; a syntax error becomes a failed result.

    One malformed assertion must not hide the outcome of the others.
    """
    results = []
    for raw in raws or []:
        try:
            results.append(evaluate(parse_assertion(raw), context))
        except AssertionSyntaxError as exc:
            results.append(
                {"assertion": raw, "passed": False, "expected": "parseable assertion", "actual": str(exc)}
            )
    return results
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/Scripts/python.exe -m pytest tests/test_assertions.py -q`

Expected: `22 passed`

- [ ] **Step 5: Run the whole suite**

Run: `.venv/Scripts/python.exe -m pytest tests/ -q`

Expected: `97 passed` (64 after Task 2 + 11 variables + 22 assertions)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/assertions.py backend/tests/test_assertions.py
git commit -m "feat(scenarios): parse and evaluate the assertion set"
```

---

## What this plan does not do

- No worker, run API, or step executors — Plan 2b.
- No `scenario_runs` quota meter — Plan 2b, alongside the runs it meters.
- No webhook signing (`send_webhook`'s `sign:` block) — design §9, deferred to v2.
- No connection-level IP pinning, so DNS rebinding remains possible. Stated in
  `ssrf_guard`'s docstring rather than glossed over.
- No consolidation of the two duplicate `get_nested_value` implementations.
