from typing import Optional
from crawler.cache.cache_manager import BaseCache
from crawler.cache.memory_cache import MemoryCache
from crawler.cache.file_cache import FileCache
from crawler.cache.redis_cache import RedisCache
from crawler.config import settings

_cache_instance: Optional[BaseCache] = None

def get_cache() -> BaseCache:
    global _cache_instance
    if _cache_instance is not None:
        return _cache_instance

    provider = settings.cache.provider.lower()
    if provider == "redis":
        _cache_instance = RedisCache()
    elif provider == "diskcache":
        _cache_instance = FileCache()
    else:
        _cache_instance = MemoryCache()
    return _cache_instance
