from collections import deque
from math import ceil
from threading import Lock
from time import monotonic

from fastapi import HTTPException


class SlidingWindowRateLimiter:
    """Small per-process limiter for the single-instance demo deployment."""

    def __init__(self, max_keys: int = 4096) -> None:
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()
        self._max_keys = max_keys

    def check(self, key: str, limit: int, window_seconds: int) -> None:
        now = monotonic()
        with self._lock:
            for existing_key, events in list(self._events.items()):
                while events and now - events[0] >= window_seconds:
                    events.popleft()
                if not events:
                    self._events.pop(existing_key, None)

            events = self._events.get(key)
            if events is None:
                if len(self._events) >= self._max_keys:
                    self._events.pop(next(iter(self._events)))
                events = self._events[key] = deque()

            if len(events) >= limit:
                retry_after = max(1, ceil(window_seconds - (now - events[0])))
                raise HTTPException(
                    status_code=429,
                    detail='Too many authentication attempts. Try again later.',
                    headers={'Retry-After': str(retry_after)},
                )
            events.append(now)


auth_rate_limiter = SlidingWindowRateLimiter()
