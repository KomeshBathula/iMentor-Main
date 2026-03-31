#!/usr/bin/env python3
"""
iMentor Lecture Generator
==========================
Generates complete lecture notes grounded in your actual course materials.
All LLM calls go to the local SGLang server. Nothing leaves your machine.

Modes:
  1. Topic only (LLM knowledge)
       python generate_lecture.py "Backpropagation"

  2. Single source file (grounded in one document)
       python generate_lecture.py "DBMS" --source ./notes.md

  3. Multi-lecture course folder (grounded across all lectures)
       python generate_lecture.py "Machine Learning" --course-dir ./ML_lectures/
       python generate_lecture.py "DBMS" --course-dir ./server/course_bootstrap/DBMS/_markdown_backup/

       Accepts: .pdf .md .txt .rst .tex
       Ordered by filename (Lecture_01_*.pdf, L02_*.md, 03_*.txt, etc.)

Requirements:
    pip install openai networkx pyvis pydantic pdfplumber

SGLang must be running:
    SGLANG_ENABLED=true  (default)
    SGLANG_HEAVY_URL=http://localhost:8000/v1  (default)
    SGLANG_HEAVY_MODEL=Qwen/Qwen2.5-7B-Instruct-AWQ  (default)
"""

import argparse
import logging
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

# ── Dependency check ───────────────────────────────────────────────────
_missing = []
for pkg, imp in [("openai", "openai"), ("networkx", "networkx"),
                 ("pyvis", "pyvis"), ("pydantic", "pydantic")]:
    try:
        __import__(imp)
    except ImportError:
        _missing.append(pkg)

if _missing:
    print(f"❌  Missing packages: {', '.join(_missing)}")
    print("   Run:  pip install " + " ".join(_missing))
    sys.exit(1)

from lecture_generator import config
from lecture_generator import sglang_client
from lecture_generator.concept_extractor import extract_knowledge_graph
from lecture_generator.note_writer import generate_all_notes
from lecture_generator.concept_map import build_concept_map
from lecture_generator.concept_tracker import track_coverage, coverage_summary
from lecture_generator.course_loader import load_course, Course
from lecture_generator.renderer import to_html, to_markdown
from lecture_generator.syllabus_loader import find_syllabus, Syllabus

# ── Logging ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────

def _safe_dirname(topic: str) -> str:
    """Convert a topic string to a safe directory name."""
    safe = "".join(c if c.isalnum() or c in " _-" else "_" for c in topic)
    safe = safe.strip().replace(" ", "_")[:60]
    ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    return f"{safe}_{ts}"


