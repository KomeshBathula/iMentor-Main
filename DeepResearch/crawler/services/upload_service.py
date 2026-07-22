import os
from crawler.config import settings

class UploadService:
    def __init__(self) -> None:
        self.raw_dir = os.path.join(settings.storage.local_storage_dir, "raw")
        os.makedirs(self.raw_dir, exist_ok=True)

    def save_uploaded_file(self, filename: str, content: bytes) -> str:
        dest_path = os.path.join(self.raw_dir, filename)
        with open(dest_path, "wb") as f:
            f.write(content)
        return dest_path
