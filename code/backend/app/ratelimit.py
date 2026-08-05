"""In-memory rate limiting — protects the endpoints that call paid external
APIs (chat, embeddings, speech, web search) from being hammered.

There's no real authentication in this console (the login gate is a UI
convenience — see README), so per-account limits aren't an option; the
client's IP is the only identity available. Deliberately dependency-free: a
fixed window held in a plain dict for the life of the process. That's enough
for a single-instance deployment (a laptop, one Container App revision); a
multi-instance one would need a shared store (Redis) instead of this dict —
noted as a limitation, not solved here.
"""
from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request

from .config import settings

# client_id -> (window_start_epoch_seconds, request_count)
_windows: dict[str, tuple[float, int]] = defaultdict(lambda: (0.0, 0))


def check_rate_limit(client_id: str, limit: int, window_seconds: int = 60,
                      now: float | None = None) -> None:
    """Raise HTTPException(429) once `client_id` has made `limit` calls
    within the current `window_seconds`. Takes `now` explicitly so it's
    testable without a real clock or a real request."""
    now = time.time() if now is None else now
    window_start, count = _windows[client_id]

    if now - window_start >= window_seconds:
        _windows[client_id] = (now, 1)   # window rolled over — start fresh
        return

    if count >= limit:
        retry_after = int(window_seconds - (now - window_start)) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({limit} requests per {window_seconds}s). "
                   f"Retry in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    _windows[client_id] = (window_start, count + 1)


def rate_limit(request: Request) -> None:
    """FastAPI dependency — add to any route that calls a paid external API:
    `dependencies=[Depends(rate_limit)]`. Toggle off with RATE_LIMIT_ENABLED."""
    if not settings.rate_limit_enabled:
        return
    client_id = request.client.host if request.client else "unknown"
    check_rate_limit(client_id, settings.rate_limit_per_minute)


def reset_rate_limits() -> None:
    """Test-only: clear all counters between test cases."""
    _windows.clear()