def _read_source(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except OSError as exc:
        logger.warning("Could not read source file %s: %s", path, exc)
        return ""


# ── Main pipeline ──────────────────────────────────────────────────────

def run(
    topic: str,
    source_text: str = "",
    course: Course = None,
    syllabus: Syllabus = None,
    output_root: str = "",
) -> str:
    """
    Full pipeline:
      1. Validate SGLang connection
      2. Extract knowledge graph (Pydantic-constrained SGLang call)
      3. Build interactive concept map (pyvis)
      4. Generate per-concept notes (SGLang, one call per concept)
      5. Render to HTML + Markdown
      6. Return output directory path
    """
    out_root = output_root or config.LECTURES_DIR
    out_dir  = os.path.join(out_root, _safe_dirname(topic))
    os.makedirs(out_dir, exist_ok=True)

    # Prefer course combined text over single source_text
    if course:
        source_text = course.combined_text

    print(f"\n📚  iMentor Lecture Generator")
    print(f"    Topic:  {topic}")
    if syllabus:
        print(f"    Syllabus: {syllabus.source_path}  ({syllabus.summary})")
    if course:
        print(f"    Source: {course.source_dir}  ({course.summary})")
    elif source_text:
        print(f"    Source: single file  ({len(source_text)//1000}K chars)")
    else:
        print(f"    Source: LLM parametric knowledge (no source files)")
    print(f"    LLM:    {config.LG_MODEL}  ({config.LG_URL})")
    print(f"    Output: {out_dir}\n")

    # ── Step 1: SGLang health check ────────────────────────────────────
    print("⚡  Checking SGLang connection …", flush=True)
    if not sglang_client.check_health():
        if config.SGLANG_ENABLED:
            print(
                f"⚠️   SGLang not responding at {config.LG_URL}\n"
                f"    Make sure SGLang is running:  SGLANG_ENABLED=true\n"
                f"    Attempting to continue anyway (call will fail if unreachable) …\n"
            )
        else:
            print("❌  SGLANG_ENABLED is not 'true'. Set it in your .env and restart.")
            sys.exit(1)
    else:
        print(f"    ✓  SGLang reachable\n", flush=True)

    # ── Step 2: Extract knowledge graph ───────────────────────────────
    print("🧠  Extracting knowledge graph …", flush=True)
    if syllabus:
        print(f"    Blueprint: {syllabus.summary} → ~{syllabus.concept_count_hint()} concepts", flush=True)
    kg = extract_knowledge_graph(topic, source_text, syllabus=syllabus)
    if kg is None:
        print("❌  Knowledge graph extraction failed. Check SGLang logs.")
        sys.exit(1)
    print(
        f"    ✓  {len(kg.concepts)} concepts, {len(kg.relationships)} relationships\n",
        flush=True,
    )

    # ── Step 3: Track concept coverage across lectures ────────────────
    coverage = None
    lectures_count = 0
    if course and course.lectures:
        print("🔍  Mapping concepts to source lectures …", flush=True)
        coverage = track_coverage(kg.concepts, course)
        print(coverage_summary(coverage, course), flush=True)
        lectures_count = len(course.lectures)

    # ── Step 4: Build concept map ──────────────────────────────────────
    print("🗺   Building interactive concept map …", flush=True)
    cm_path = os.path.join(out_dir, "concept_map.html")
    build_concept_map(kg, cm_path, coverage=coverage)
    print(f"    ✓  concept_map.html\n", flush=True)

    # ── Step 5: Generate per-concept notes (grounded in source) ───────
    mode = "grounded in source lectures" if coverage else "LLM knowledge"
    print(f"📝  Generating notes for {len(kg.concepts)} concepts ({mode}) …\n", flush=True)
    notes = generate_all_notes(kg, coverage=coverage)
    succeeded = sum(1 for _, n in notes if n is not None)
    print(
        f"\n    ✓  {succeeded}/{len(kg.concepts)} concepts generated successfully\n",
        flush=True,
    )

    # ── Step 6: Render ─────────────────────────────────────────────────
    print("🎨  Rendering output files …", flush=True)

    # HTML
    html_path = os.path.join(out_dir, "lecture.html")
    html = to_html(
        kg, notes,
        concept_map_rel_path="concept_map.html",
        coverage=coverage,
        lectures_count=lectures_count,
    )
    with open(html_path, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"    ✓  lecture.html  ({len(html)//1024} KB)", flush=True)

    # Markdown
    md_path = os.path.join(out_dir, "lecture.md")
    md = to_markdown(kg, notes, concept_map_rel_path="concept_map.html")
    with open(md_path, "w", encoding="utf-8") as fh:
        fh.write(md)
    print(f"    ✓  lecture.md    ({len(md)//1024} KB)", flush=True)

    # ── Done ───────────────────────────────────────────────────────────
    print(f"\n✅  Done!\n")
    print(f"    Open in browser:")
    print(f"    file://{html_path}\n")

    return out_dir


# ── CLI ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate local LLM-powered lecture notes (SGLang only, no cloud).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("topic", help='Course/topic name, e.g. "Machine Learning"')

    src = parser.add_mutually_exclusive_group()
    src.add_argument(
        "--course-dir", "-c",
        metavar="DIR",
        help=(
            "Folder of lecture files (.pdf .md .txt). Files are loaded in natural sort order. "
            "Example: --course-dir ./server/course_bootstrap/DBMS/_markdown_backup/"
        ),
    )
    src.add_argument(
        "--source", "-s",
        metavar="FILE",
        help="Single source file (.txt .md) to ground the notes",
    )

    parser.add_argument(
        "--out", "-o",
        metavar="DIR",
        default="",
        help="Output directory root (default: lectures/ in repo root)",
    )
    parser.add_argument(
        "--model",
        metavar="MODEL_ID",
        help="Override SGLANG_HEAVY_MODEL for this run",
    )
    parser.add_argument(
        "--url",
        metavar="URL",
        help="Override SGLANG_HEAVY_URL for this run",
    )
    args = parser.parse_args()

    if args.model:
        config.LG_MODEL = args.model
    if args.url:
        config.LG_URL = args.url

    config.validate()

    course = None
    syllabus = None
    source_text = ""

    if args.course_dir:
        print(f"\n📂  Loading course from: {args.course_dir}", flush=True)
        try:
            course = load_course(args.course_dir, course_name=args.topic)
            print(f"    ✓  {course.summary}", flush=True)
        except (FileNotFoundError, ValueError) as exc:
            print(f"❌  {exc}")
            sys.exit(1)

        # Auto-detect syllabus.csv in the course directory
        syllabus = find_syllabus(args.course_dir, course_name=args.topic)
        if syllabus:
            print(f"    ✓  Syllabus found: {syllabus.summary}", flush=True)
        else:
            print(f"    ⚠  No syllabus.csv found — concept structure will be inferred by LLM", flush=True)
        print(flush=True)
    elif args.source:
        source_text = _read_source(args.source)

    run(
        topic=args.topic,
        source_text=source_text,
        course=course,
        syllabus=syllabus,
        output_root=args.out,
    )


if __name__ == "__main__":
    main()
