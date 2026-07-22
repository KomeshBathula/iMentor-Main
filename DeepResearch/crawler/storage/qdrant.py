from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from crawler.models.chunk import Chunk
from crawler.config import settings
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class QdrantStorage:
    def __init__(self) -> None:
        self.client = QdrantClient(url=settings.storage.qdrant_url, api_key=settings.storage.qdrant_api_key)
        self.collection_name = settings.storage.qdrant_collection_name
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        try:
            collections = self.client.get_collections().collections
            names = [c.name for c in collections]
            if self.collection_name not in names:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=settings.embedding.dimension, distance=Distance.COSINE)
                )
        except Exception as e:
            logger.error(f"Failed to create/validate Qdrant Collection: {e}")

    def save_chunks(self, chunks: list[Chunk]) -> None:
        points = []
        for ch in chunks:
            if not ch.embedding:
                continue
            import uuid
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, ch.id))
            payload = {
                "id": ch.id,
                "document_id": ch.document_id,
                "text": ch.text,
                "chunk_index": ch.chunk_index,
                "metadata": ch.metadata
            }
            points.append(PointStruct(id=point_id, vector=ch.embedding, payload=payload))
            
        if points:
            try:
                self.client.upsert(collection_name=self.collection_name, points=points)
            except Exception as e:
                logger.error(f"Qdrant upload points failed: {e}")
