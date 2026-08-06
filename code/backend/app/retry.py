"""Retry transient failures on the way to a model/embedding provider.

Found by hand while testing the document-attachment feature: the exact same
embedding call failed once with a raw connection reset
(`ConnectionResetError(10054, ...)`) after 21 seconds, then succeeded in
under 3 seconds on the very next attempt, three times in a row. That's the
signature of a transient network blip, not a real failure — worth one or two
retries before it reaches the user as an error.
"""
from __future__ import annotations

import logging
import time
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


def with_retries(fn: Callable[[], T], attempts: int = 3, base_delay: float = 0.5,
                  non_retryable: tuple[type[BaseException], ...] = ()) -> T:
    """Call `fn()`, retrying with exponential backoff (base_delay, then
    2x, 4x, …) on anything except `non_retryable`.

    Retrying broadly (rather than matching specific connection-error types)
    is deliberate: OpenAI, Anthropic, and Azure each wrap the same kind of
    transient network failure in their own SDK's exception classes, and
    trying to enumerate all of them is a losing game. `non_retryable` is the
    other half of that trade-off — it exists for exceptions this app raises
    deliberately for a condition that will not change between one attempt
    and the next (a guardrail block, a persona that doesn't exist, a service
    that isn't configured) — retrying those would just add delay in front of
    the same, correct error.
    """
    last_exc: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except non_retryable:
            raise
        except Exception as e:
            last_exc = e
            if attempt == attempts:
                break
            delay = base_delay * (2 ** (attempt - 1))
            logger.warning("Attempt %d/%d failed (%s: %s) — retrying in %.1fs",
                           attempt, attempts, type(e).__name__, e, delay)
            time.sleep(delay)
    raise last_exc
