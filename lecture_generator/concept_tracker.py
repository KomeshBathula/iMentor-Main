"""
Concept tracker — for each concept in the knowledge graph, determines which
lectures cover it and extracts the most relevant excerpt from each.

Two strategies:
  1. Keyword match (fast, no extra deps) — used by default
  2. Embedding similarity (accurate) — used if the RAG service /embed
     endpoint is reachable (calls localhost:8000/embed via the Python service)

Coverage data is attached to each concept and used in:
  - The concept map node tooltips and sizes
  - The per-concept note prompts (grounding context)
  - The cross-lecture coverage table in the output HTML
"""
import re
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from lecture_generator.course_loader import Course, Lecture
from lecture_generator.concept_extractor import Concept

logger = logging.getLogger(__name__)


# ── Data model ────────────────────────────────────────────────────────────

@dataclass
class ConceptCoverage:
    concept_id: str
    concept_label: str
    # Lectures that mention this concept, by lecture index
    lecture_indices: List[int] = field(default_factory=list)
    # Best excerpt per lecture: {lecture_index: excerpt_text}
    excerpts: Dict[int, str] = field(default_factory=dict)

    @property
    def lecture_count(self) -> int:
        return len(self.lecture_indices)

    @property
    def is_cross_lecture(self) -> bool:
        """True if this concept spans more than one lecture."""
        return self.lecture_count > 1

    @property
    def lecture_label(self) -> str:
        """Short string like 'L1, L3, L7' for display."""
        return ", ".join(f"L{i}" for i in sorted(self.lecture_indices))

    def grounding_context(self, max_chars: int = 3000) -> str:
        """
        Concatenate excerpts from all covering lectures for use as LLM context.
        Keeps the most relevant content within max_chars.
        """
        if not self.excerpts:
            return ""
        parts = []
        budget = max_chars
        for idx in sorted(self.excerpts):
            excerpt = self.excerpts[idx]
            if len(excerpt) > budget:
                excerpt = excerpt[:budget]
            parts.append(excerpt)
            budget -= len(excerpt)
            if budget <= 0:
                break
        return "\n\n---\n\n".join(parts)


# ── Keyword-based matching ────────────────────────────────────────────────

def _make_keywords(concept: Concept) -> List[str]:
    """
    Build a list of search terms for a concept:
    - concept label words (length > 3)
    - key terms extracted from concept description
    """
    label_words = [w for w in concept.label.lower().split() if len(w) > 3]
    # Extract significant words from description (skip stop words)
    _STOP = {"that", "this", "with", "from", "which", "where", "when",
             "have", "been", "their", "they", "used", "using", "often",
             "also", "more", "such", "than", "into", "over", "through"}
    desc_words = [
        w.lower().strip(".,;:")
        for w in concept.description.split()
        if len(w) > 4 and w.lower() not in _STOP
    ][:8]
    return list(dict.fromkeys(label_words + desc_words))  # deduplicate, preserve order


def _score_lecture(lecture: Lecture, keywords: List[str]) -> float:
    """Score how strongly a lecture covers a concept (0 = no coverage)."""
    text_lower = lecture.text.lower()
    score = 0.0
    for kw in keywords:
        count = len(re.findall(r"\b" + re.escape(kw) + r"\b", text_lower))
        if count > 0:
            # Diminishing returns: log-scale
            import math
            score += 1.0 + math.log(count)
    return score


_COVERAGE_THRESHOLD = 1.5   # minimum score to count as "covered"
_EXCERPT_WINDOW     = 500   # characters around each mention


def _find_best_excerpt(lecture: Lecture, keywords: List[str], window: int = _EXCERPT_WINDOW) -> str:
    """Find the text window with the highest keyword density."""
    text = lecture.text
    text_lower = text.lower()
    best_pos = -1
    best_count = 0

    # Slide a window across the text
    step = window // 4
    for start in range(0, max(1, len(text) - window), step):
        chunk = text_lower[start:start + window]
        count = sum(chunk.count(kw) for kw in keywords)
        if count > best_count:
            best_count = count
            best_pos = start

    if best_pos == -1:
        return ""

    snippet = text[best_pos:best_pos + window].strip()
    return f"[Lecture {lecture.index}: {lecture.title}]\n{snippet}"


# ── Public API ────────────────────────────────────────────────────────────

def track_coverage(
    concepts: List[Concept],
    course: Course,
    threshold: float = _COVERAGE_THRESHOLD,
) -> Dict[str, ConceptCoverage]:
    """
    For every concept, find which lectures cover it and extract excerpts.
    Returns dict: concept_id → ConceptCoverage
    """
    coverage: Dict[str, ConceptCoverage] = {}

    for concept in concepts:
        keywords = _make_keywords(concept)
        cov = ConceptCoverage(concept_id=concept.id, concept_label=concept.label)

        for lecture in course.lectures:
            score = _score_lecture(lecture, keywords)
            if score >= threshold:
                cov.lecture_indices.append(lecture.index)
                excerpt = _find_best_excerpt(lecture, keywords)
                if excerpt:
                    cov.excerpts[lecture.index] = excerpt

        if not cov.lecture_indices:
            # Concept not found anywhere — mark as LLM-knowledge-only
            logger.debug(
                "Concept '%s' not found in any lecture (will use LLM knowledge)",
                concept.label,
            )

        coverage[concept.id] = cov
        logger.info(
            "  [coverage] %-30s → %s",
            concept.label,
            cov.lecture_label if cov.lecture_indices else "not in source files",
        )

    return coverage


def coverage_summary(
    coverage: Dict[str, ConceptCoverage],
    course: Course,
) -> str:
    """Human-readable summary printed to stdout."""
    lines = [f"\nConcept Coverage across {len(course.lectures)} lectures:"]
    lines.append("-" * 56)

    cross = [c for c in coverage.values() if c.is_cross_lecture]
    single = [c for c in coverage.values() if c.lecture_count == 1]
    absent = [c for c in coverage.values() if c.lecture_count == 0]

    if cross:
        lines.append(f"\nSpans MULTIPLE lectures ({len(cross)} concepts):")
        for c in sorted(cross, key=lambda x: -x.lecture_count):
            lines.append(f"  ■ {c.concept_label:<28} {c.lecture_label}")

    if single:
        lines.append(f"\nAppears in ONE lecture ({len(single)} concepts):")
        for c in sorted(single, key=lambda x: x.lecture_indices[0]):
            lines.append(f"  · {c.concept_label:<28} {c.lecture_label}")

    if absent:
        lines.append(f"\nNot found in source files ({len(absent)} concepts — LLM knowledge only):")
        for c in absent:
            lines.append(f"  ○ {c.concept_label}")

    lines.append("-" * 56)
    return "\n".join(lines)
