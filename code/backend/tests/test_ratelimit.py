import pytest
from fastapi import HTTPException

from app import ratelimit
from app.ratelimit import check_rate_limit, rate_limit, reset_rate_limits


@pytest.fixture(autouse=True)
def _clean_windows():
    reset_rate_limits()
    yield
    reset_rate_limits()


def test_allows_requests_up_to_the_limit():
    for _ in range(5):
        check_rate_limit("1.2.3.4", limit=5, now=1000.0)


def test_blocks_the_request_past_the_limit():
    for _ in range(5):
        check_rate_limit("1.2.3.4", limit=5, now=1000.0)
    with pytest.raises(HTTPException) as exc_info:
        check_rate_limit("1.2.3.4", limit=5, now=1000.5)
    assert exc_info.value.status_code == 429
    assert "Retry-After" in exc_info.value.headers


def test_different_clients_have_independent_limits():
    for _ in range(5):
        check_rate_limit("1.2.3.4", limit=5, now=1000.0)
    check_rate_limit("5.6.7.8", limit=5, now=1000.0)   # a fresh client, not blocked


def test_window_rolls_over_after_it_expires():
    for _ in range(5):
        check_rate_limit("1.2.3.4", limit=5, now=1000.0)
    # 61 seconds later, past the 60s window — should reset instead of blocking
    check_rate_limit("1.2.3.4", limit=5, now=1061.0)


def test_retry_after_header_reflects_remaining_window():
    for _ in range(3):
        check_rate_limit("1.2.3.4", limit=3, window_seconds=60, now=1000.0)
    with pytest.raises(HTTPException) as exc_info:
        check_rate_limit("1.2.3.4", limit=3, window_seconds=60, now=1030.0)
    assert exc_info.value.headers["Retry-After"] == "31"


def test_dependency_is_a_noop_when_disabled(monkeypatch):
    monkeypatch.setattr(ratelimit.settings, "rate_limit_enabled", False)
    rate_limit(request=None)   # would blow up on request.client if this didn't short-circuit
