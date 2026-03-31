import uuid
import logging
from typing import List, Dict, Tuple, Optional, Any

from qdrant_client import QdrantClient, models

# Assuming vector_db_service.py and config.py are in the same package directory (e.g., rag_service/)
# and you run your application as a module (e.g., python -m rag_service.main_app)
# or have otherwise correctly set up the Python path.
import config # Changed to relative import

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Document: # For search result formatting
    def __init__(self, page_content: str, metadata: dict):
        self.page_content = page_content
        self.metadata = metadata

    def to_dict(self):
        return {"page_content": self.page_content, "metadata": self.metadata}

class VectorDBService:
    def __init__(self):
        logger.info("Initializing VectorDBService...")
        logger.info(f"  Qdrant Host: {config.QDRANT_HOST}, Port: {config.QDRANT_PORT}, URL: {config.QDRANT_URL}")
        logger.info(f"  Collection: {config.QDRANT_COLLECTION_NAME}")
        logger.info(f"  Query Embedding Model: {config.QUERY_EMBEDDING_MODEL_NAME}")
        
        # The vector dimension for the Qdrant collection is defined by the DOCUMENT embedding model
        # This is set in config.QDRANT_COLLECTION_VECTOR_DIM
        self.vector_dim = config.QDRANT_COLLECTION_VECTOR_DIM
        logger.info(f"  Service expects Vector Dim for Qdrant collection: {self.vector_dim} (from document model config)")

        if config.QDRANT_URL:
            self.client = QdrantClient(
                url=config.QDRANT_URL,
                api_key=config.QDRANT_API_KEY,
                timeout=30
            )
        else:
            self.client = QdrantClient(
                host=config.QDRANT_HOST,
                port=config.QDRANT_PORT,
                api_key=config.QDRANT_API_KEY,
                timeout=30
            )

        try:
            # Use get_embedding_model() which respects EMBED_PROVIDER (ollama or sentence_transformers).
            # OllamaEmbedder routes through Ollama HTTP API — no GPU usage.
            self.model = config.get_embedding_model()
            if self.model is None:
                raise RuntimeError("get_embedding_model() returned None — check EMBED_PROVIDER and model config.")

            # Dimension check: SentenceTransformer has get_sentence_embedding_dimension(), OllamaEmbedder does not.
            if hasattr(self.model, 'get_sentence_embedding_dimension'):
                model_embedding_dim = self.model.get_sentence_embedding_dimension()
                if model_embedding_dim != self.vector_dim:
                    raise ValueError(
                        f"CRITICAL DIMENSION MISMATCH: query model dim={model_embedding_dim} "
                        f"vs Qdrant collection dim={self.vector_dim}."
                    )
                logger.info(f"  Query model loaded (SentenceTransformer). Dim={model_embedding_dim} ✓")
            else:
                # OllamaEmbedder — dimension verified by collection config (mxbai-embed-large = 1024)
                logger.info(f"  Query model loaded (OllamaEmbedder). Dim={self.vector_dim} (from config) ✓")

        except Exception as e:
            logger.error(f"Error initializing query embedding model: {e}", exc_info=True)
            raise  # Re-raise to prevent service startup with a non-functional query encoder
        self.collection_name = config.QDRANT_COLLECTION_NAME
        # No ThreadPoolExecutor needed here if document encoding is external

        # Sparse model for hybrid search (SPLADE/BM25 via fastembed)
        self.sparse_model = config.get_sparse_embedding_model()  # None when HYBRID_SEARCH_ENABLED=false
        if self.sparse_model:
            logger.info("  Hybrid search ENABLED — sparse model loaded ✓")
        else:
            logger.info("  Hybrid search DISABLED — dense-only search active")

        # In-memory LRU cache for query embeddings (avoids recomputing for repeated queries)
        self._encode_cache = {}
        self._encode_cache_order = []
        self._encode_cache_max = 512
        # Sparse query cache
        self._sparse_cache: Dict[str, Any] = {}
        self._sparse_cache_order: List[str] = []
        self._sparse_cache_max = 256

    def _cached_encode(self, text: str) -> list:
        """Return cached embedding for text, computing & caching on miss."""
        if text in self._encode_cache:
            return self._encode_cache[text]
        embedding = self.model.encode(text).tolist()
        self._encode_cache[text] = embedding
        self._encode_cache_order.append(text)
        if len(self._encode_cache_order) > self._encode_cache_max:
            evict = self._encode_cache_order.pop(0)
            self._encode_cache.pop(evict, None)
        return embedding

    def _recreate_qdrant_collection(self):
        logger.info(f"Attempting to (re)create collection '{self.collection_name}' with vector size {self.vector_dim}.")
        try:
            if config.HYBRID_SEARCH_ENABLED:
                # Named vectors: "dense" (cosine) + "sparse" (SPLADE index)
                self.client.recreate_collection(
                    collection_name=self.collection_name,
                    vectors_config={
                        "dense": models.VectorParams(
                            size=self.vector_dim,
                            distance=models.Distance.COSINE,
                        )
                    },
                    sparse_vectors_config={
                        "sparse": models.SparseVectorParams(
                            index=models.SparseIndexParams(on_disk=False)
                        )
                    },
                )
                logger.info(f"Collection '{self.collection_name}' (re)created with hybrid dense+sparse vectors ✓")
            else:
                self.client.recreate_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=self.vector_dim,
                        distance=models.Distance.COSINE,
                    ),
                )
                logger.info(f"Collection '{self.collection_name}' (re)created with dense-only vector ✓")
        except Exception as e_recreate:
            logger.error(f"Failed to (re)create collection '{self.collection_name}': {e_recreate}", exc_info=True)
            raise

    def setup_collection(self):
        try:
            collection_info = self.client.get_collection(collection_name=self.collection_name)
            logger.info(f"Collection '{self.collection_name}' already exists.")

            vectors_cfg = getattr(collection_info.config.params, 'vectors', None)

            if config.HYBRID_SEARCH_ENABLED:
                # Hybrid mode requires named vector config with a "dense" key.
                if isinstance(vectors_cfg, dict) and "dense" in vectors_cfg:
                    dense_cfg = vectors_cfg["dense"]
                    if dense_cfg.size != self.vector_dim:
                        logger.warning(
                            f"Collection '{self.collection_name}' dense dim {dense_cfg.size} != "
                            f"expected {self.vector_dim}. Recreating for hybrid search."
                        )
                        self._recreate_qdrant_collection()
                    else:
                        logger.info(
                            f"Collection '{self.collection_name}' hybrid config compatible "
                            f"(dense dim={dense_cfg.size}) ✓"
                        )
                else:
                    # Existing collection has old unnamed-vector format — must recreate.
                    logger.warning(
                        f"Collection '{self.collection_name}' has legacy (unnamed) vector format. "
                        f"Recreating for hybrid search. NOTE: all documents must be re-ingested."
                    )
                    self._recreate_qdrant_collection()
            else:
                # Legacy dense-only mode
                current_vectors_config = None
                if isinstance(vectors_cfg, models.VectorParams):
                    current_vectors_config = vectors_cfg
                elif isinstance(vectors_cfg, dict):
                    if "" in vectors_cfg:
                        current_vectors_config = vectors_cfg[""]
                    elif "dense" in vectors_cfg:
                        current_vectors_config = vectors_cfg["dense"]
                    elif vectors_cfg:
                        current_vectors_config = next(iter(vectors_cfg.values()))

                if not current_vectors_config:
                    logger.error(f"Could not determine vector config for '{self.collection_name}'. Recreating.")
                    self._recreate_qdrant_collection()
                elif current_vectors_config.size != self.vector_dim:
                    logger.warning(
                        f"Collection '{self.collection_name}' vector size {current_vectors_config.size} "
                        f"differs from expected {self.vector_dim}. Recreating."
                    )
                    self._recreate_qdrant_collection()
                elif current_vectors_config.distance != models.Distance.COSINE:
                    logger.warning(
                        f"Collection '{self.collection_name}' distance {current_vectors_config.distance} "
                        f"differs from expected COSINE. Recreating."
                    )
                    self._recreate_qdrant_collection()
                else:
                    logger.info(
                        f"Collection '{self.collection_name}' dense-only config compatible "
                        f"(size={current_vectors_config.size}) ✓"
                    )

        except Exception as e:
            if "not found" in str(e).lower() or \
               (hasattr(e, 'status_code') and e.status_code == 404) or \
               " ভাগ্যবান" in str(e).lower():
                logger.info(f"Collection '{self.collection_name}' not found. Attempting to create...")
            else:
                logger.warning(
                    f"Error checking collection '{self.collection_name}': {type(e).__name__} - {e}. "
                    f"Attempting to (re)create anyway..."
                )
            self._recreate_qdrant_collection()

    def add_processed_chunks(self, processed_chunks: List[Dict[str, Any]]) -> int:
        if not processed_chunks:
            logger.warning("add_processed_chunks received an empty list. No points to upsert.")
            return 0

        points_to_upsert = []
        doc_name_for_logging = "Unknown Document"

        for chunk_data in processed_chunks:
            point_id = chunk_data.get('id', str(uuid.uuid4()))
            vector = chunk_data.get('embedding')
            
            payload = chunk_data.get('metadata', {}).copy()
            payload['chunk_text_content'] = chunk_data.get('text_content', '')

            if not doc_name_for_logging or doc_name_for_logging == "Unknown Document":
                doc_name_for_logging = payload.get('original_name', payload.get('document_name', "Unknown Document"))

            if not vector:
                logger.warning(f"Chunk with ID '{point_id}' from '{doc_name_for_logging}' is missing 'embedding'. Skipping.")
                continue
            if not isinstance(vector, list) or not all(isinstance(x, (float, int)) for x in vector): # Allow int too, SentenceTransformer can return float32 which might be int-like in lists
                logger.warning(f"Chunk with ID '{point_id}' from '{doc_name_for_logging}' has an invalid 'embedding' format. Skipping.")
                continue
            if len(vector) != self.vector_dim:
                logger.error(f"Chunk with ID '{point_id}' from '{doc_name_for_logging}' has embedding dimension {len(vector)}, "
                             f"but collection expects {self.vector_dim}. Skipping. "
                             f"Ensure ai_core's document embedding model ('{config.DOCUMENT_EMBEDDING_MODEL_NAME}') "
                             f"output dimension matches configuration.")
                continue

            if config.HYBRID_SEARCH_ENABLED and self.sparse_model:
                # Generate sparse (SPLADE) vector for this chunk
                try:
                    text_for_sparse = chunk_data.get('text_content', payload.get('chunk_text_content', ''))
                    sparse_result = self.sparse_model.embed(text_for_sparse)
                    sparse_indices = sparse_result.indices.tolist()
                    sparse_values  = [float(v) for v in sparse_result.values.tolist()]
                    point_vector = {
                        "dense":  [float(v) for v in vector],
                        "sparse": models.SparseVector(indices=sparse_indices, values=sparse_values),
                    }
                except Exception as e_sparse:
                    logger.warning(f"Sparse embedding failed for chunk '{point_id}': {e_sparse}. Storing dense-only.")
                    point_vector = {"dense": [float(v) for v in vector]}
            else:
                point_vector = [float(v) for v in vector]  # legacy unnamed vector

            points_to_upsert.append(models.PointStruct(
                id=point_id,
                vector=point_vector,
                payload=payload
            ))

        if not points_to_upsert:
            logger.warning(f"No valid points constructed from processed_chunks for document: {doc_name_for_logging}.")
            return 0

        # --- BATCH UPSERT TO AVOID PAYLOAD SIZE LIMIT ---
        # Qdrant has a 32MB payload limit per request
        # Upsert in batches to handle large documents
        BATCH_SIZE = 100  # ~100 chunks per batch should stay under limit
        total_upserted = 0
        
        try:
            for i in range(0, len(points_to_upsert), BATCH_SIZE):
                batch = points_to_upsert[i:i + BATCH_SIZE]
                self.client.upsert(collection_name=self.collection_name, points=batch, wait=True)
                total_upserted += len(batch)
                
                if len(points_to_upsert) > BATCH_SIZE:
                    logger.info(f"Upserted batch {i // BATCH_SIZE + 1}/{(len(points_to_upsert) + BATCH_SIZE - 1) // BATCH_SIZE} "
                               f"({len(batch)} points) for {doc_name_for_logging}")
            
            logger.info(f"Successfully upserted {total_upserted} chunks for document: {doc_name_for_logging} into Qdrant.")
            return total_upserted
        except Exception as e:
            logger.error(f"Error upserting processed chunks to Qdrant for document: {doc_name_for_logging}: {e}", exc_info=True)
            raise

    def search_documents(self, query: str, k: int = -1, filter_conditions: Optional[models.Filter] = None, collection_name: Optional[str] = None) -> Tuple[List[Document], str, Dict]:
        # Allow callers to override the collection (e.g. stn_notes, pedagogical_notes)
        _collection = collection_name or self.collection_name
        # Use default k from config if not provided or invalid
        if k <= 0:
            k_to_use = config.QDRANT_DEFAULT_SEARCH_K
        else:
            k_to_use = k

        context_docs = []
        formatted_context_text = "No relevant context was found in the available documents."
        context_docs_map = {}

        logger.info(f"Searching with query (first 50 chars): '{query[:50]}...', k: {k_to_use}")
        if filter_conditions:
            try: filter_dict = filter_conditions.dict()
            except AttributeError: # For older Pydantic versions
                try: filter_dict = filter_conditions.model_dump()
                except AttributeError: filter_dict = str(filter_conditions) # Fallback
            logger.info(f"Applying filter: {filter_dict}")
        else:
            logger.info("No filter applied for search.")

        try:
            query_embedding = self._cached_encode(query)
            logger.debug(f"Generated query_embedding (length: {len(query_embedding)}, first 5 dims: {query_embedding[:5]})")

            if config.HYBRID_SEARCH_ENABLED and self.sparse_model:
                # ── Hybrid search: sparse prefetch + dense prefetch → RRF fusion ──
                if query not in self._sparse_cache:
                    sparse_result = self.sparse_model.embed(query)
                    self._sparse_cache[query] = (
                        sparse_result.indices.tolist(),
                        [float(v) for v in sparse_result.values.tolist()],
                    )
                    self._sparse_cache_order.append(query)
                    if len(self._sparse_cache_order) > self._sparse_cache_max:
                        evict = self._sparse_cache_order.pop(0)
                        self._sparse_cache.pop(evict, None)
                sparse_indices, sparse_values = self._sparse_cache[query]

                prefetch_limit = k_to_use * 3  # over-fetch before RRF re-ranking
                raw_results = self.client.query_points(
                    collection_name=_collection,
                    prefetch=[
                        models.Prefetch(
                            query=models.SparseVector(indices=sparse_indices, values=sparse_values),
                            using="sparse",
                            limit=prefetch_limit,
                            filter=filter_conditions,
                        ),
                        models.Prefetch(
                            query=query_embedding,
                            using="dense",
                            limit=prefetch_limit,
                            filter=filter_conditions,
                        ),
                    ],
                    query=models.FusionQuery(fusion=models.Fusion.RRF),
                    limit=k_to_use,
                    with_payload=True,
                ).points
                # Filter by min score threshold (RRF scores are not cosine-comparable; use a low bar)
                search_results = [
                    p for p in raw_results
                    if p.score >= config.QDRANT_SEARCH_MIN_RELEVANCE_SCORE
                ]
                logger.info(
                    f"Hybrid (RRF) search returned {len(search_results)}/{len(raw_results)} "
                    f"results (after threshold {config.QDRANT_SEARCH_MIN_RELEVANCE_SCORE})."
                )
            else:
                # ── Legacy dense-only search ──
                search_results = self.client.query_points(
                    collection_name=_collection,
                    query=query_embedding,
                    query_filter=filter_conditions,
                    limit=k_to_use,
                    with_payload=True,
                    score_threshold=config.QDRANT_SEARCH_MIN_RELEVANCE_SCORE,
                ).points
                logger.info(f"Dense-only search returned {len(search_results)} results (after score threshold).")


            if not search_results:
                return context_docs, formatted_context_text, context_docs_map

            for idx, point in enumerate(search_results):
                # Score threshold is already applied by Qdrant if score_threshold parameter is used.
                # If not using score_threshold in client.search, uncomment this:
                # if point.score < config.QDRANT_SEARCH_MIN_RELEVANCE_SCORE:
                #     logger.debug(f"Skipping point ID {point.id} with score {point.score:.4f} (below threshold {config.QDRANT_SEARCH_MIN_RELEVANCE_SCORE})")
                #     continue

                payload = point.payload
                content = payload.get("chunk_text_content", payload.get("text_content", payload.get("chunk_text", "")))

                retrieved_metadata = payload.copy()
                retrieved_metadata["qdrant_id"] = point.id
                retrieved_metadata["score"] = point.score

                doc = Document(page_content=content, metadata=retrieved_metadata)
                context_docs.append(doc)

            # Format context and citations
            formatted_context_parts = []
            for i, doc_obj in enumerate(context_docs):
                citation_index = i + 1
                doc_meta = doc_obj.metadata
                # Use more robust fetching of metadata keys
                display_subject = doc_meta.get("title", doc_meta.get("subject", "Unknown Subject")) # Prefer title for subject
                doc_name = doc_meta.get("original_name", doc_meta.get("file_name", "N/A"))
                page_num_info = f" (Page: {doc_meta.get('page_number', 'N/A')})" if doc_meta.get('page_number') else "" # Add page number if available
                
                # --- SYLLABUS CONTEXT FOR RAG RESULTS ---
                syllabus_info = ""
                if doc_meta.get('syllabus_module'):
                    syllabus_info = f" | 📚 {doc_meta['syllabus_module']}"
                    if doc_meta.get('syllabus_topic'):
                        syllabus_info += f" → {doc_meta['syllabus_topic']}"
                    if doc_meta.get('syllabus_lecture_number'):
                        syllabus_info += f" (Lecture {doc_meta['syllabus_lecture_number']})"
                
                content_preview = doc_obj.page_content[:200] + "..." if len(doc_obj.page_content) > 200 else doc_obj.page_content

                formatted = (f"[{citation_index}] Score: {doc_meta.get('score', 0.0):.4f} | "
                             f"Source: {doc_name}{page_num_info}{syllabus_info}\n"
                             f"Content: {content_preview}") # Show content preview
                formatted_context_parts.append(formatted)

                context_docs_map[str(citation_index)] = {
                    "subject": display_subject,
                    "document_name": doc_name,
                    "page_number": doc_meta.get("page_number"),
                    "content_preview": content_preview, # Store preview
                    "full_content": doc_obj.page_content, # Store full content for potential later use
                    "score": doc_meta.get("score", 0.0),
                    "qdrant_id": doc_meta.get("qdrant_id"),
                    # --- SYLLABUS FIELDS ---
                    "syllabus_module": doc_meta.get("syllabus_module"),
                    "syllabus_topic": doc_meta.get("syllabus_topic"),
                    "syllabus_lecture_number": doc_meta.get("syllabus_lecture_number"),
                    "syllabus_context": doc_meta.get("syllabus_context"),
                    "original_metadata": doc_meta # Store all original metadata from payload
                }
            if formatted_context_parts:
                formatted_context_text = "\n\n---\n\n".join(formatted_context_parts)
            else:
                formatted_context_text = "No sufficiently relevant context was found after filtering."

        except Exception as e:
            logger.error(f"Qdrant search/RAG error: {e}", exc_info=True)
            formatted_context_text = "Error retrieving context due to an internal server error."

        return context_docs, formatted_context_text, context_docs_map
    
    # Add this method to the VectorDBService class in vector_db_service.py

    def delete_document_vectors(self, user_id: str, document_name: str) -> Dict[str, Any]:
        logger.info(f"Attempting to delete vectors for document: '{document_name}', user: '{user_id}' from Qdrant collection '{self.collection_name}'.")
        
        # These metadata keys must match what's stored during ingestion from ai_core.py
        # 'processing_user' was the user_id passed to ai_core
        # 'file_name' was the original_name passed to ai_core
        qdrant_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="user_id",
                    match=models.MatchValue(value=user_id)
                ),
                models.FieldCondition(
                    key="file_name",
                    match=models.MatchValue(value=document_name)
                )
            ]
        )
        
        try:
            # Optional: Count points before deleting for logging/confirmation
            # count_response = self.client.count(collection_name=self.collection_name, count_filter=qdrant_filter)
            # num_to_delete = count_response.count
            # logger.info(f"Qdrant: Found {num_to_delete} points matching criteria for document '{document_name}', user '{user_id}'.")

            # if num_to_delete == 0:
            #     logger.info(f"Qdrant: No points found to delete for document '{document_name}', user '{user_id}'.")
            #     return {"success": True, "message": "No matching vectors found in Qdrant to delete.", "deleted_count": 0}

            delete_result = self.client.delete(
                collection_name=self.collection_name,
                points_selector=models.FilterSelector(filter=qdrant_filter),
                wait=True # Make it synchronous
            )
            
            # Check the status of the delete operation
            # delete_result should be an UpdateResult object
            if delete_result.status == models.UpdateStatus.COMPLETED or delete_result.status == models.UpdateStatus.ACKNOWLEDGED:
                # The actual number of deleted points isn't directly returned by filter-based delete.
                # We can infer it was successful if no error.
                # For a precise count, you'd need to list IDs by filter, then delete by IDs.
                logger.info(f"Qdrant delete operation for document '{document_name}', user '{user_id}' acknowledged/completed. Status: {delete_result.status}")
                return {"success": True, "message": f"Qdrant vector deletion for document '{document_name}' completed. Status: {delete_result.status}."}
            else:
                logger.warning(f"Qdrant delete operation for document '{document_name}', user '{user_id}' returned status: {delete_result.status}")
                return {"success": False, "message": f"Qdrant delete operation status: {delete_result.status}"}

        except Exception as e:
            logger.error(f"Error deleting document vectors from Qdrant for document '{document_name}', user '{user_id}': {e}", exc_info=True)
            # Check for specific Qdrant client errors if possible, e.g., if the collection doesn't exist.
            return {"success": False, "message": f"Failed to delete Qdrant vectors: {str(e)}"}

    def close(self):
        logger.info("VectorDBService close called.")
        # No specific resources like ThreadPoolExecutor to release in this version.
        # QdrantClient does not have an explicit close() method in recent versions.
    def unassign_course_from_vectors(self, course_name: str):
        """
        Remove the course name from all points in Qdrant for this course.
        The knowledge (chunks) remain, but are no longer associated with the specific course.
        """
        from qdrant_client import models
        qdrant_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="course_name",
                    match=models.MatchValue(value=course_name)
                )
            ]
        )
        try:
            self.client.set_payload(
                collection_name=self.collection_name,
                payload={"course_name": None},
                points=models.FilterSelector(filter=qdrant_filter),
                wait=True
            )
            logger.info(f"Qdrant: Unassigned course '{course_name}' from all vectors.")
            return True
        except Exception as e:
            logger.error(f"Qdrant: Failed to unassign course '{course_name}': {e}")
            return False
