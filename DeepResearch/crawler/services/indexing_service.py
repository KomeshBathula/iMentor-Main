from typing import List, Optional
from crawler.models.document import Document
from crawler.models.chunk import Chunk
from crawler.processors.tokenizer import Tokenizer
from crawler.processors.chunker import RecursiveTextChunker
from crawler.services.embedding_service import EmbeddingService
from crawler.storage.filesystem import FileSystemStorage
from crawler.storage.mongodb import MongoDBStorage
from crawler.storage.qdrant import QdrantStorage
from crawler.storage.elasticsearch import ElasticsearchStorage
from crawler.storage.neo4j import Neo4jStorage
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class IndexingService:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        filesystem: FileSystemStorage,
        mongodb: Optional[MongoDBStorage] = None,
        qdrant: Optional[QdrantStorage] = None,
        elasticsearch: Optional[ElasticsearchStorage] = None,
        neo4j: Optional[Neo4jStorage] = None
    ) -> None:
        self.embedding_service = embedding_service
        self.fs = filesystem
        self.mongodb = mongodb
        self.qdrant = qdrant
        self.elasticsearch = elasticsearch
        self.neo4j = neo4j
        
        self.tokenizer = Tokenizer()
        self.chunker = RecursiveTextChunker(self.tokenizer)

    async def index_document(self, doc: Document, outgoing_links: Optional[List[str]] = None) -> List[Chunk]:
        self.fs.save_document(doc)
        if self.mongodb:
            self.mongodb.save_document(doc)
        if self.elasticsearch:
            self.elasticsearch.save_document(doc)

        chunks = self.chunker.chunk(doc.id, doc.content)
        
        chunk_texts = [ch.text for ch in chunks]
        embeddings = await self.embedding_service.generate_embeddings(chunk_texts)
        for ch, emb in zip(chunks, embeddings):
            ch.embedding = emb

        self.fs.save_chunks(chunks)
        if self.mongodb:
            self.mongodb.save_chunks(chunks)
        if self.elasticsearch:
            self.elasticsearch.save_chunks(chunks)
        if self.qdrant:
            self.qdrant.save_chunks(chunks)

        if self.neo4j:
            self.neo4j.save_document_graph(doc, chunks, outgoing_links or [])

        logger.info(f"Successfully indexed document {doc.id} with {len(chunks)} chunks.")
        return chunks
