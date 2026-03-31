#!/usr/bin/env python3
"""
server/rag_service/scripts/offline_ingest.py
═══════════════════════════════════════════════════════════════════════════════

Night-Shift Offline Ingestion CLI
──────────────────────────────────
Runs heavy processing (KG extraction, STN generation, Qdrant re-embedding)
that is deferred from live chat sessions.

Usage:
    # Full run (all unprocessed sources)
    python offline_ingest.py

    # Dry run — show what would be processed
    python offline_ingest.py --dry-run

    # Target a specific collection / user
    python offline_ingest.py --user-id admin --limit 100

    # Skip KG (Qdrant-only re-embed)
    python offline_ingest.py --skip-kg

Schedule via cron (2 AM daily):
    0 2 * * * cd /path/to/server/rag_service && python scripts/offline_ingest.py >> logs/offline_ingest.log 2>&1

Design principles:
  - Resumable: writes a .progress JSON file; crashed runs resume from last checkpoint
  - Graceful shutdown: catches SIGTERM / SIGINT — finishes current doc before exiting
  - Admin-only KG: only processes KG for user_id == "admin"
  - Uses the same ai_core / graph_rag / neo4j_handler as the live service
  - Reports per-doc timing and a final summary
═══════════════════════════════════════════════════════════════════════════════
"""

import argparse
import copy
import json
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Bootstrap: make parent rag_service/ importable ───────────────────────────
_RAG_SERVICE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_RAG_SERVICE_DIR))

import config as cfg
import ai_core
import neo4j_handler
import graph_rag
from vector_db_service import VectorDBService

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("offline_ingest")

# ─── Progress file (enables resumption) ──────────────────────────────────────
_PROGRESS_FILE = _RAG_SERVICE_DIR / "scripts" / ".ingest_progress.json"


def _load_progress() -> dict:
    if _PROGRESS_FILE.exists():
        try:
            return json.loads(_PROGRESS_FILE.read_text())
        except Exception:
            pass
    return {"processed_ids": [], "last_run": None}


def _save_progress(state: dict):
    _PROGRESS_FILE.write_text(json.dumps(state, indent=2, default=str))


# ─── Graceful shutdown ────────────────────────────────────────────────────────
_shutdown_requested = False


def _handle_signal(sig, frame):
    global _shutdown_requested
    logger.warning(f"Signal {sig} received — finishing current document then stopping...")
    _shutdown_requested = True


signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


# ─── Core processing functions ────────────────────────────────────────────────

