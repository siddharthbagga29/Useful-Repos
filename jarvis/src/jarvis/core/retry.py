"""Self-healing for transient failures: bounded retries with exponential backoff.

Only errors that are plausibly temporary (network timeouts, connection resets, HTTP 429/5xx) are
retried, at most `attempts` times in total; anything else fails at once so a real bug is never
hidden behind retries. Every retry is reported through `on_retry` so the task log shows it.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import TypeVar

import httpx

T = TypeVar("T")


def transient(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return code == 429 or code >= 500
    return isinstance(exc, httpx.TransportError | TimeoutError | ConnectionError)


def retry(
    fn: Callable[[], T],
    *,
    attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 20.0,
    is_transient: Callable[[BaseException], bool] = transient,
    on_retry: Callable[[int, BaseException, float], None] | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> T:
    if attempts < 1:
        raise ValueError("attempts must be at least 1")
    for n in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:
            if n == attempts or not is_transient(exc):
                raise
            delay = min(max_delay, base_delay * 2 ** (n - 1))
            if on_retry:
                on_retry(n, exc, delay)
            sleep(delay)
    raise AssertionError("unreachable")
