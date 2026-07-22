import os
from crawler.models.document import Document
from crawler.models.chunk import Chunk
from crawler.config import settings

class FileSystemStorage:
    def __init__(self) -> None:
        self.root = settings.storage.local_storage_dir
        os.makedirs(os.path.join(self.root, "processed"), exist_ok=True)
        os.makedirs(os.path.join(self.root, "chunks"), exist_ok=True)

    def save_document(self, doc: Document) -> str:
        path = os.path.join(self.root, "processed", f"{doc.id}.json")
        with open(path, "w", encoding="utf-8") as f:
            f.write(doc.model_dump_json(indent=2))
        return path

    def save_chunks(self, chunks: list[Chunk]) -> None:
        for chunk in chunks:
            path = os.path.join(self.root, "chunks", f"{chunk.id}.json")
            with open(path, "w", encoding="utf-8") as f:
                f.write(chunk.model_dump_json(indent=2))
