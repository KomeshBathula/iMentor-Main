import asyncio
import functools
from typing import Any, Callable, Coroutine, TypeVar
from crawler.logger import setup_logger
from crawler.config import settings

logger = setup_logger(__name__)
T = TypeVar("T")

def retry_async(func: Callable[..., Coroutine[Any, Any, T]]) -> Callable[..., Coroutine[Any, Any, T]]:
    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> T:
        max_retries = settings.retry.max_retries
        backoff = settings.retry.backoff_factor
        
        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_error = e
                if attempt == max_retries:
                    break
                
                sleep_time = backoff ** attempt
                logger.warning(
                    f"Retry active for {func.__name__}. Attempt {attempt}/{max_retries} failed: {e}. "
                    f"Retrying in {sleep_time:.2f} seconds..."
                )
                await asyncio.sleep(sleep_time)
        
        raise last_error or RuntimeError(f"Retry orchestration failed for {func.__name__}")
    return wrapper
