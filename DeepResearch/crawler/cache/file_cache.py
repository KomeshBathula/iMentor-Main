import os
from typing import Optional, Any
from crawler.cache.cache_manager import BaseCache
from crawler.utils import run_in_executor
from crawler.config import settings

class FileCache(BaseCache):
    def __init__(self) -> None:
        import diskcache
        self.directory = settings.cache.diskcache_dir
        os.makedirs(self.directory, exist_ok=True)
        self.cache = diskcache.Cache(self.directory)

    async def get(self, key: str) -> Optional[Any]:
        return await run_in_executor(self.cache.get, key)

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        await run_in_executor(self.cache.set, key, value, ttl)

    async def delete(self, key: str) -> None:
        await run_in_executor(self.cache.delete, key)

    async def clear(self) -> None:
        await run_in_executor(self.cache.clear)
