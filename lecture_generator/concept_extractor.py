"""
Concept graph extractor.
Uses SGLang constrained JSON generation (Pydantic schema) to extract
a knowledge graph from a topic string or raw document text.
Same pattern as skill_tree_generator.py.
"""
import logging
from typing import List, Optional, TYPE_CHECKING
from pydantic import BaseModel, Field

from lecture_generator import sglang_client
from lecture_generator.config import SCHEMA_PARAMS

if TYPE_CHECKING:
    from lecture_generator.syllabus_loader import Syllabus

logger = logging.getLogger(__name__)

# ── Pydantic schemas (constrain SGLang output) ─────────────────────────

class Concept(BaseModel):
    id: str = Field(description="Short unique identifier e.g. 'c1', 'backprop'")
    label: str = Field(description="Human-readable concept name (≤6 words)")
    description: str = Field(description="2-3 sentence definition")
    importance: str = Field(description="One of: core | supporting | detail")
    has_math: bool = Field(description="True if this concept involves equations or formulas")
    prerequisites: List[str] = Field(description="List of concept IDs this one depends on")

class Relationship(BaseModel):
    source: str = Field(description="concept id of the source node")
    target: str = Field(description="concept id of the target node")
    rel_type: str = Field(
        description="One of: requires | leads_to | part_of | example_of | contrasts_with | generalizes"
    )
    label: str = Field(description="Short edge label (≤4 words)")

class KnowledgeGraph(BaseModel):
    title: str
    summary: str = Field(description="2-3 sentence overview of the topic")
    learning_objectives: List[str] = Field(
        description="3-5 measurable learning objectives starting with action verbs"
    )
    concepts: List[Concept] = Field(description="8-20 key concepts")
    relationships: List[Relationship] = Field(description="Edges connecting concepts")


_SYSTEM = (
    "You are an expert curriculum designer and knowledge engineer. "
    "You build precise, well-structured knowledge graphs from educational topics. "
    "Always output valid JSON."
)


def _build_prompt(
    topic: str,
    source_text: str = "",
    syllabus: "Optional[Syllabus]" = None,
) -> str:
    # Syllabus block — authoritative course blueprint
    if syllabus:
        syllabus_block = (
            f"\n\n{syllabus.to_prompt_block()}\n"
            f"\nIMPORTANT: Follow the Module→Lecture→Topic→Subtopics hierarchy above. "
            f"Every lecture topic should produce at least one concept. "
            f"Subtopics within a topic become 'supporting' or 'detail' concepts.\n"
        )
        concept_count_hint = (
            f"\n- Target {syllabus.concept_count_hint()} concepts total, "
            f"distributed across all {len(syllabus.entries)} lectures."
        )
    else:
        syllabus_block = ""
        concept_count_hint = (
            "\n- This is a MULTI-LECTURE course. Include ALL major concepts across all provided lectures."
            "\n- Scale concept count to coverage: 10-30 concepts for a full course."
            if source_text and "LECTURE " in source_text
            else "\n- 8-20 concepts total for a single lecture."
        )

    # Source material block (lecture text excerpts)
    context = (
        f"\n\nSource material (use this to ground concept descriptions):\n{source_text[:4000]}"
        if source_text else ""
    )

    return f"""Build a knowledge graph for a university-level course on: "{topic}"{syllabus_block}{context}

Rules:
- 'core' concepts are essential (students must understand these)
- 'supporting' concepts aid understanding but aren't primary
- 'detail' concepts are advanced / optional depth
- prerequisites must reference valid concept IDs within your list
- relationships must reference valid concept IDs
- has_math: true if the concept involves any equations, proofs, or formal notation
- Keep concept labels concise (≤ 6 words){concept_count_hint}"""


# ── Public API ─────────────────────────────────────────────────────────

def extract_knowledge_graph(
    topic: str,
    source_text: str = "",
    syllabus: "Optional[Syllabus]" = None,
) -> Optional[KnowledgeGraph]:
    """
    Call SGLang to extract a structured knowledge graph from a topic.
    Returns a validated KnowledgeGraph Pydantic model, or None on failure.
    """
    raw = sglang_client.generate_structured(
        system=_SYSTEM,
        user=_build_prompt(topic, source_text, syllabus=syllabus),
        schema_model=KnowledgeGraph,
        schema_name="knowledge_graph_schema",
        params=SCHEMA_PARAMS,
    )
    if raw is None:
        logger.error("Failed to extract knowledge graph for topic: %s", topic)
        return None

    try:
        # Pydantic validation on the returned dict
        kg = KnowledgeGraph.model_validate(raw)
        logger.info(
            "Knowledge graph extracted: %d concepts, %d relationships",
            len(kg.concepts), len(kg.relationships),
        )
        return kg
    except Exception as exc:
        logger.error("KnowledgeGraph validation failed: %s\nRaw: %s", exc, raw)
        return None
