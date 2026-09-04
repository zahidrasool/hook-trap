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
