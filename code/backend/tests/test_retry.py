import pytest

from app.retry import with_retries


def test_returns_the_value_on_first_success():
    calls = []

    def fn():
        calls.append(1)
        return "ok"

    assert with_retries(fn) == "ok"
    assert len(calls) == 1


def test_retries_and_eventually_succeeds():
    attempts = {"n": 0}

    def fn():
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise ConnectionError("transient")
        return "ok"

    result = with_retries(fn, attempts=3, base_delay=0.001)
    assert result == "ok"
    assert attempts["n"] == 3


def test_raises_the_last_exception_after_exhausting_attempts():
    def fn():
        raise ConnectionError("still broken")

    with pytest.raises(ConnectionError, match="still broken"):
        with_retries(fn, attempts=3, base_delay=0.001)


def test_does_not_retry_a_non_retryable_exception():
    calls = []

    class DeliberateError(Exception):
        pass

    def fn():
        calls.append(1)
        raise DeliberateError("won't change on retry")

    with pytest.raises(DeliberateError):
        with_retries(fn, attempts=3, base_delay=0.001, non_retryable=(DeliberateError,))
    assert len(calls) == 1   # never retried


def test_backoff_delay_grows_between_attempts():
    import app.retry as retry_module

    sleeps = []
    original_sleep = retry_module.time.sleep
    retry_module.time.sleep = lambda s: sleeps.append(s)
    try:
        attempts = {"n": 0}

        def fn():
            attempts["n"] += 1
            raise ConnectionError("x")

        with pytest.raises(ConnectionError):
            with_retries(fn, attempts=3, base_delay=1.0)
    finally:
        retry_module.time.sleep = original_sleep

    assert sleeps == [1.0, 2.0]   # two backoff waits between three attempts, doubling each time
