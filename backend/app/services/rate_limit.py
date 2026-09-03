"""Fixed-window rate limiting.

Backed by Redis so counters are shared if the app is ever run as more than one
process. Redis is optional everywhere else in this codebase, so this degrades to
a per-process dictionary rather than failing closed — a single instance still
gets useful protection, and a Redis outage must not take sign-in down with it.
"""

import logging
import time

from app.config import get_settings
from app.db.redis import redis_client

logger = logging.getLogger(__name__)

# Fallback store: {key: (count, window_expiry_epoch)}. Only consulted when Redis
# is unavailable, and pruned opportunistically to avoid unbounded growth.
_local: dict[str, tuple[int, float]] = {}
_LOCAL_MAX_KEYS = 10_000


def _local_hit(key: str, limit: int, window: int) -> tuple[bool, int]:
    now = time.time()

    if len(_local) > _LOCAL_MAX_KEYS:
        for k, (_, exp) in list(_local.items()):
            if exp <= now:
                _local.pop(k, None)

    count, expiry = _local.get(key, (0, 0.0))
    if expiry <= now:
        count, expiry = 0, now + window

    count += 1
    _local[key] = (count, expiry)

    if count > limit:
        return False, max(1, int(expiry - now))
    return True, 0


async def check_rate_limit(key: str, limit: int, window: int) -> tuple[bool, int]:
    """Count one hit against `key`.

    Returns (allowed, retry_after_seconds). retry_after is 0 when allowed.
    """
    if not get_settings().rate_limit_enabled:
        return True, 0

    namespaced = f"ratelimit:{key}"

    try:
        client = redis_client.client
        count = await client.incr(namespaced)
        if count == 1:
            # First hit in this window starts the clock.
            await client.expire(namespaced, window)

        if count > limit:
            ttl = await client.ttl(namespaced)
            return False, max(1, ttl if ttl and ttl > 0 else window)
        return True, 0
    except Exception:
        # RuntimeError when Redis was never initialised, connection errors
        # otherwise. Either way, fall back rather than reject the request.
        logger.debug("Rate limit falling back to in-process store for %s", key)
        return _local_hit(namespaced, limit, window)


def client_ip(request) -> str:
    """Best-effort client address.

    Behind Caddy the socket peer is the proxy, so prefer the forwarded header.
    Only the first entry is trusted; the rest can be spoofed by the client.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
