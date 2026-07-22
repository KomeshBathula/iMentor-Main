from typing import Optional, Any
import json
from crawler.cache.cache_manager import BaseCache
from crawler.config import settings
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class RedisCache(BaseCache):
    def __init__(self) -> None:
        import redis.asyncio as redis
        self.client = redis.from_url(settings.cache.redis_url)

    async def get(self, key: str) -> Optional[Any]:
        try:
            val = await self.client.get(key)
            if val:
                return json.loads(val.decode('utf-8'))
        except Exception as e:
            logger.error(f"Redis get failed: {e}")
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        try:
            payload = json.dumps(value)
            await self.client.set(key, payload, ex=ttl)
        except Exception as e:
            logger.error(f"Redis set failed: {e}")

    async def delete(self, key: str) -> None:
        try:
            await self.client.delete(key)
        except Exception as e:
            logger.error(f"Redis delete failed: {e}")

    async def clear(self) -> None:
        try:
            await self.client.flushdb()
        except Exception as e:
            logger.error(f"Redis clear failed: {e}")
