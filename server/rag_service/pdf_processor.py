# server/rag_service/pdf_processor.py
"""
Dual-mode PDF processor:
  - Fast path  : pdfplumber  → immediate text for upload response
  - Quality path: marker-pdf → rich Markdown (equations, tables, headings)
                  runs in a background thread; when done, replaces pdfplumber
                  chunks in Qdrant automatically.

OCR fallback chain (for scanned / image-only pages):
  1. Tesseract (local, fast)
  2. Gemini Vision (cloud, accurate) — only when Tesseract yields < 50 chars/page
"""

import io
import os
import logging
import threading
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# ── pdfplumber (fast) ────────────────────────────────────────────────────────
try:
    import pdfplumber
    _PDFPLUMBER = True
except ImportError:
    _PDFPLUMBER = False
    logger.warning("pdfplumber not available — fast PDF path disabled.")

# ── marker-pdf (quality) ─────────────────────────────────────────────────────
try:
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict
    from marker.output import text_from_rendered
    _MARKER = True
    _marker_models = None          # lazy-loaded on first call
    _marker_lock = threading.Lock()
except ImportError:
    _MARKER = False
    logger.warning("marker-pdf not installed — quality PDF path disabled.")

# ── Tesseract OCR ────────────────────────────────────────────────────────────
try:
    import pytesseract
    from PIL import Image as PILImage
    import fitz as _fitz          # PyMuPDF — for image extraction
    _TESSERACT = True
except ImportError:
    _TESSERACT = False
    logger.warning("pytesseract/PIL/fitz not available — Tesseract OCR disabled.")

# ── Gemini Vision fallback ───────────────────────────────────────────────────
try:
    import config as _cfg
    _GEMINI_KEY = getattr(_cfg, "GEMINI_API_KEY", None)
except Exception:
    _GEMINI_KEY = None


# ============================================================================
# FAST PATH — pdfplumber
# ============================================================================

def parse_pdf_fast(file_path: str) -> Optional[str]:
    """
    Extract plain text from a PDF using pdfplumber (fast, ~100-300 ms/page).
    Returns None if extraction fails or yields no text.
    """
    if not _PDFPLUMBER:
        return None
    try:
        parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text(x_tolerance=2, y_tolerance=2)
                if t and t.strip():
                    parts.append(t.strip())
        text = "\n\n".join(parts).strip()
        return text if text else None
    except Exception as e:
        logger.warning(f"pdfplumber fast-parse failed for {os.path.basename(file_path)}: {e}")
        return None


# ============================================================================
# QUALITY PATH — marker-pdf → Markdown
# ============================================================================

def _get_marker_models():
    """Lazy-load marker models (heavy, only once)."""
    global _marker_models
    if _marker_models is None:
        with _marker_lock:
            if _marker_models is None:
                logger.info("Loading marker-pdf models (first call — may take ~30s)...")
                _marker_models = create_model_dict()
                logger.info("marker-pdf models loaded.")
    return _marker_models


def parse_pdf_marker(file_path: str) -> Optional[str]:
    """
    Convert a PDF to rich Markdown using marker-pdf.
    Preserves headings, tables, code blocks, and math equations.
    Returns Markdown string or None on failure.
    """
    if not _MARKER:
        return None
    try:
        models = _get_marker_models()
        converter = PdfConverter(artifact_dict=models)
        rendered = converter(file_path)
        markdown, _, _ = text_from_rendered(rendered)
        return markdown.strip() if markdown and markdown.strip() else None
    except Exception as e:
        logger.error(f"marker-pdf failed for {os.path.basename(file_path)}: {e}", exc_info=True)
        return None


# ============================================================================
# OCR FALLBACK CHAIN
# ============================================================================

def _ocr_with_tesseract(file_path: str) -> Optional[str]:
    """Extract text from a scanned PDF using Tesseract via PyMuPDF image extraction."""
    if not _TESSERACT:
        return None
    try:
        doc = _fitz.open(file_path)
        pages_text = []
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            pix = page.get_pixmap(dpi=200)
            img = PILImage.frombytes("RGB", [pix.width, pix.height], pix.samples)
            text = pytesseract.image_to_string(img, lang="eng")
            if text.strip():
                pages_text.append(text.strip())
        doc.close()
        combined = "\n\n".join(pages_text)
        return combined if combined.strip() else None
    except Exception as e:
        logger.warning(f"Tesseract OCR failed for {os.path.basename(file_path)}: {e}")
        return None


