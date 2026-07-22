from typing import Optional
from crawler.models.document import Document
from crawler.models.chunk import Chunk
from crawler.config import settings
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class MongoDBStorage:
    def __init__(self) -> None:
        from pymongo import MongoClient
        self.client = MongoClient(settings.storage.mongodb_uri)
        self.db = self.client[settings.storage.mongodb_db_name]
        self.docs_col = self.db["documents"]
        self.chunks_col = self.db["chunks"]

    def save_document(self, doc: Document) -> None:
        try:
            self.docs_col.replace_one({"id": doc.id}, doc.model_dump(), upsert=True)
        except Exception as e:
            logger.error(f"MongoDB save document error: {e}")

    def save_chunks(self, chunks: list[Chunk]) -> None:
        try:
            for ch in chunks:
                self.chunks_col.replace_one({"id": ch.id}, ch.model_dump(), upsert=True)
        except Exception as e:
            logger.error(f"MongoDB save chunks error: {e}")
