"""In-process token-bucket rate limiting keyed by client.

Single-instance only. For more than one replica, back this with a shared store (Redis)
or enforce limits at the edge; the interface stays the same.
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class _Bucket:
    tokens: float
    updated: float


class RateLimiter:
    def __init__(
        self,
        rate_per_minute: int,
        burst: int,
        *,
        clock: Callable[[], float] = time.monotonic,
        max_keys: int = 10_000,
    ) -> None:
        self._rate = rate_per_minute / 60.0
        self._burst = float(burst)
        self._clock = clock
        self._max_keys = max_keys
        self._buckets: OrderedDict[str, _Bucket] = OrderedDict()
        self._lock = threading.Lock()

    def allow(self, key: str) -> tuple[bool, float]:
        """Return (allowed, seconds_until_next_token)."""
        now = self._clock()
        with self._lock:
            bucket = self._buckets.pop(key, None) or _Bucket(tokens=self._burst, updated=now)
            bucket.tokens = min(self._burst, bucket.tokens + (now - bucket.updated) * self._rate)
            bucket.updated = now
            allowed = bucket.tokens >= 1.0
            if allowed:
                bucket.tokens -= 1.0
            self._buckets[key] = bucket  # most recently used goes last
            while len(self._buckets) > self._max_keys:
                self._buckets.popitem(last=False)
            wait = 0.0 if allowed else (1.0 - bucket.tokens) / self._rate
            return allowed, wait