def _ingest_single_document(
    file_path: str,
    original_name: str,
    user_id: str,
    vector_service: VectorDBService,
    skip_kg: bool = False,
) -> dict:
    """
    Process one document:
    1. ai_core.process_document_for_qdrant  → chunks + embeddings
    2. vector_service.upsert_chunks         → Qdrant
    3. KG extraction via graph_rag          → Neo4j   (admin only, unless skip_kg)

    Returns a summary dict with timing and counts.
    """
    t0 = time.perf_counter()
    result = {
        "file": original_name,
        "user_id": user_id,
        "qdrant_chunks": 0,
        "kg_nodes": 0,
        "kg_skipped": False,
        "error": None,
        "elapsed_ms": 0,
    }

    try:
        # ── Step 1: Process document (chunk + embed) ──────────────────────────
        qdrant_chunks, raw_text, kg_chunks = ai_core.process_document_for_qdrant(
            file_path=file_path,
            original_name=original_name,
            user_id=user_id,
        )

        if not qdrant_chunks:
            result["error"] = "No chunks produced"
            return result

        result["qdrant_chunks"] = len(qdrant_chunks)

        # ── Step 2: Upsert into Qdrant ────────────────────────────────────────
        vector_service.upsert_chunks(qdrant_chunks)
        logger.info(f"  [Qdrant] {len(qdrant_chunks)} chunks upserted for '{original_name}'")

        # ── Step 3: KG extraction (admin-only; skipped when flag set) ─────────
        is_admin = str(user_id).lower() == "admin"
        if skip_kg or not is_admin:
            result["kg_skipped"] = True
            logger.info(f"  [KG] Skipped (skip_kg={skip_kg}, is_admin={is_admin})")
        elif raw_text and kg_chunks:
            doc_name = original_name.replace("/", "_").replace("\\", "_")
            from knowledge_graph_generator import generate_graph_from_text
            graph_data = generate_graph_from_text(raw_text[:8000])   # cap at 8k chars
            if graph_data:
                nodes = graph_data.get("nodes", [])
                edges = graph_data.get("edges", [])
                neo4j_handler.ingest_knowledge_graph(user_id, doc_name, nodes, edges)
                result["kg_nodes"] = len(nodes)
                logger.info(f"  [KG] {len(nodes)} nodes, {len(edges)} edges for '{original_name}'")
            else:
                logger.warning(f"  [KG] graph_data empty for '{original_name}'")

    except Exception as e:
        result["error"] = str(e)
        logger.error(f"  [ERROR] {original_name}: {e}", exc_info=True)

    result["elapsed_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return result


def _collect_pending_documents(
    base_dir: str,
    user_id: str | None,
    processed_ids: set,
    limit: int,
) -> list[dict]:
    """
    Scan the assets/ upload directory for documents not yet in processed_ids.
    Returns a list of {file_path, original_name, user_id}.
    """
    assets_root = Path(base_dir)
    pending = []

    if not assets_root.exists():
        logger.warning(f"Assets directory not found: {assets_root}")
        return pending

    glob_pattern = "**/*.pdf" if user_id is None else f"{user_id}/**/*.pdf"
    for pdf in assets_root.glob(glob_pattern):
        doc_id = str(pdf.relative_to(assets_root))
        if doc_id in processed_ids:
            continue
        uid = user_id or pdf.parent.parent.name or "admin"
        pending.append({
            "file_path": str(pdf),
            "original_name": pdf.name,
            "user_id": uid,
            "doc_id": doc_id,
        })
        if len(pending) >= limit:
            break

    return pending


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Night-shift offline document ingestion (KG + Qdrant re-embed)"
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed, don't execute")
    parser.add_argument("--user-id", default=None, help="Restrict to a specific user_id (default: all)")
    parser.add_argument("--limit", type=int, default=500, help="Max documents to process per run (default: 500)")
    parser.add_argument("--skip-kg", action="store_true", help="Skip KG extraction (Qdrant re-embed only)")
    parser.add_argument("--reset-progress", action="store_true", help="Clear .ingest_progress.json and start fresh")
    parser.add_argument(
        "--assets-dir",
        default=str(Path(_RAG_SERVICE_DIR).parent / "assets"),
        help="Path to the assets upload directory",
    )
    args = parser.parse_args()

    logger.info("=" * 70)
    logger.info("  offline_ingest.py — Night-Shift Batch Processor")
    logger.info(f"  Started: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 70)

    # ── Load / reset progress ─────────────────────────────────────────────────
    if args.reset_progress and _PROGRESS_FILE.exists():
        _PROGRESS_FILE.unlink()
        logger.info("Progress file cleared — starting fresh")

    progress = _load_progress()
    processed_ids = set(progress.get("processed_ids", []))
    logger.info(f"Previously processed: {len(processed_ids)} documents")

    # ── Collect pending docs ──────────────────────────────────────────────────
    pending = _collect_pending_documents(
        base_dir=args.assets_dir,
        user_id=args.user_id,
        processed_ids=processed_ids,
        limit=args.limit,
    )
    logger.info(f"Pending documents: {len(pending)}")

    if not pending:
        logger.info("Nothing to do. Exiting.")
        return

    if args.dry_run:
        for doc in pending:
            logger.info(f"  [DRY-RUN] Would process: {doc['doc_id']} (user={doc['user_id']})")
        return

    # ── Initialize services ───────────────────────────────────────────────────
    logger.info("Initializing services...")
    try:
        neo4j_handler.init_driver()
        graph_rag.verify_fulltext_index("node_search_index")
    except Exception as e:
        logger.warning(f"Neo4j init failed (KG will be skipped): {e}")
        args.skip_kg = True

    vector_service = VectorDBService()
    vector_service.setup_collection()
    logger.info("Services ready.")

    # ── Process documents ─────────────────────────────────────────────────────
    summary = {"total": len(pending), "ok": 0, "errors": 0, "total_chunks": 0, "total_kg_nodes": 0}
    run_start = time.perf_counter()

    for i, doc in enumerate(pending, 1):
        if _shutdown_requested:
            logger.info("Graceful shutdown requested — stopping before next document")
            break

        logger.info(f"[{i}/{len(pending)}] Processing: {doc['original_name']} (user={doc['user_id']})")
        result = _ingest_single_document(
            file_path=doc["file_path"],
            original_name=doc["original_name"],
            user_id=doc["user_id"],
            vector_service=vector_service,
            skip_kg=args.skip_kg,
        )

        if result["error"]:
            summary["errors"] += 1
            logger.warning(f"  ✗ Failed in {result['elapsed_ms']}ms: {result['error']}")
        else:
            summary["ok"] += 1
            summary["total_chunks"] += result["qdrant_chunks"]
            summary["total_kg_nodes"] += result["kg_nodes"]
            processed_ids.add(doc["doc_id"])
            logger.info(
                f"  ✓ Done in {result['elapsed_ms']}ms — "
                f"chunks={result['qdrant_chunks']} kg_nodes={result['kg_nodes']}"
            )

        # Persist progress after every successful doc
        progress["processed_ids"] = list(processed_ids)
        progress["last_run"] = datetime.now(timezone.utc).isoformat()
        _save_progress(progress)

    # ── Summary ───────────────────────────────────────────────────────────────
    total_elapsed = round((time.perf_counter() - run_start), 1)
    logger.info("")
    logger.info("=" * 70)
    logger.info(f"  OFFLINE INGEST COMPLETE — {datetime.now(timezone.utc).isoformat()}")
    logger.info(f"  Processed: {summary['ok']}/{summary['total']}  Errors: {summary['errors']}")
    logger.info(f"  Qdrant chunks: {summary['total_chunks']}  KG nodes: {summary['total_kg_nodes']}")
    logger.info(f"  Total time:    {total_elapsed:.1f}s")
    logger.info("=" * 70)

    neo4j_handler.close_driver()


if __name__ == "__main__":
    main()
