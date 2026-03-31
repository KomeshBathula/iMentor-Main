# server/rag_service/socratic_precompute.py
"""
Pre-computes Socratic learning content for known curriculum topics so the
first user message gets an instant response instead of waiting for LLM generation.

For each topic the pre-computer generates and caches:
  - intro_summary : 2-3 sentence topic introduction
  - questions     : dict with keys easy / medium / hard / expert
                    each key → list of 3 Socratic questions + expected answer nature

Cache key  : "socratic_precompute:{course}:{topic_id}"
Cache TTL  : 7 days (content is stable once curriculum is set)
"""

import json
import logging
import threading
import time
import urllib.request
from typing import Dict, List, Optional

import config

logger = logging.getLogger(__name__)

# ── Redis cache ──────────────────────────────────────────────────────────────
try:
    from cache_service import cache_service as _redis
    _REDIS_OK = True
except Exception:
    _redis = None
    _REDIS_OK = False
    logger.warning("socratic_precompute: Redis not available — precomputed content will not be cached.")

_CACHE_TTL = 7 * 24 * 3600   # 7 days

# ── Gemini client ────────────────────────────────────────────────────────────
_gemini_client = None
if config.GEMINI_API_KEY:
    try:
        from google import genai
        _gemini_client = genai.Client(api_key=config.GEMINI_API_KEY)
    except Exception as e:
        logger.warning(f"socratic_precompute: Gemini init failed: {e}")

# ── Ollama ───────────────────────────────────────────────────────────────────
_OLLAMA_BASE_URL = getattr(config, "OLLAMA_BASE_URL", "http://localhost:11434")
_OLLAMA_STN_MODEL = getattr(config, "OLLAMA_STN_MODEL", "qwen3.5:9b")
# Priority: STN model (GPU-detected, e.g. 35b) → 9b → 2b, deduplicated
_OLLAMA_PRECOMPUTE_MODELS = list(dict.fromkeys([_OLLAMA_STN_MODEL, "qwen3.5:9b", "qwen3.5:2b"]))

# Session-level flag: skip Gemini after a permanent error (expired key, invalid key, etc.)
_gemini_permanently_failed = False


def _is_ollama_model_available(model: str) -> bool:
    try:
        req = urllib.request.Request(f"{_OLLAMA_BASE_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as r:
            data = json.loads(r.read())
        return any(m.get("name") == model for m in data.get("models", []))
    except Exception:
        return False


# ============================================================================
# CACHE HELPERS
# ============================================================================

def _cache_key(course: str, topic_id: str) -> str:
    return f"socratic_precompute:{course.lower()}:{topic_id.lower()}"


def get_precomputed(course: str, topic_id: str) -> Optional[Dict]:
    """Return cached precomputed content, or None on miss."""
    if not _REDIS_OK:
        return None
    return _redis.get_cache(_cache_key(course, topic_id))


def _store_precomputed(course: str, topic_id: str, payload: Dict):
    if not _REDIS_OK:
        return
    _redis.set_cache(_cache_key(course, topic_id), payload, expire_seconds=_CACHE_TTL)
    logger.debug(f"Cached precomputed socratic content for {course}/{topic_id}")


# ============================================================================
# GENERATION
# ============================================================================

_PRECOMPUTE_PROMPT = """You are an expert Socratic tutor. For the course topic below, generate structured content.

Course : {course}
Topic  : {topic_name}
Subtopics (if any): {subtopics}

Respond ONLY with valid JSON matching this exact schema:
{{
  "intro_summary": "<2-3 sentence engaging introduction to this topic>",
  "questions": {{
    "easy": [
      {{"question": "<Socratic question>", "expected_answer_nature": "<what a correct beginner answer looks like>"}},
      {{"question": "...", "expected_answer_nature": "..."}},
      {{"question": "...", "expected_answer_nature": "..."}}
    ],
    "medium": [
      {{"question": "...", "expected_answer_nature": "..."}},
      {{"question": "...", "expected_answer_nature": "..."}},
      {{"question": "...", "expected_answer_nature": "..."}}
    ],
    "hard": [
      {{"question": "...", "expected_answer_nature": "..."}},
      {{"question": "...", "expected_answer_nature": "..."}},
      {{"question": "...", "expected_answer_nature": "..."}}
    ],
    "expert": [
      {{"question": "...", "expected_answer_nature": "..."}},
      {{"question": "...", "expected_answer_nature": "..."}},
      {{"question": "...", "expected_answer_nature": "..."}}
    ]
  }}
}}

Rules:
- easy   : recall and definition questions (Bloom's: Remember/Understand)
- medium : application and worked-example questions (Bloom's: Apply/Analyze)
- hard   : design and edge-case questions (Bloom's: Evaluate)
- expert : open research / critique questions (Bloom's: Create/Synthesize)
- Every question must be Socratic (guide thinking, do NOT give the answer)
- expected_answer_nature: describe the key concepts/reasoning a correct answer must include (2-3 sentences)
"""


def _call_gemini(prompt: str) -> Optional[str]:
    global _gemini_permanently_failed
    if not _gemini_client or _gemini_permanently_failed:
        return None
    try:
        response = _gemini_client.models.generate_content(
            model=config.GEMINI_MODEL_NAME,
            contents=prompt,
        )
        return response.text.strip() if response.text else None
    except Exception as e:
        err = str(e)
        # Permanent failures (expired/invalid key) — disable Gemini for rest of session
        if "API_KEY_INVALID" in err or "API key expired" in err or "key expired" in err.lower():
            _gemini_permanently_failed = True
            logger.warning("Gemini API key expired/invalid — switching to Ollama for all precomputation.")
        else:
            logger.error(f"Gemini call failed in precompute: {e}")
        return None


def _call_ollama(prompt: str) -> Optional[str]:
    """Try Ollama models in priority order for precomputation."""
    for model in _OLLAMA_PRECOMPUTE_MODELS:
        if not _is_ollama_model_available(model):
            logger.debug(f"Precompute: {model} not available, skipping.")
            continue
        try:
            payload = json.dumps({
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 2048},
            }).encode()
            req = urllib.request.Request(
                f"{_OLLAMA_BASE_URL}/api/generate",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=300) as r:
                data = json.loads(r.read())
            text = data.get("response", "").strip()
            if text:
                logger.info(f"Precompute: used Ollama model {model}")
                return text
        except Exception as e:
            logger.warning(f"Ollama precompute failed with {model}: {e}")
    return None


