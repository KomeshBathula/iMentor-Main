# server/rag_service/scholarly_agent.py
"""
Scholarly Agent — Atomic Claim Extraction (Offline Only)

Breaks each markdown source file into discrete, citable propositions with source
attribution.  Each claim is a single self-contained declarative sentence stored
as an independent Qdrant point in `scholarly_claims`.

Payload per point:
  claim         : atomic factual statement
  source_file   : which markdown file it came from (e.g. "R1.md")
  section       : section heading for location context
  course        : course name (lowercase)
  subtopic_ids  : list of subtopic IDs auto-tagged via keyword matching

Enables researcher-facing queries:
  "What does the course material say about gradient descent convergence?"
  → returns ranked claims with source attribution

ZERO LATENCY: all extraction is offline. Query time = Qdrant semantic search.
"""
import hashlib
import json
import logging
import os
import struct
from typing import Dict, List, Optional

import config

logger = logging.getLogger(__name__)

SCHOLARLY_COLLECTION = getattr(config, "SCHOLARLY_QDRANT_COLLECTION", "scholarly_claims")

_SGLANG_ENABLED     = os.getenv("SGLANG_ENABLED", "true").lower() == "true"
_SGLANG_HEAVY_URL   = os.getenv("SGLANG_HEAVY_URL", "http://localhost:8000/v1")
_SGLANG_HEAVY_MODEL = os.getenv("SGLANG_HEAVY_MODEL", "Qwen/Qwen2.5-7B-Instruct-AWQ")

_sglang_client = None
if _SGLANG_ENABLED:
    try:
        from openai import OpenAI
        _sglang_client = OpenAI(base_url=_SGLANG_HEAVY_URL, api_key="EMPTY")
        logger.info("ScholarlyAgent: SGLang client ready.")
    except Exception as _e:
        logger.warning(f"ScholarlyAgent: SGLang init failed: {_e}")

_MAX_SECTION_CHARS = 3000


# =============================================================================
# QDRANT SETUP
# =============================================================================

def setup_scholarly_collection():
    """Create scholarly_claims collection with keyword payload indexes."""
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, VectorParams, PayloadSchemaType

        client = QdrantClient(host=config.QDRANT_HOST, port=config.QDRANT_PORT)

        try:
            client.get_collection(SCHOLARLY_COLLECTION)
        except Exception:
            client.create_collection(
                collection_name=SCHOLARLY_COLLECTION,
                vectors_config=VectorParams(
                    size=config.DOCUMENT_VECTOR_DIMENSION,
                    distance=Distance.COSINE,
                ),
            )
            logger.info(f"Created Qdrant collection: {SCHOLARLY_COLLECTION}")

        for field in ("course", "source_file", "subtopic_ids"):
            try:
                client.create_payload_index(
                    collection_name=SCHOLARLY_COLLECTION,
                    field_name=field,
                    field_schema=PayloadSchemaType.KEYWORD,
                )
            except Exception:
                pass

    except Exception as e:
        logger.error(f"setup_scholarly_collection failed: {e}", exc_info=True)


# =============================================================================
# SECTION SPLITTING
# =============================================================================

def _split_into_sections(md_text: str) -> List[Dict[str, str]]:
    """
    Split markdown into sections by ## / ### headings.
    Returns list of {heading, content} dicts (only non-trivial sections).
    """
    sections: List[Dict[str, str]] = []
    current_heading = "Introduction"
    current_lines: List[str] = []

    for line in md_text.split("\n"):
        if line.startswith("## ") or line.startswith("### "):
            if current_lines:
                sections.append({
                    "heading": current_heading,
                    "content": "\n".join(current_lines).strip(),
                })
                current_lines = []
            current_heading = line.lstrip("#").strip()
        else:
            current_lines.append(line)

    if current_lines:
        sections.append({
            "heading": current_heading,
            "content": "\n".join(current_lines).strip(),
        })

    return [s for s in sections if len(s["content"]) > 100]


# =============================================================================
# CLAIM EXTRACTION
# =============================================================================

_EXTRACT_SYSTEM = (
    "You are a scientific knowledge extractor. "
    "Extract atomic, self-contained factual claims from academic text. "
    "Each claim must be a single declarative sentence, independently verifiable, "
    "and free of pronouns — always use full entity names."
)