def _ocr_with_gemini_vision(file_path: str) -> Optional[str]:
    """
    Fallback OCR via Gemini Vision when Tesseract fails or yields very little text.
    Sends up to the first 10 pages as images.
    """
    if not _GEMINI_KEY:
        return None
    try:
        from google import genai
        from google.genai import types as genai_types
        import base64

        client = genai.Client(api_key=_GEMINI_KEY)
        doc = _fitz.open(file_path)
        parts = []
        max_pages = min(len(doc), 10)
        for i in range(max_pages):
            pix = doc[i].get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            b64 = base64.b64encode(img_bytes).decode()
            parts.append(genai_types.Part.from_bytes(data=base64.b64decode(b64), mime_type="image/png"))
        doc.close()

        if not parts:
            return None

        parts.append(genai_types.Part.from_text(
            "Extract all text from these PDF page images. Preserve structure, "
            "tables, headings, and equations. Output plain text only."
        ))
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=parts,
        )
        text = response.text.strip() if response.text else None
        logger.info(f"Gemini Vision OCR produced {len(text or '')} chars for {os.path.basename(file_path)}")
        return text
    except Exception as e:
        logger.error(f"Gemini Vision OCR failed for {os.path.basename(file_path)}: {e}")
        return None


def ocr_fallback_chain(file_path: str) -> Optional[str]:
    """
    Try Tesseract first; fall back to Gemini Vision if result is poor.
    Called when fast/quality extractors yield < 50 chars/page on average.
    """
    logger.info(f"Running OCR fallback chain on {os.path.basename(file_path)}")
    result = _ocr_with_tesseract(file_path)
    if result and len(result) > 200:
        logger.info("Tesseract OCR succeeded.")
        return result

    logger.info("Tesseract yielded sparse text — trying Gemini Vision OCR.")
    result = _ocr_with_gemini_vision(file_path)
    if result:
        return result

    logger.warning(f"All OCR methods failed for {os.path.basename(file_path)}.")
    return None


# ============================================================================
# DUAL-MODE ORCHESTRATOR
# ============================================================================

def _is_text_sparse(text: Optional[str], file_path: str) -> bool:
    """Heuristic: if text has < 50 chars/page on average, treat as scanned."""
    if not text:
        return True
    try:
        if _PDFPLUMBER:
            with pdfplumber.open(file_path) as pdf:
                n_pages = max(len(pdf.pages), 1)
        else:
            n_pages = 1
        return (len(text) / n_pages) < 50
    except Exception:
        return len(text) < 200


def process_pdf_dual_mode(
    file_path: str,
    original_name: str,
    user_id: str,
    on_quality_ready=None,          # optional callback(markdown_text)
) -> str:
    """
    Immediately returns fast pdfplumber text (or OCR if scanned).
    Launches marker-pdf in a background thread; when done, calls on_quality_ready(markdown).

    Args:
        file_path      : Absolute path to the PDF.
        original_name  : Display name (for logs).
        user_id        : Owner user ID.
        on_quality_ready: Callable invoked when marker finishes with the richer text.

    Returns:
        Fast-path text string (pdfplumber or OCR).
    """
    # ── Fast path ────────────────────────────────────────────────────────────
    fast_text = parse_pdf_fast(file_path)

    if _is_text_sparse(fast_text, file_path):
        logger.info(f"{original_name}: sparse text detected — running OCR chain.")
        ocr_text = ocr_fallback_chain(file_path)
        if ocr_text:
            fast_text = ocr_text

    logger.info(f"{original_name}: fast-path extracted {len(fast_text or '')} chars.")

    # ── Quality path in background ───────────────────────────────────────────
    if _MARKER and on_quality_ready:
        def _run_marker():
            logger.info(f"{original_name}: starting marker-pdf conversion in background...")
            markdown = parse_pdf_marker(file_path)
            if markdown:
                logger.info(f"{original_name}: marker-pdf done ({len(markdown)} chars) — upgrading chunks.")
                try:
                    on_quality_ready(markdown)
                except Exception as cb_err:
                    logger.error(f"{original_name}: on_quality_ready callback failed: {cb_err}", exc_info=True)
            else:
                logger.warning(f"{original_name}: marker-pdf returned no content.")

        t = threading.Thread(target=_run_marker, daemon=True, name=f"marker:{original_name}")
        t.start()

    return fast_text or ""
