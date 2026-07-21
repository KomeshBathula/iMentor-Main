from typing import List, Dict, Any
from rag.embeddings import EmbeddingGenerator
from rag.vector_store import ChromaVectorStore
from utils.logger import logger


class RAGRetriever:
    """
    RAG Retriever combining OpenAI Embeddings and ChromaVectorStore
    for top-k semantic document chunk retrieval.
    """

    def __init__(self, vector_store: ChromaVectorStore = None):
        self.embedding_gen = EmbeddingGenerator()
        self.vector_store = vector_store or ChromaVectorStore()

    async def retrieve(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Embed query and retrieve top-k matching document chunks.
        """
        logger.info(f"[RAGRetriever] Retrieving top {top_k} chunks for query: '{query}'")
        query_vector = await self.embedding_gen.embed_query(query)
        results = await self.vector_store.similarity_search_by_vector(query_vector, k=top_k)
        return results
