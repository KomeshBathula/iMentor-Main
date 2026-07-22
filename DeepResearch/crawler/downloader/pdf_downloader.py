import os
from crawler.downloader.web_downloader import WebDownloader
from crawler.utils import calculate_text_hash
from crawler.config import settings

class PDFDownloader:
    def __init__(self, web_downloader: WebDownloader) -> None:
        self.web_downloader = web_downloader

    async def download(self, url: str) -> str:
        file_hash = calculate_text_hash(url)
        dest_path = os.path.join(settings.storage.local_storage_dir, "raw", f"{file_hash}.pdf")
        await self.web_downloader.download_file(url, dest_path)
        return dest_path