def _call_llm(prompt: str) -> Optional[str]:
    """Try Gemini first, fall back to Ollama."""
    result = _call_gemini(prompt)
    if result:
        return result
    logger.info("Precompute: Gemini unavailable, trying Ollama fallback...")
    return _call_ollama(prompt)


def _extract_json(raw: str) -> Optional[Dict]:
    """Extract first valid JSON object from a string."""
    try:
        return json.loads(raw)
    except Exception:
        pass
    import re
    m = re.search(r'\{.*\}', raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group())
        except Exception:
            pass
    return None


def precompute_topic(
    course: str,
    topic_id: str,
    topic_name: str,
    subtopics: Optional[List[str]] = None,
    force: bool = False,
) -> Optional[Dict]:
    """
    Generate and cache Socratic precomputed content for one topic.
    Returns the payload dict, or None if generation fails.
    Skips generation if cache already has this topic (unless force=True).
    """
    if not force:
        cached = get_precomputed(course, topic_id)
        if cached:
            logger.debug(f"Precompute cache HIT: {course}/{topic_id}")
            return cached

    subtopics_str = ", ".join(subtopics) if subtopics else "none"
    prompt = _PRECOMPUTE_PROMPT.format(
        course=course,
        topic_name=topic_name,
        subtopics=subtopics_str,
    )

    raw = _call_llm(prompt)
    if not raw:
        logger.warning(f"Precompute: LLM returned nothing for {course}/{topic_id}")
        return None

    payload = _extract_json(raw)
    if not payload or "intro_summary" not in payload or "questions" not in payload:
        logger.warning(f"Precompute: invalid JSON for {course}/{topic_id}: {raw[:200]}")
        return None

    payload["course"] = course
    payload["topic_id"] = topic_id
    payload["topic_name"] = topic_name
    _store_precomputed(course, topic_id, payload)
    logger.info(f"Precomputed socratic content for {course}/{topic_id}")
    return payload


def precompute_course_background(
    course: str,
    modules: List[Dict],
    delay_between_topics: float = 0.5,
) -> threading.Thread:
    """
    Precompute all topics in a course in a background thread.

    Args:
        course  : course name
        modules : list of module dicts from /curriculum/{course}/structure
                  each has { "topics": [{ "id", "name", "subtopics": [{"name"}] }] }
        delay_between_topics: seconds to sleep between LLM calls (rate-limiting)

    Returns:
        The running background Thread.
    """
    def _worker():
        total = sum(len(m.get("topics", [])) for m in modules)
        done = 0
        logger.info(f"Precompute START: {course} — {total} topics")
        for module in modules:
            for topic in module.get("topics", []):
                topic_id = topic.get("id", "")
                topic_name = topic.get("name", topic_id)
                subtopics = [s.get("name", "") for s in topic.get("subtopics", [])]
                try:
                    precompute_topic(course, topic_id, topic_name, subtopics)
                except Exception as e:
                    logger.error(f"Precompute error {course}/{topic_id}: {e}")
                done += 1
                if delay_between_topics > 0:
                    time.sleep(delay_between_topics)
        logger.info(f"Precompute DONE: {course} — {done}/{total} topics cached")

    t = threading.Thread(target=_worker, daemon=True, name=f"precompute:{course}")
    t.start()
    return t
