from typing import List
from langchain_openai import OpenAIEmbeddings

from config import settings
from utils.logger import logger


class EmbeddingGenerator:
    """
    OpenAI Vector Embedding Generator wrapper.
    Generates dense vector representations for text chunks and search queries.
    """

    def __init__(self, model_name: str = None):
        self.embeddings = OpenAIEmbeddings(
            model=model_name or settings.OPENAI_EMBEDDING_MODEL,
            api_key=settings.OPENAI_API_KEY
        )

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Embed multiple document text strings.
        """
        if not texts:
            return []
        logger.info(f"[EmbeddingGenerator] Embedding {len(texts)} text chunks.")
        return await self.embeddings.aembed_documents(texts)

    async def embed_query(self, query: str) -> List[float]:
        """
        Embed a single search query string.
        """
        return await self.embeddings.aembed_query(query)
