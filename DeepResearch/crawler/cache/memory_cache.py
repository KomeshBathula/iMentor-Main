from typing import Dict, Optional, Any, Tuple
import time
import asyncio
from crawler.cache.cache_manager import BaseCache

class MemoryCache(BaseCache):
    def __init__(self) -> None:
        self._store: Dict[str, Tuple[Any, float]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if key not in self._store:
                return None
            val, expiry = self._store[key]
            if expiry > 0 and time.time() > expiry:
                del self._store[key]
                return None
            return val

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        async with self._lock:
            expiry = time.time() + ttl if ttl else 0
            self._store[key] = (value, expiry)

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()
