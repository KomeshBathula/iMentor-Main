import os
import random
from typing import Optional, Dict, Any
import httpx
from crawler.downloader.retry import retry_async
from crawler.config import settings
from crawler.logger import setup_logger
from crawler.constants import DEFAULT_HEADERS
from crawler.exceptions import DownloadError

logger = setup_logger(__name__)

class WebDownloader:
    def __init__(self) -> None:
        self.headers = DEFAULT_HEADERS.copy()

    def _get_headers(self) -> Dict[str, str]:
        headers = self.headers.copy()
        if settings.crawler.user_agents:
            headers["User-Agent"] = random.choice(settings.crawler.user_agents)
        return headers

    def _get_client_args(self) -> Dict[str, Any]:
        args: Dict[str, Any] = {
            "timeout": float(settings.crawler.request_timeout),
            "follow_redirects": True,
        }
        if settings.proxy.enabled and settings.proxy.proxy_urls:
            proxy_url = random.choice(settings.proxy.proxy_urls)
            args["proxies"] = proxy_url
        return args

    @retry_async
    async def download_html(self, url: str) -> str:
        client_args = self._get_client_args()
        async with httpx.AsyncClient(**client_args) as client:
            headers = self._get_headers()
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                raise DownloadError(f"Failed to fetch {url}: HTTP {response.status_code}")
            return response.text

    @retry_async
    async def download_file(self, url: str, dest_path: str) -> None:
        client_args = self._get_client_args()
        async with httpx.AsyncClient(**client_args) as client:
            headers = self._get_headers()
            async with client.stream("GET", url, headers=headers) as response:
                if response.status_code != 200:
                    raise DownloadError(f"Failed to download file {url}: HTTP {response.status_code}")
                
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                import aiofiles
                async with aiofiles.open(dest_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        await f.write(chunk)
