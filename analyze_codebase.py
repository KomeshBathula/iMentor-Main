#!/usr/bin/env python3
"""
iMentor Codebase Graph Analyzer
================================
Walks the repository, parses JS/JSX and Python files,
builds six distinct interactive knowledge graphs, and saves them
as timestamped self-contained HTML files.

Every run creates a NEW output folder — nothing is ever overwritten.
If a previous snapshot exists, a diff graph is also generated.

Usage:
    python analyze_codebase.py                  # full analysis
    python analyze_codebase.py --no-diff        # skip diff graph
    python analyze_codebase.py --only-service   # only service dependency graph
    python analyze_codebase.py --list           # list previous snapshots

Requirements:
    pip install networkx pyvis
    (see graph_analyzer/requirements.txt)
"""

import argparse
import os
import sys
import re
from datetime import datetime
from typing import Dict, Tuple

# ── Ensure graph_analyzer package is importable ──────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

try:
    import networkx as nx
    from pyvis.network import Network
except ImportError:
    print("❌  Missing dependencies. Run:\n   pip install networkx pyvis\n")
    sys.exit(1)

from graph_analyzer.config import (
    REPO_ROOT, OUTPUT_DIR, SNAPSHOTS_DIR,
    SKIP_DIRS, SKIP_FILES, JS_EXTS, PY_EXTS,
    DIR_TYPE_MAP, FILENAME_TYPE_PATTERNS, NODE_TYPE_LABELS,
)
from graph_analyzer.parsers.js_parser import JSParser, JSFileInfo
from graph_analyzer.parsers.py_parser import PyParser, PyFileInfo
from graph_analyzer.builders.graph_builder import (
    build_module_dependency_graph,
    build_api_route_graph,
    build_service_dependency_graph,
    build_react_component_graph,
    build_data_flow_graph,
    build_routing_waterfall_graph,
)
from graph_analyzer.visualizer import render_graph, render_index
from graph_analyzer.diff_engine import (
    graphs_to_bundle,
    save_snapshot,
    load_latest_snapshot,
    compute_full_diff,
    diff_summary,
)


# ─────────────────────────────────────────────────────────────────────────
# File discovery & classification
# ─────────────────────────────────────────────────────────────────────────

def classify_file(rel_path: str) -> str:
    """Determine node_type from a file's relative path."""
    norm = rel_path.replace("\\", "/")
    # Directory-based classification (longest-match wins)
    best_match = ("", "default")
    for prefix, ntype in DIR_TYPE_MAP.items():
        if norm.startswith(prefix) and len(prefix) > len(best_match[0]):
            best_match = (prefix, ntype)
    if best_match[1] != "default":
        return best_match[1]
    # Filename pattern fallback
    for pattern, ntype in FILENAME_TYPE_PATTERNS:
        if re.search(pattern, norm):
            return ntype
    return "default"


