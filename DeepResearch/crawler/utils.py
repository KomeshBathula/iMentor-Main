import asyncio
import hashlib
from typing import Any, Callable, Coroutine, TypeVar
from urllib.parse import urlparse, urlunparse

T = TypeVar('T')

def normalize_url(url: str) -> str:
    """Normalize URL by stripping fragments and trailing slashes."""
    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip('/')
    if not path:
        path = '/'
    return urlunparse((parsed.scheme.lower(), netloc, path, parsed.params, parsed.query, ''))

def calculate_sha256(data: bytes) -> str:
    """Calculate SHA256 checksum of raw bytes."""
    return hashlib.sha256(data).hexdigest()

def calculate_text_hash(text: str) -> str:
    """Calculate SHA256 hash of a string."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

async def run_in_executor(func: Callable[..., T], *args: Any) -> T:
    """Run a blocking function inside the default loop executor."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, func, *args)
