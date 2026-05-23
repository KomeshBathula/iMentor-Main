import os
import time
import re
import logging
import asyncio
from typing import List, Dict, Any
import neo4j_handler
def execute_query(query, parameters=None):
    with neo4j_handler.get_driver_instance().session(database=neo4j_handler.config.NEO4J_DATABASE) as session:
        return [record.data() for record in session.run(query, parameters or {})]
import ai_core 

logger = logging.getLogger(__name__)

# ─── Startup: verify the full-text index exists ─────────────────────────────
def verify_fulltext_index(index_name: str = "node_search_index") -> bool:
    """
    Checks that the Neo4j full-text index used by GraphRAG exists.
    Logs a clear warning if missing — avoids silent query failures at runtime.
    Call once at service startup (see app.py lifespan or startup_event).
    """
    try:
        results = execute_query("SHOW INDEXES YIELD name, type WHERE type = 'FULLTEXT' RETURN name")
        existing = {r["name"] for r in results}
        if index_name in existing:
            logger.info(f"[GraphRAG] Full-text index '{index_name}' verified ✓")
            return True
        else:
            logger.warning(
                f"[GraphRAG] Full-text index '{index_name}' NOT FOUND. "
                f"Graph search will return empty results. "
                f"Create it with: CALL db.index.fulltext.createNodeIndex('{index_name}', "
                f"['KnowledgeNode'], ['nodeId', 'description'])"
            )
            return False
    except Exception as e:
        logger.warning(f"[GraphRAG] Could not verify index '{index_name}': {e}")
        return False

async def extract_and_store_graph(text: str, document_name: str, user_id: str):
    """
    Extracts entities and relationships from text using an LLM and stores them in Neo4j.
    """
    try:
        # 1. Use existing AI Core function or new logic to get triples
        # We assume ai_core has a method or we define a prompt here.
        # For this "Advanced" implementation, let's use a specialized prompt.
        
        prompt = f"""
        Analyze the following text and extract a Knowledge Graph.
        Return a JSON object with 'nodes' (list of {{id, label, properties}}) and 'edges' (list of {{source, target, label, properties}}).
        Focus on key concepts, people, main events, and their relationships.
        
        Text:
        {text[:4000]}... (truncated)
        """
        
        # We'll use the existing LLM wrapper from app.py (but we need to import it or pass it)
        # Better: use ai_core.generate_structured_output if available, or just raw genai.
        
        # Since we are inside a module, let's use ai_core's helper if possible.
        # Looking at file list, 'knowledge_graph_generator.py' exists. Let's see if we can leverage it.
        # But per plan, we are writing `graph_rag.py`.
        
        # Let's assume we use a simplified version for this demo that calls the LLM.
        # We will need the `llm_wrapper` from app context or `ai_core`.
        
        # For now, let's mock the extraction to ensure the PIPELINE works, 
        # as we can't easily import `app.llm_wrapper` due to circular imports.
        # We should use `ai_core.generate_text` or similar.
        
        logger.info(f"Extracting graph for {document_name}...")
        
        # Placeholder for actual LLM call:
        # extraction_result = await ai_core.llm_extract_graph(text) 
        
        # In a real implementation, we would call the LLM here.
        # For the competition "Wow" factor, we need real data. 
        # Let's use `knowledge_graph_generator` which likely already does this.
        
        from knowledge_graph_generator import generate_graph_from_text
        from subtopic_notes_generator import _call_llm as _stn_llm

        def _llm_fn(prompt: str) -> str:
            return _stn_llm(prompt) or ""

        graph_data = generate_graph_from_text(text, _llm_fn)
        
        if graph_data:
            nodes = graph_data.get('nodes', [])
            edges = graph_data.get('edges', [])
            
            # Store in Neo4j
            neo4j_handler.ingest_knowledge_graph(user_id, document_name, nodes, edges)
            logger.info(f"Graph stored: {len(nodes)} nodes, {len(edges)} edges.")
            return True
        return False

    except Exception as e:
        logger.error(f"Graph extraction failed: {e}")
        return False

def graph_search_query(query: str, user_id: str, document_context: str = None) -> str:
    """
    Performs a graph traversal search (GraphRAG) using the fulltext index.
    
    1. Extract keywords from the query.
    2. Search KnowledgeNode via fulltext index (node_search_index).
    3. Traverse 1-2 hops with userId filter on neighbors.
    4. Return structured facts.
    """
    _t0 = time.perf_counter()
    
    def _escape_lucene(query: str) -> str:
        # Special Lucene characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
        escaped = re.sub(r'([+\-&|!(){}\[\]^"~*?:\\/])', r'\\\1', query)
        escaped = re.sub(r'\s+(OR|AND|NOT)$', '', escaped, flags=re.IGNORECASE)
        return escaped.strip()

    try:
        # Build Lucene-compatible search string from query keywords
        keywords = [w for w in query.split() if len(w) > 3]
        if not keywords:
            return "No specific keywords found for graph search."

        search_term = " OR ".join(keywords)

        if document_context:
            cypher = """
            CALL db.index.fulltext.queryNodes("node_search_index", $search_term) YIELD node, score
            WHERE node.userId = $userId AND toLower(node.documentName) = toLower($documentName)
            WITH node, score ORDER BY score DESC LIMIT 5
            OPTIONAL MATCH (node)-[r:RELATED_TO]-(neighbor)
            WHERE neighbor.userId = $userId AND toLower(neighbor.documentName) = toLower($documentName)
            RETURN node.nodeId AS nodeId, node.description AS description,
                   COLLECT(DISTINCT { relationship: r.type, neighborId: neighbor.nodeId }) AS relations
            """
            params = {"search_term": _escape_lucene(search_term), "userId": user_id, "documentName": document_context}
        else:
            cypher = """
            CALL db.index.fulltext.queryNodes("node_search_index", $search_term) YIELD node, score
            WHERE node.userId = $userId
            WITH node, score ORDER BY score DESC LIMIT 5
            OPTIONAL MATCH (node)-[r:RELATED_TO]-(neighbor)
            WHERE neighbor.userId = $userId
            RETURN node.nodeId AS nodeId, node.description AS description,
                   COLLECT(DISTINCT { relationship: r.type, neighborId: neighbor.nodeId }) AS relations
            """
            params = {"search_term": _escape_lucene(search_term), "userId": user_id}

        results = execute_query(cypher, params)

        if not results:
            _elapsed = (time.perf_counter() - _t0) * 1000
            logger.debug(f"[GraphRAG] query took {_elapsed:.1f}ms — no results")
            return "No relevant graph connections found for this query."

        # Format results into natural language facts
        facts = []
        for record in results:
            fact = f"- Concept '{record['nodeId']}': {record.get('description', 'N/A')}"
            relations = [
                f"is '{rel['relationship']}' '{rel['neighborId']}'"
                for rel in record.get('relations', [])
                if rel.get('relationship') and rel.get('neighborId')
            ]
            if relations:
                fact += f" | It {', '.join(relations)}."
            facts.append(fact)

        _elapsed = (time.perf_counter() - _t0) * 1000
        logger.debug(f"[GraphRAG] query took {_elapsed:.1f}ms — {len(results)} nodes returned")
        return "Facts from Knowledge Graph:\n" + "\n".join(facts)

    except Exception as e:
        _elapsed = (time.perf_counter() - _t0) * 1000
        logger.error(f"[GraphRAG] search error after {_elapsed:.1f}ms: {e}")
        return f"Graph search failed: {e}"
