"""
Per-concept lecture note generator.
Mirrors the SubtopicNotes pattern in subtopic_notes_generator.py but
extended for lecture output: richer prose, LaTeX math, and Mermaid diagrams.
All generation goes through SGLang. No Ollama.
"""
import json
import logging
import os
from typing import List, Optional
from pydantic import BaseModel, Field

# Optional Redis STN cache lookup (reads existing Subtopic Teaching Notes)
# This is best-effort — if Redis is unavailable the note is generated fresh
try:
    import redis as _redis_lib
    _redis_client = _redis_lib.Redis(
        host=os.environ.get("REDIS_HOST", "localhost"),
        port=int(os.environ.get("REDIS_PORT", 6379)),
        db=0,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
    )
    _redis_client.ping()
    _REDIS_OK = True
except Exception:
    _redis_client = None
    _REDIS_OK = False

from lecture_generator import sglang_client
from lecture_generator.config import NOTE_PARAMS, SCHEMA_PARAMS, DIAGRAM_PARAMS
from lecture_generator.concept_extractor import Concept, KnowledgeGraph

logger = logging.getLogger(__name__)


# ── Pydantic output schemas ────────────────────────────────────────────

class MathFormula(BaseModel):
    label: str   = Field(description="Name of the formula or equation")
    latex: str   = Field(description="Full LaTeX string (no surrounding $$ — those are added at render time)")
    meaning: str = Field(description="Plain-English explanation of what each term represents")

class MathBlock(BaseModel):
    has_math: bool
    formulas: List[MathFormula] = Field(default_factory=list)

class Example(BaseModel):
    title:   str = Field(description="Short example title")
    content: str = Field(description="Step-by-step worked example in markdown")

class ConceptNote(BaseModel):
    concept:         str        = Field(description="Concept name")
    definition:      str        = Field(description="Precise 2-3 sentence definition")
    intuition:       str        = Field(description="2-3 paragraph explanation building intuition; use analogies")
    math:            MathBlock
    mermaid_diagram: str        = Field(description="Valid mermaid diagram code (no ```mermaid fences); empty string if not applicable")
    mermaid_caption: str        = Field(description="One-sentence caption for the diagram")
    examples:        List[Example]
    key_takeaways:   List[str]  = Field(description="3-5 bullet points the student must remember")
    misconceptions:  List[str]  = Field(description="2-3 common wrong beliefs with brief correction")
    connections:     List[str]  = Field(description="Related concept labels this concept links to")


_NOTE_SYSTEM = (
    "You are a world-class university professor writing detailed lecture notes. "
    "Write clearly, use precise language, and include mathematical rigour where appropriate. "
    "Output valid JSON only."
)

_DIAGRAM_SYSTEM = (
    "You are a technical diagram expert. "
    "Generate clean, correct Mermaid diagram code. "
    "Return ONLY the raw mermaid code — no fences, no explanation."
)


def _note_prompt(
    concept: Concept,
    topic: str,
    all_labels: List[str],
    grounding_context: str = "",
) -> str:
    prereqs = ", ".join(concept.prerequisites) if concept.prerequisites else "none"
    related = ", ".join(l for l in all_labels if l != concept.label)

    source_block = ""
    if grounding_context:
        source_block = f"""
COURSE SOURCE MATERIAL (use this to ground your notes in actual lecture content):
{grounding_context}
--- END OF SOURCE MATERIAL ---
"""

    return f"""Write comprehensive lecture notes for this concept:

Concept: {concept.label}
In the context of: {topic}
Description: {concept.description}
Importance: {concept.importance}
Prerequisites: {prereqs}
Related concepts in this course: {related}
Involves math: {concept.has_math}
{source_block}
Requirements:
- definition: precise and complete (aligned with source material if provided)
- intuition: build mental model, use analogies, 2-3 paragraphs
- math: include all relevant formulas in LaTeX if has_math=true
- mermaid_diagram: create ONE diagram that best illustrates this concept's structure or process
  (use flowchart LR, graph TD, sequenceDiagram, or classDiagram as appropriate)
  If no diagram adds value, set mermaid_diagram to empty string
- examples: 1-2 concrete worked examples (prefer examples from source material if available)
- key_takeaways: what a student must leave knowing
- misconceptions: common wrong beliefs with corrections"""


def _diagram_prompt(concept_label: str, concept_desc: str, diagram_type: str = "auto") -> str:
    return f"""Create a Mermaid diagram that clearly illustrates: "{concept_label}"

Description: {concept_desc}
Diagram type hint: {diagram_type} (use the most appropriate type)

Rules:
- Use flowchart LR, graph TD, sequenceDiagram, classDiagram, or stateDiagram
- Keep it concise (≤15 nodes)
- Node labels must be ≤5 words
- Return ONLY the mermaid code — no ```fences, no explanation"""


