import os
from urllib.parse import urlparse
from crawler.downloader.web_downloader import WebDownloader
from crawler.utils import calculate_text_hash
from crawler.config import settings

class FileDownloader:
    def __init__(self, web_downloader: WebDownloader) -> None:
        self.web_downloader = web_downloader

    async def download(self, url: str) -> str:
        parsed = urlparse(url)
        _, ext = os.path.splitext(parsed.path)
        if not ext:
            ext = ".bin"
        file_hash = calculate_text_hash(url)
        dest_path = os.path.join(settings.storage.local_storage_dir, "raw", f"{file_hash}{ext}")
        await self.web_downloader.download_file(url, dest_path)
        return dest_path
