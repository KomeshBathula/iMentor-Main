"""
SGLang-based configuration for the lecture generator.
Mirrors the exact patterns used in server/rag_service/config.py and
server/rag_service/subtopic_notes_generator.py.

All LLM generation goes through SGLang (OpenAI-compatible).
Ollama is NOT used here — it is for embeddings/semantic-routing only.
Gemini is a last-resort fallback only when GEMINI_API_VALIDATED=true.
"""
import os
import logging

logger = logging.getLogger(__name__)

# ── SGLang endpoints (same env vars as the rest of the app) ────────────
SGLANG_ENABLED     = os.getenv("SGLANG_ENABLED", "true").lower() == "true"

# Three separate endpoints (may point to the same server in dev)
SGLANG_CHAT_URL    = os.getenv("SGLANG_CHAT_URL",   "http://localhost:8000/v1")
SGLANG_REASON_URL  = os.getenv("SGLANG_REASON_URL",  "http://localhost:8001/v1")
SGLANG_HEAVY_URL   = os.getenv("SGLANG_HEAVY_URL",   "http://localhost:8000/v1")

# Models (HuggingFace IDs as deployed in SGLang)
SGLANG_CHAT_MODEL  = os.getenv("SGLANG_CHAT_MODEL",  "Qwen/Qwen2.5-7B-Instruct-AWQ")
SGLANG_REASON_MODEL= os.getenv("SGLANG_REASON_MODEL","Qwen/Qwen2.5-7B-Instruct-AWQ")
SGLANG_HEAVY_MODEL = os.getenv("SGLANG_HEAVY_MODEL", "Qwen/Qwen2.5-7B-Instruct-AWQ")

# Lecture generator uses the heavy endpoint for all generation
# (concept extraction + note writing are complex tasks)
LG_URL   = SGLANG_HEAVY_URL
LG_MODEL = SGLANG_HEAVY_MODEL

# ── Gemini fallback (admin-validated only, identical to existing logic) ─
GEMINI_API_VALIDATED = os.getenv("GEMINI_API_VALIDATED", "false").lower() == "true"
GEMINI_API_KEY       = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL         = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# ── Generation parameters (mirrors subtopic_notes_generator.py) ────────
SCHEMA_PARAMS = {          # structured JSON output — low temp for precision
    "temperature": 0.1,
    "max_tokens":  4000,
}
NOTE_PARAMS = {            # rich prose generation — slightly higher temp
    "temperature": 0.25,
    "max_tokens":  3500,
}
DIAGRAM_PARAMS = {         # mermaid / LaTeX generation
    "temperature": 0.15,
    "max_tokens":  1000,
}

# ── Output directories ─────────────────────────────────────────────────
REPO_ROOT    = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LECTURES_DIR = os.path.join(REPO_ROOT, "lectures")


# ── Startup validation ─────────────────────────────────────────────────
def validate() -> None:
    """Warn if SGLang is disabled or misconfigured."""
    if not SGLANG_ENABLED:
        logger.warning(
            "SGLANG_ENABLED is not 'true'. "
            "Set SGLANG_ENABLED=true and ensure SGLang is running on %s", LG_URL
        )
    else:
        logger.info("LectureGenerator: SGLang → %s  model=%s", LG_URL, LG_MODEL)
        if GEMINI_API_VALIDATED:
            logger.info("LectureGenerator: Gemini fallback enabled (%s)", GEMINI_MODEL)