def _extract_claims_from_section(section_text: str, section_heading: str) -> List[str]:
    """Extract 5-15 atomic claims from one section via SGLang. Returns list of strings."""
    if not _sglang_client or len(section_text.strip()) < 50:
        return []

    user_prompt = f"""Extract 5–15 atomic factual claims from this academic text section titled "{section_heading}".

Rules:
- Single declarative sentence per claim
- Use full names — no "it", "this", "they" pronouns
- Include mathematical facts, algorithm properties, and theoretical results
- Do NOT include opinions or pedagogical instructions

Text:
{section_text[:_MAX_SECTION_CHARS]}

Output ONLY a JSON array of strings. Example:
["Gradient descent converges to a local minimum for non-convex objectives.", "The learning rate controls the step size in parameter space."]"""

    try:
        resp = _sglang_client.chat.completions.create(
            model=_SGLANG_HEAVY_MODEL,
            messages=[
                {"role": "system", "content": _EXTRACT_SYSTEM},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=1024,
        )
        raw = (resp.choices[0].message.content or "").strip()
        start = raw.find("[")
        end   = raw.rfind("]") + 1
        if start >= 0 and end > start:
            claims = json.loads(raw[start:end])
            if isinstance(claims, list):
                return [c for c in claims if isinstance(c, str) and len(c) > 20]
    except Exception as e:
        logger.debug(f"Claim extraction failed for '{section_heading}': {e}")

    return []


def _tag_subtopics(claim: str, subtopic_map: Dict[str, str]) -> List[str]:
    """
    Auto-tag a claim with relevant subtopic IDs via keyword matching.
    A subtopic matches if ≥2 of its significant keywords appear in the claim.
    subtopic_map: {subtopic_id: subtopic_name}
    """
    claim_lower = claim.lower()
    tagged: List[str] = []
    for sub_id, sub_name in subtopic_map.items():
        keywords = sub_name.lower().replace("_", " ").split()
        significant = [k for k in keywords if len(k) > 3]
        if not significant:
            continue
        matches = sum(1 for k in significant if k in claim_lower)
        if matches >= min(2, len(significant)):
            tagged.append(sub_id)
    return tagged


# =============================================================================
# STORAGE
# =============================================================================

def _claim_point_id(course: str, source_file: str, index: int) -> int:
    """Deterministic Qdrant point ID for a claim."""
    digest = hashlib.md5(f"{course}:{source_file}:{index}".encode()).digest()
    return struct.unpack(">I", digest[:4])[0]


def _get_embed_model():
    try:
        return config.get_embedding_model()
    except Exception:
        return None


def store_claims(course: str, source_file: str, claims_with_meta: List[Dict]) -> int:
    """
    Upsert a list of claim dicts into Qdrant scholarly_claims.
    Each dict must have keys: claim, section, subtopic_ids
    Returns number of claims stored.
    """
    if not claims_with_meta:
        return 0

    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        client = QdrantClient(host=config.QDRANT_HOST, port=config.QDRANT_PORT)
        setup_scholarly_collection()

        embed_model = _get_embed_model()
        points = []

        for idx, item in enumerate(claims_with_meta):
            claim_text = item.get("claim", "")
            if not claim_text:
                continue

            vector = (
                embed_model.encode(claim_text[:512]).tolist()
                if embed_model
                else [0.0] * config.DOCUMENT_VECTOR_DIMENSION
            )

            points.append(PointStruct(
                id=_claim_point_id(course, source_file, idx),
                vector=vector,
                payload={
                    "course":       course.lower(),
                    "source_file":  source_file,
                    "section":      item.get("section", ""),
                    "claim":        claim_text,
                    "subtopic_ids": item.get("subtopic_ids", []),
                },
            ))

        if not points:
            return 0

        stored = 0
        for i in range(0, len(points), 50):
            batch = points[i:i + 50]
            client.upsert(collection_name=SCHOLARLY_COLLECTION, points=batch, wait=True)
            stored += len(batch)

        logger.info(f"ScholarlyAgent: stored {stored} claims from {source_file} ({course})")
        return stored

    except Exception as e:
        logger.error(f"store_claims failed for {course}/{source_file}: {e}", exc_info=True)
        return 0


# =============================================================================
# MAIN EXTRACTION
# =============================================================================

def extract_and_store_claims(
    course: str,
    source_file: str,
    md_text: str,
    subtopic_map: Dict[str, str],
) -> int:
    """
    Extract atomic claims from one markdown file and store in Qdrant.

    Args:
        course       : Course name
        source_file  : Filename (e.g. "R1.md")
        md_text      : Full markdown content of the file
        subtopic_map : {subtopic_id: subtopic_name} for auto-tagging

    Returns: number of claims stored
    """
    sections   = _split_into_sections(md_text)
    all_claims: List[Dict] = []

    for section in sections:
        raw_claims = _extract_claims_from_section(section["content"], section["heading"])
        for claim in raw_claims:
            tagged = _tag_subtopics(claim, subtopic_map)
            all_claims.append({
                "claim":        claim,
                "section":      section["heading"],
                "subtopic_ids": tagged,
            })

    return store_claims(course, source_file, all_claims)


# =============================================================================
# RETRIEVAL
# =============================================================================

def get_claims_for_subtopic(course: str, subtopic_id: str, limit: int = 20) -> List[Dict]:
    """Return all scholarly claims tagged with a specific subtopic."""
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny

        client = QdrantClient(host=config.QDRANT_HOST, port=config.QDRANT_PORT)
        results, _ = client.scroll(
            collection_name=SCHOLARLY_COLLECTION,
            scroll_filter=Filter(must=[
                FieldCondition(key="course",       match=MatchValue(value=course.lower())),
                FieldCondition(key="subtopic_ids", match=MatchAny(any=[subtopic_id])),
            ]),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        return [p.payload for p in results]
    except Exception as e:
        logger.debug(f"get_claims_for_subtopic failed: {e}")
        return []


def search_claims(course: str, query: str, limit: int = 10) -> List[Dict]:
    """Semantic search over scholarly claims for a course."""
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        embed_model = _get_embed_model()
        if not embed_model:
            return []

        client    = QdrantClient(host=config.QDRANT_HOST, port=config.QDRANT_PORT)
        query_vec = embed_model.encode(query[:512]).tolist()

        results = client.search(
            collection_name=SCHOLARLY_COLLECTION,
            query_vector=query_vec,
            query_filter=Filter(must=[
                FieldCondition(key="course", match=MatchValue(value=course.lower())),
            ]),
            limit=limit,
            with_payload=True,
        )
        return [r.payload for r in results]
    except Exception as e:
        logger.debug(f"search_claims failed: {e}")
        return []