def discover_files(repo_root: str) -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Walk the repo and return two dicts:
      js_paths:  {rel_path: abs_path}
      py_paths:  {rel_path: abs_path}
    """
    js_paths: Dict[str, str] = {}
    py_paths: Dict[str, str] = {}

    for dirpath, dirnames, filenames in os.walk(repo_root):
        # Prune skip dirs in-place
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS and not d.startswith(".")
        ]

        rel_dir = os.path.relpath(dirpath, repo_root).replace("\\", "/")
        if rel_dir == ".":
            rel_dir = ""

        for filename in filenames:
            if filename in SKIP_FILES:
                continue
            _, ext = os.path.splitext(filename)
            rel_path = (f"{rel_dir}/{filename}" if rel_dir else filename).lstrip("./")
            abs_path = os.path.join(dirpath, filename)

            if ext in JS_EXTS:
                js_paths[rel_path] = abs_path
            elif ext in PY_EXTS:
                py_paths[rel_path] = abs_path

    return js_paths, py_paths


# ─────────────────────────────────────────────────────────────────────────
# Parsing
# ─────────────────────────────────────────────────────────────────────────

def parse_all_files(
    js_paths: Dict[str, str],
    py_paths: Dict[str, str],
) -> Tuple[Dict[str, JSFileInfo], Dict[str, PyFileInfo]]:
    """Parse all discovered files and resolve their imports."""
    js_parser = JSParser()
    py_parser = PyParser()

    print(f"  Parsing {len(js_paths)} JS/JSX files …", flush=True)
    js_files: Dict[str, JSFileInfo] = {}
    for rel, abs_path in js_paths.items():
        node_type = classify_file(rel)
        info = js_parser.parse_file(abs_path, rel, node_type)
        if info:
            js_files[rel] = info

    print(f"  Parsing {len(py_paths)} Python files …", flush=True)
    py_files: Dict[str, PyFileInfo] = {}
    for rel, abs_path in py_paths.items():
        node_type = classify_file(rel)
        info = py_parser.parse_file(abs_path, rel, node_type)
        if info:
            py_files[rel] = info

    # Resolve imports now that we know all paths
    all_js_rels = set(js_files.keys())
    all_py_rels = set(py_files.keys())
    for info in js_files.values():
        js_parser.resolve_imports(info, all_js_rels)
    for info in py_files.values():
        py_parser.resolve_imports(info, all_py_rels)

    return js_files, py_files


# ─────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────

GRAPH_REGISTRY = [
    # (key, filename, graph_name, description, builder_fn)
    (
        "module_deps",
        "1_module_dependencies.html",
        "Module Dependency Graph",
        "Which files import which. Shows coupling and circular dependencies.",
    ),
    (
        "api_routes",
        "2_api_routes.html",
        "API Route Map",
        "All HTTP endpoints → handlers → services (Express + FastAPI).",
    ),
    (
        "service_deps",
        "3_service_dependencies.html",
        "Service Dependency Graph",
        "Service-to-service call graph. Core for backend architecture review.",
    ),
    (
        "react_tree",
        "4_react_component_tree.html",
        "React Component Tree",
        "Frontend component hierarchy and hook usage.",
    ),
    (
        "data_flow",
        "5_chat_data_flow.html",
        "Chat Request Data Flow",
        "Complete request journey: browser → Express → LLM → SSE response.",
    ),
    (
        "routing_waterfall",
        "6_llm_routing_waterfall.html",
        "LLM Routing Waterfall",
        "The 10-step routing decision pipeline for LLM model selection.",
    ),
]


def run_analysis(args) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    out_dir = os.path.join(OUTPUT_DIR, timestamp)
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

    print(f"\n🔭 iMentor Codebase Graph Analyzer")
    print(f"   Repository: {REPO_ROOT}")
    print(f"   Output:     {out_dir}")
    print(f"   Timestamp:  {timestamp}\n")

    # ── 1. Discover & parse ──────────────────────────────────────────────
    print("📂 Discovering files …")
    js_paths, py_paths = discover_files(REPO_ROOT)
    print(f"   Found {len(js_paths)} JS/JSX  |  {len(py_paths)} Python files")

    print("\n🔍 Parsing …")
    js_files, py_files = parse_all_files(js_paths, py_paths)

    # ── 2. Build graphs ──────────────────────────────────────────────────
    print("\n📊 Building graphs …")
    graphs: Dict[str, nx.DiGraph] = {}
    graph_meta = []

    def build_and_register(key, filename, name, description, G):
        graphs[key] = G
        nc = G.number_of_nodes()
        ec = G.number_of_edges()
        graph_meta.append((filename, name, description, nc, ec))
        print(f"   ✓  {name:40s}  {nc:4d} nodes  {ec:4d} edges")

    # Module dependencies (all files)
    build_and_register(
        "module_deps", "1_module_dependencies.html",
        "Module Dependency Graph",
        "Which files import which. Shows coupling and circular dependencies.",
        build_module_dependency_graph(js_files, py_files),
    )

    # API routes
    build_and_register(
        "api_routes", "2_api_routes.html",
        "API Route Map",
        "All HTTP endpoints → handlers → services (Express + FastAPI).",
        build_api_route_graph(js_files, py_files),
    )

    # Service dependencies (backend only)
    build_and_register(
        "service_deps", "3_service_dependencies.html",
        "Service Dependency Graph",
        "Service-to-service call graph. Core for backend architecture review.",
        build_service_dependency_graph(js_files),
    )

    # React component tree (frontend only)
    build_and_register(
        "react_tree", "4_react_component_tree.html",
        "React Component Tree",
        "Frontend component hierarchy and hook usage.",
        build_react_component_graph(js_files),
    )

    # Data flow (hardcoded for accuracy)
    build_and_register(
        "data_flow", "5_chat_data_flow.html",
        "Chat Request Data Flow",
        "Complete request journey: browser → Express → LLM → SSE response.",
        build_data_flow_graph(),
    )

    # LLM routing waterfall
    build_and_register(
        "routing_waterfall", "6_llm_routing_waterfall.html",
        "LLM Routing Waterfall",
        "The 10-step routing decision pipeline for LLM model selection.",
        build_routing_waterfall_graph(),
    )

    # ── 3. Diff against previous snapshot ───────────────────────────────
    has_diff = False
    if not getattr(args, "no_diff", False):
        old_bundle = load_latest_snapshot(SNAPSHOTS_DIR)
        if old_bundle:
            print("\n🔀 Computing diff against previous snapshot …")
            new_bundle = graphs_to_bundle(graphs)
            diff_G = compute_full_diff(old_bundle, new_bundle)
            summary = diff_summary(old_bundle, new_bundle)
            print("   " + summary.replace("\n", "\n   "))
            diff_path = os.path.join(out_dir, "diff.html")
            render_graph(diff_G, diff_path, "Architecture Diff")
            has_diff = True
        else:
            print("\n  (No previous snapshot found — skipping diff)")

    # ── 4. Save new snapshot ─────────────────────────────────────────────
    new_bundle = graphs_to_bundle(graphs)
    snap_path = save_snapshot(new_bundle, SNAPSHOTS_DIR, timestamp)
    print(f"\n💾 Snapshot saved: {snap_path}")

    # ── 5. Render HTML files ─────────────────────────────────────────────
    print("\n🎨 Rendering interactive HTML graphs …")
    for filename, name, description, nc, ec in graph_meta:
        G = graphs[{
            "1_module_dependencies.html": "module_deps",
            "2_api_routes.html":          "api_routes",
            "3_service_dependencies.html":"service_deps",
            "4_react_component_tree.html":"react_tree",
            "5_chat_data_flow.html":      "data_flow",
            "6_llm_routing_waterfall.html":"routing_waterfall",
        }[filename]]
        out_path = os.path.join(out_dir, filename)
        render_graph(G, out_path, name)
        print(f"   ✓  {filename}")

    # ── 6. Render index ──────────────────────────────────────────────────
    render_index(out_dir, graph_meta, timestamp, has_diff)
    print(f"   ✓  index.html")

    # ── Done ─────────────────────────────────────────────────────────────
    index_path = os.path.join(out_dir, "index.html")
    print(f"\n✅ Done!  Open in browser:")
    print(f"   file://{index_path}")
    print()

    # Quick circular dependency report
    _report_cycles(graphs["module_deps"])
    _report_cycles(graphs["service_deps"])


def _report_cycles(G: nx.DiGraph) -> None:
    """Print any circular dependency cycles found."""
    try:
        cycles = list(nx.simple_cycles(G))
        if cycles:
            print(f"⚠️  Circular dependencies in '{G.graph.get('name', 'graph')}':")
            for c in cycles[:5]:
                short_names = [os.path.basename(n).replace(".js","").replace(".py","") for n in c]
                print(f"   {' → '.join(short_names)} → {short_names[0]}")
            if len(cycles) > 5:
                print(f"   … and {len(cycles)-5} more")
    except Exception:
        pass


def list_snapshots() -> None:
    """List all existing snapshots."""
    import glob
    pattern = os.path.join(SNAPSHOTS_DIR, "snapshot_*.json")
    files = sorted(glob.glob(pattern))
    if not files:
        print("No snapshots found.")
        return
    print(f"Found {len(files)} snapshot(s):\n")
    for f in files:
        ts = os.path.basename(f).replace("snapshot_", "").replace(".json", "")
        size_kb = os.path.getsize(f) // 1024
        print(f"  {ts}  ({size_kb} KB)  →  {f}")


# ─────────────────────────────────────────────────────────────────────────
# CLI entry point
# ─────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="iMentor Codebase Graph Analyzer — generates interactive architecture graphs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--no-diff",  action="store_true", help="Skip diff graph generation")
    parser.add_argument("--list",     action="store_true", help="List previous snapshots and exit")
    args = parser.parse_args()

    if args.list:
        list_snapshots()
        return

    run_analysis(args)


if __name__ == "__main__":
    main()
