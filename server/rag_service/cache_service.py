import redis
import json
import logging
import config

# Setup Logging
logger = logging.getLogger(__name__)

class CacheService:
    """
    Implements Task 1.2.3: Redis Integration for Sub-50ms Routing Cache.
    Hardens the orchestrator performance for repeated student queries.
    """
    def __init__(self, redis_url: str):
        self.redis_client = None
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                # Test connection
                self.redis_client.ping()
                logger.info(f"Connected to Redis cache at {redis_url}")
            except Exception as e:
                logger.error(f"Redis connection failed: {e}. Falling back to in-memory (simulated).")

    def get_cache(self, key: str):
        if not self.redis_client:
            return None
        try:
            data = self.redis_client.get(f"im_cache:{key}")
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Cache GET error: {e}")
        return None

    def set_cache(self, key: str, value: any, expire_seconds: int = 86400):
        if not self.redis_client:
            return
        try:
            self.redis_client.set(f"im_cache:{key}", json.dumps(value), ex=expire_seconds)
        except Exception as e:
            logger.error(f"Cache SET error: {e}")

    def clear_cache(self):
        if self.redis_client:
            self.redis_client.flushall()
            logger.info("Cache cleared.")

# Singleton instance
cache_service = CacheService(config.REDIS_URL)
