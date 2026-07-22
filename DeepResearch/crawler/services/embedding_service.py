import httpx
from typing import List
from crawler.config import settings
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class EmbeddingService:
    def __init__(self) -> None:
        self.provider = settings.embedding.provider.lower()
        self.model_name = settings.embedding.model_name
        self.dimension = settings.embedding.dimension

    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
            
        if self.provider == "openai":
            return await self._openai_embeddings(texts)
        
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(self.model_name)
            embeddings = model.encode(texts)
            return embeddings.tolist()
        except ImportError:
            logger.warning("sentence-transformers not installed. Generating dummy vectors for development.")
            import numpy as np
            mock_vecs = []
            for text in texts:
                np.random.seed(sum(ord(c) for c in text) % 2**32)
                vec = np.random.randn(self.dimension).tolist()
                mock_vecs.append(vec)
            return mock_vecs

    async def _openai_embeddings(self, texts: List[str]) -> List[List[float]]:
        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Authorization": f"Bearer {settings.embedding.api_key or ''}",
            "Content-Type": "application/json"
        }
        payload = {
            "input": texts,
            "model": self.model_name
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=20.0)
            if response.status_code != 200:
                raise RuntimeError(f"OpenAI Embeddings returned HTTP {response.status_code}")
            data = response.json()
            return [item["embedding"] for item in data["data"]]
