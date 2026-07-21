import os
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings

from config import settings
from utils.logger import logger


class ChromaVectorStore:
    """
    ChromaDB Vector Store Manager.
    Handles persistent vector storage, indexing, and similarity searching.
    """

    def __init__(self, collection_name: str = "deep_research"):
        os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIRECTORY,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(name=collection_name)

    async def add_texts(
        self,
        texts: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
        ids: Optional[List[str]] = None
    ) -> List[str]:
        """
        Add text chunks with pre-computed embeddings and metadata to ChromaDB.
        """
        if not texts:
            return []

        if ids is None:
            import uuid
            ids = [str(uuid.uuid4()) for _ in range(len(texts))]

        logger.info(f"[ChromaVectorStore] Storing {len(texts)} embeddings in ChromaDB.")
        self.collection.add(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
        return ids

    async def similarity_search_by_vector(
        self,
        query_embedding: List[float],
        k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Perform vector similarity search for a query embedding.
        """
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=k
        )

        output = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0]
            distances = results["distances"][0] if "distances" in results else [0.0] * len(docs)

            for doc, meta, dist in zip(docs, metas, distances):
                output.append({
                    "content": doc,
                    "metadata": meta,
                    "score": 1.0 - float(dist)
                })
        return output
