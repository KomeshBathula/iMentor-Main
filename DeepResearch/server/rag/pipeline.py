from typing import List, Dict, Any
from rag.chunker import DocumentChunker
from rag.embeddings import EmbeddingGenerator
from rag.vector_store import ChromaVectorStore
from rag.retriever import RAGRetriever
from rag.reranker import RAGReranker
from utils.logger import logger


class RAGPipeline:
    """
    Unified RAG Pipeline combining chunking, embedding generation,
    vector indexing, retrieval, and reranking.
    """

    def __init__(self, collection_name: str = "deep_research"):
        self.chunker = DocumentChunker()
        self.embedding_gen = EmbeddingGenerator()
        self.vector_store = ChromaVectorStore(collection_name=collection_name)
        self.retriever = RAGRetriever(vector_store=self.vector_store)
        self.reranker = RAGReranker()

    async def ingest_document(self, text: str, metadata: Dict[str, Any] = None) -> List[str]:
        """
        Chunk, embed, and index a document into vector store.
        """
        chunks = self.chunker.chunk_text(text, metadata)
        if not chunks:
            return []

        contents = [c["content"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]

        embeddings = await self.embedding_gen.embed_documents(contents)
        chunk_ids = await self.vector_store.add_texts(contents, embeddings, metadatas)
        logger.info(f"[RAGPipeline] Successfully ingested document into {len(chunk_ids)} vectors.")
        return chunk_ids

    async def query_context(self, query: str, top_k: int = 6, top_n: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieve and rerank top context chunks for a research query.
        """
        retrieved_chunks = await self.retriever.retrieve(query, top_k=top_k)
        reranked_chunks = self.reranker.rerank(query, retrieved_chunks, top_n=top_n)
        return reranked_chunks
