from neo4j import GraphDatabase
from crawler.models.document import Document
from crawler.models.chunk import Chunk
from crawler.config import settings
from crawler.logger import setup_logger

logger = setup_logger(__name__)

class Neo4jStorage:
    def __init__(self) -> None:
        self.driver = GraphDatabase.driver(
            settings.storage.neo4j_uri,
            auth=(settings.storage.neo4j_username, settings.storage.neo4j_password)
        )

    def close(self) -> None:
        self.driver.close()

    def save_document_graph(self, doc: Document, chunks: list[Chunk], outgoing_links: list[str]) -> None:
        try:
            with self.driver.session() as session:
                session.run(
                    "MERGE (d:Document {id: $id}) "
                    "SET d.url = $url, d.title = $title, d.crawled_at = $crawled_at",
                    id=doc.id,
                    url=doc.metadata.source_url,
                    title=doc.metadata.title,
                    crawled_at=str(doc.metadata.crawled_at)
                )
                
                for ch in chunks:
                    session.run(
                        "MERGE (c:Chunk {id: $id}) "
                        "SET c.text = $text, c.index = $index "
                        "WITH c "
                        "MATCH (d:Document {id: $doc_id}) "
                        "MERGE (d)-[:HAS_CHUNK]->(c)",
                        id=ch.id,
                        text=ch.text[:100],
                        index=ch.chunk_index,
                        doc_id=doc.id
                    )
                    
                for link in outgoing_links:
                    session.run(
                        "MERGE (target:Document {url: $target_url}) "
                        "WITH target "
                        "MATCH (d:Document {id: $doc_id}) "
                        "MERGE (d)-[:LINKS_TO]->(target)",
                        target_url=link,
                        doc_id=doc.id
                    )
        except Exception as e:
            logger.error(f"Neo4j save graph error: {e}")
