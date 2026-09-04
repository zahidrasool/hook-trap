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
