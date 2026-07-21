from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter

from utils.logger import logger


class DocumentChunker:
    """
    Document Chunker using RecursiveCharacterTextSplitter for chunking long text
    documents into semantic vector embeddings ready chunks.
    """

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

    def chunk_text(self, text: str, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Splits a text string into chunks and attaches metadata.
        """
        if not text:
            return []

        metadata = metadata or {}
        raw_chunks = self.splitter.split_text(text)

        chunks = []
        for idx, chunk in enumerate(raw_chunks):
            chunk_meta = dict(metadata)
            chunk_meta["chunk_index"] = idx
            chunks.append({
                "content": chunk,
                "metadata": chunk_meta
            })

        logger.info(f"[DocumentChunker] Split text into {len(chunks)} chunks.")
        return chunks
