"""
Course loader — reads a folder of lecture files and returns structured text per lecture.

Supported formats:
  - PDF  → pdfplumber (same lib as server/rag_service/pdf_processor.py)
  - .md / .txt / .rst → plain read

Lecture ordering:
  Files are sorted naturally. Numeric prefixes are recognised:
    Lecture_01_Intro.pdf, L03_Backprop.pdf, 07_Optimisation.md, ch3.pdf
  If no number is found the alphabetical position is used.

Nothing is sent to Qdrant or any cloud service here.
"""
import os
import re
import logging
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

# ── Data model ────────────────────────────────────────────────────────────

@dataclass
class Lecture:
    index: int             # 1-based lecture number
    filename: str          # original filename (no directory)
    filepath: str          # absolute path
    title: str             # inferred title
    text: str              # full extracted text
    page_count: int = 0    # PDF pages (0 for text files)
    char_count: int = 0

    def __post_init__(self):
        self.char_count = len(self.text)

    def excerpt(self, concept_label: str, window: int = 600) -> str:
        """Return the best text window around the first mention of concept_label."""
        idx = self.text.lower().find(concept_label.lower())
        if idx == -1:
            return ""
        start = max(0, idx - window // 2)
        end   = min(len(self.text), idx + window // 2)
        snippet = self.text[start:end].strip()
        # Trim to sentence boundary if possible
        if start > 0 and ". " in snippet[:80]:
            snippet = snippet[snippet.index(". ") + 2:]
        return f"[Lecture {self.index}: {self.title}]\n{snippet}"


@dataclass
class Course:
    name: str
    source_dir: str
    lectures: List[Lecture] = field(default_factory=list)

    @property
    def combined_text(self) -> str:
        """All lecture text joined with clear lecture separators."""
        parts = []
        for lec in self.lectures:
            parts.append(f"\n\n{'='*60}\nLECTURE {lec.index}: {lec.title}\n{'='*60}\n")
            parts.append(lec.text)
        return "\n".join(parts)

    @property
    def summary(self) -> str:
        lc = len(self.lectures)
        tc = sum(l.char_count for l in self.lectures)
        return (
            f"{lc} lecture{'s' if lc != 1 else ''}, "
            f"~{tc // 1000}K characters total"
        )


# ── Filename ordering ─────────────────────────────────────────────────────

_NUM_RE = re.compile(r"(\d+)")

def _lecture_sort_key(filename: str):
    """Natural sort — extract leading number, fall back to filename."""
    nums = _NUM_RE.findall(filename)
    if nums:
        return (int(nums[0]), filename)
    return (9999, filename)


def _infer_title(filename: str) -> str:
    """
    Lecture_03_Gradient_Descent.pdf → 'Gradient Descent'
    L07 - Backpropagation.md        → 'Backpropagation'
    ch5_optimization.txt             → 'Optimization'
    """
    name = os.path.splitext(filename)[0]
    # Remove leading lecture/chapter markers
    name = re.sub(r"^(lecture|lec|l|chapter|ch|unit|u|week|w|module|mod)[_\s\-]*\d*[_\s\-]*",
                  "", name, flags=re.IGNORECASE)
    # Replace underscores / hyphens with spaces
    name = re.sub(r"[_\-]+", " ", name).strip()
    # Title-case
    return name.title() or filename


# ── PDF extraction ────────────────────────────────────────────────────────

def _extract_pdf(filepath: str) -> tuple[str, int]:
    """
    Extract text from a PDF using pdfplumber (same dependency as pdf_processor.py).
    Returns (text, page_count).
    Falls back to PyMuPDF if pdfplumber is unavailable.
    """
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(filepath) as pdf:
            page_count = len(pdf.pages)
            for page in pdf.pages:
                t = page.extract_text(x_tolerance=3, y_tolerance=3)
                if t:
                    pages.append(t)
        return "\n\n".join(pages), page_count
    except ImportError:
        pass

    try:
        import fitz  # PyMuPDF
        doc = fitz.open(filepath)
        pages = [page.get_text() for page in doc]
        return "\n\n".join(pages), len(doc)
    except ImportError:
        pass

    logger.warning(
        "No PDF parser available for %s. Install pdfplumber:  pip install pdfplumber",
        os.path.basename(filepath),
    )
    return "", 0


# ── Text file extraction ──────────────────────────────────────────────────

def _extract_text(filepath: str) -> str:
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except OSError as exc:
        logger.warning("Cannot read %s: %s", filepath, exc)
        return ""


# ── Public API ────────────────────────────────────────────────────────────

_SUPPORTED_EXTS = {".pdf", ".md", ".txt", ".rst", ".tex"}


def load_course(
    course_dir: str,
    course_name: Optional[str] = None,
    max_chars_per_lecture: int = 80_000,
) -> Course:
    """
    Load all lecture files from course_dir and return a Course object.

    Args:
        course_dir:             Path to folder containing lecture files
        course_name:            Display name (defaults to folder name)
        max_chars_per_lecture:  Truncate very long texts to keep prompts manageable

    Raises:
        FileNotFoundError: if course_dir doesn't exist
        ValueError:         if no supported lecture files found
    """
    course_dir = os.path.abspath(course_dir)
    if not os.path.isdir(course_dir):
        raise FileNotFoundError(f"Course directory not found: {course_dir}")

    name = course_name or os.path.basename(course_dir)

    # Collect supported files
    candidates = [
        f for f in os.listdir(course_dir)
        if os.path.splitext(f)[1].lower() in _SUPPORTED_EXTS
        and os.path.isfile(os.path.join(course_dir, f))
    ]
    if not candidates:
        raise ValueError(
            f"No supported lecture files found in {course_dir}\n"
            f"Supported: {', '.join(sorted(_SUPPORTED_EXTS))}"
        )

    candidates.sort(key=_lecture_sort_key)

    lectures: List[Lecture] = []
    for i, filename in enumerate(candidates, start=1):
        filepath = os.path.join(course_dir, filename)
        ext = os.path.splitext(filename)[1].lower()
        title = _infer_title(filename)

        logger.info("  Loading Lecture %d: %s (%s)", i, title, filename)

        if ext == ".pdf":
            text, pages = _extract_pdf(filepath)
            page_count = pages
        else:
            text = _extract_text(filepath)
            page_count = 0

        if not text.strip():
            logger.warning("  Empty content for %s — skipping", filename)
            continue

        # Truncate very long documents
        if len(text) > max_chars_per_lecture:
            logger.info(
                "  Truncating %s from %d to %d chars",
                filename, len(text), max_chars_per_lecture,
            )
            text = text[:max_chars_per_lecture]

        lectures.append(Lecture(
            index=i,
            filename=filename,
            filepath=filepath,
            title=title,
            text=text,
            page_count=page_count,
        ))

    if not lectures:
        raise ValueError(f"All files in {course_dir} were empty or unreadable")

    logger.info("Course '%s' loaded: %s", name, Course(name, course_dir, lectures).summary)
    return Course(name=name, source_dir=course_dir, lectures=lectures)