# ── Standalone mermaid generation (for extra precision) ───────────────

def _generate_mermaid(concept: Concept) -> str:
    """
    Ask SGLang for a mermaid diagram separately (plain text, not JSON).
    Used as a fallback if the structured note has an empty/invalid diagram.
    """
    if not concept.has_math and concept.importance == "detail":
        return ""
    raw = sglang_client.generate(
        system=_DIAGRAM_SYSTEM,
        user=_diagram_prompt(concept.label, concept.description),
        params=DIAGRAM_PARAMS,
    )
    if not raw:
        return ""
    # Strip any accidental fences the model added
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return raw.strip()


# ── STN cache lookup ───────────────────────────────────────────────────

def _load_stn_from_cache(course: str, concept_label: str) -> str:
    """
    Try to load existing STN teaching_context from Redis for this concept.
    Returns the teaching_context string, or "" if not found.
    Cache key matches server/rag_service/subtopic_notes_generator.py format.
    """
    if not _REDIS_OK or not _redis_client:
        return ""
    subtopic_id = concept_label.lower().replace(" ", "_").replace("/", "_")
    cache_key = f"subtopic_notes:{course.lower()}:{subtopic_id}"
    try:
        raw = _redis_client.get(cache_key)
        if raw:
            data = json.loads(raw)
            tc = data.get("teaching_context", "")
            if tc:
                logger.debug("STN cache hit for concept: %s", concept_label)
                return tc
    except Exception as exc:
        logger.debug("STN Redis lookup failed for %s: %s", concept_label, exc)
    return ""


# ── Public API ─────────────────────────────────────────────────────────

def generate_concept_note(
    concept: Concept,
    topic: str,
    all_labels: List[str],
    grounding_context: str = "",
) -> Optional[ConceptNote]:
    """Generate a full ConceptNote for one concept using SGLang.
    Enriches grounding_context with any existing STN teaching_context from Redis."""
    # Enrich grounding with existing STN (if Redis has it from a prior offline job run)
    stn_context = _load_stn_from_cache(topic, concept.label)
    if stn_context:
        grounding_context = (
            f"EXISTING TEACHING NOTES (from course offline pipeline):\n{stn_context}\n\n"
            + grounding_context
        ) if grounding_context else (
            f"EXISTING TEACHING NOTES (from course offline pipeline):\n{stn_context}"
        )

    raw = sglang_client.generate_structured(
        system=_NOTE_SYSTEM,
        user=_note_prompt(concept, topic, all_labels, grounding_context),
        schema_model=ConceptNote,
        schema_name="concept_note_schema",
        params=NOTE_PARAMS,
    )
    if raw is None:
        logger.warning("Note generation failed for concept: %s", concept.label)
        return None

    try:
        note = ConceptNote.model_validate(raw)
        # If mermaid is empty for a core/supporting concept, generate separately
        if not note.mermaid_diagram and concept.importance in ("core", "supporting"):
            note.mermaid_diagram = _generate_mermaid(concept)
        return note
    except Exception as exc:
        logger.error("ConceptNote validation failed for '%s': %s", concept.label, exc)
        return None


def generate_all_notes(
    kg: KnowledgeGraph,
    coverage: Optional[dict] = None,   # concept_id → ConceptCoverage
) -> List[tuple]:
    """
    Generate notes for every concept in the knowledge graph.
    Returns list of (Concept, ConceptNote | None) in traversal order.
    Core concepts first, then supporting, then detail.

    If coverage is provided (from concept_tracker.track_coverage), each note
    is grounded in the actual lecture excerpts for that concept.
    """
    all_labels = [c.label for c in kg.concepts]

    # Order: core → supporting → detail
    ordered = sorted(
        kg.concepts,
        key=lambda c: {"core": 0, "supporting": 1, "detail": 2}.get(c.importance, 1),
    )

    results = []
    for i, concept in enumerate(ordered, 1):
        grounding = ""
        source_tag = ""
        if coverage and concept.id in coverage:
            cov = coverage[concept.id]
            grounding = cov.grounding_context()
            if cov.lecture_indices:
                source_tag = f" [grounded: {cov.lecture_label}]"

        logger.info(
            "[%d/%d] Generating notes for: %s (%s)%s",
            i, len(ordered), concept.label, concept.importance, source_tag,
        )
        note = generate_concept_note(concept, kg.title, all_labels, grounding)
        results.append((concept, note))

    return results
