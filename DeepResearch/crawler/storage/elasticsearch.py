from elasticsearch import Elasticsearch
from crawler.models.document import Document
from crawler.models.chunk import Chunk
from crawler.config import settings
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class ElasticsearchStorage:
    def __init__(self) -> None:
        auth = None
        if settings.storage.elasticsearch_username and settings.storage.elasticsearch_password:
            auth = (settings.storage.elasticsearch_username, settings.storage.elasticsearch_password)
        self.client = Elasticsearch(
            hosts=settings.storage.elasticsearch_hosts,
            basic_auth=auth
        )
        self.index = settings.storage.elasticsearch_index
        self._ensure_index()

    def _ensure_index(self) -> None:
        try:
            if not self.client.indices.exists(index=self.index):
                self.client.indices.create(index=self.index)
        except Exception as e:
            logger.error(f"Elasticsearch index validation error: {e}")

    def save_document(self, doc: Document) -> None:
        try:
            self.client.index(index=self.index, id=doc.id, document=doc.model_dump())
        except Exception as e:
            logger.error(f"Elasticsearch save document error: {e}")

    def save_chunks(self, chunks: list[Chunk]) -> None:
        try:
            for ch in chunks:
                self.client.index(index=f"{self.index}_chunks", id=ch.id, document=ch.model_dump())
        except Exception as e:
            logger.error(f"Elasticsearch save chunks error: {e}")
