"""
Graph diff engine — compares the current graph snapshot against the previous one.
Produces a diff graph where nodes/edges are colored to show adds, removals, and modifications.
Snapshots are stored as JSON and never overwritten.
"""
import json
import os
import glob
from datetime import datetime
from typing import Optional, Dict, List, Tuple

import networkx as nx

from graph_analyzer.config import NODE_COLORS, EDGE_COLORS


# ── Snapshot format ───────────────────────────────────────────────────────

def graph_to_snapshot(G: nx.DiGraph, graph_name: str) -> dict:
    """Serialize a NetworkX graph to a JSON-serializable dict."""
    return {
        "name": graph_name,
        "nodes": {
            str(nid): {k: v for k, v in attrs.items() if k != "color"}  # skip color obj
            for nid, attrs in G.nodes(data=True)
        },
        "edges": [
            {
                "from": str(src),
                "to": str(dst),
                "label": attrs.get("label", ""),
                "edge_type": attrs.get("edge_type", ""),
            }
            for src, dst, attrs in G.edges(data=True)
        ],
    }


def graphs_to_bundle(graphs: Dict[str, nx.DiGraph]) -> dict:
    """Bundle multiple graph snapshots with metadata."""
    return {
        "timestamp": datetime.now().isoformat(),
        "graphs": {name: graph_to_snapshot(G, name) for name, G in graphs.items()},
    }


def save_snapshot(bundle: dict, snapshots_dir: str, timestamp: str) -> str:
    """Save a snapshot bundle to disk. Returns the saved file path."""
    os.makedirs(snapshots_dir, exist_ok=True)
    filename = os.path.join(snapshots_dir, f"snapshot_{timestamp}.json")
    with open(filename, "w", encoding="utf-8") as fh:
        json.dump(bundle, fh, indent=2, default=str)
    return filename


def load_latest_snapshot(snapshots_dir: str) -> Optional[dict]:
    """Load the most recent snapshot bundle from disk, if any."""
    pattern = os.path.join(snapshots_dir, "snapshot_*.json")
    files = sorted(glob.glob(pattern))
    if not files:
        return None
    with open(files[-1], "r", encoding="utf-8") as fh:
        return json.load(fh)


# ── Diff computation ──────────────────────────────────────────────────────

def _node_signature(node_attrs: dict) -> str:
    """A string signature for a node (for change detection)."""
    return f"{node_attrs.get('node_type','')}|{node_attrs.get('label','')}"


def _edge_key(edge: dict) -> str:
    return f"{edge['from']}→{edge['to']}|{edge.get('label','')}"


def compute_diff(
    old_bundle: dict,
    new_bundle: dict,
    graph_name: str = "module_dependencies",
) -> nx.DiGraph:
    """
    Compare old vs new snapshot for a given graph_name.
    Returns a diff graph where:
      - Green nodes/edges = added
      - Red nodes/edges = removed
      - Orange nodes/edges = modified (same id, different attributes)
      - Gray nodes/edges = unchanged
    """
    G = nx.DiGraph(name=f"Diff: {graph_name}")

    old_graph = old_bundle.get("graphs", {}).get(graph_name, {"nodes": {}, "edges": []})
    new_graph = new_bundle.get("graphs", {}).get(graph_name, {"nodes": {}, "edges": []})

    old_nodes = old_graph.get("nodes", {})
    new_nodes = new_graph.get("nodes", {})
    old_edges = {_edge_key(e): e for e in old_graph.get("edges", [])}
    new_edges = {_edge_key(e): e for e in new_graph.get("edges", [])}

    all_node_ids = set(old_nodes.keys()) | set(new_nodes.keys())

    for nid in all_node_ids:
        in_old = nid in old_nodes
        in_new = nid in new_nodes

        if in_new and not in_old:
            status = "added"
        elif in_old and not in_new:
            status = "removed"
        elif _node_signature(old_nodes[nid]) != _node_signature(new_nodes[nid]):
            status = "modified"
        else:
            status = "unchanged"

        attrs = new_nodes.get(nid, old_nodes.get(nid, {}))
        label = attrs.get("label", nid)
        status_labels = {
            "added": f"✚ {label}",
            "removed": f"✖ {label}",
            "modified": f"● {label}",
            "unchanged": label,
        }
        color = NODE_COLORS.get(status, NODE_COLORS["default"])
        G.add_node(
            nid,
            label=status_labels[status],
            title=f"[{status.upper()}] {attrs.get('title', label)}",
            color=color,
            size=18 if status == "unchanged" else 24,
            node_type=status,
            diff_status=status,
        )

    all_edge_keys = set(old_edges.keys()) | set(new_edges.keys())

    for ekey in all_edge_keys:
        in_old = ekey in old_edges
        in_new = ekey in new_edges

        if in_new and not in_old:
            status = "added"
            edge = new_edges[ekey]
        elif in_old and not in_new:
            status = "removed"
            edge = old_edges[ekey]
        else:
            status = "unchanged"
            edge = new_edges[ekey]

        src, dst = edge["from"], edge["to"]
        # Only add edge if both endpoints exist in the diff graph
        if src in G and dst in G:
            G.add_edge(
                src, dst,
                label=edge.get("label", ""),
                color={"color": EDGE_COLORS.get(status, "#546E7A"), "opacity": 0.8},
                edge_type=status,
            )

    return G


def compute_full_diff(old_bundle: dict, new_bundle: dict) -> nx.DiGraph:
    """
    Build a combined diff graph across ALL graphs in the bundles.
    Good for a single 'what changed' view.
    """
    G = nx.DiGraph(name="Full Architecture Diff")

    # Combine all graph names
    all_graph_names = (
        set(old_bundle.get("graphs", {}).keys()) |
        set(new_bundle.get("graphs", {}).keys())
    )

    for graph_name in all_graph_names:
        sub_diff = compute_diff(old_bundle, new_bundle, graph_name)
        # Only add non-unchanged nodes/edges to reduce noise
        for nid, attrs in sub_diff.nodes(data=True):
            if attrs.get("diff_status", "unchanged") != "unchanged":
                if nid not in G:
                    G.add_node(nid, **attrs)
        for src, dst, attrs in sub_diff.edges(data=True):
            if attrs.get("edge_type", "unchanged") != "unchanged":
                if src in G and dst in G and not G.has_edge(src, dst):
                    G.add_edge(src, dst, **attrs)

    if len(G.nodes()) == 0:
        # No changes — add a sentinel node
        G.add_node(
            "no_changes",
            label="No architectural changes\ndetected since last run",
            title="All nodes and edges are identical to the previous snapshot.",
            color=NODE_COLORS["unchanged"],
            size=30,
            node_type="unchanged",
        )

    return G


def diff_summary(old_bundle: dict, new_bundle: dict) -> str:
    """Return a human-readable summary string of changes."""
    lines = []
    old_ts = old_bundle.get("timestamp", "unknown")
    new_ts = new_bundle.get("timestamp", "unknown")
    lines.append(f"Previous snapshot: {old_ts}")
    lines.append(f"Current snapshot:  {new_ts}")
    lines.append("")

    all_graph_names = (
        set(old_bundle.get("graphs", {}).keys()) |
        set(new_bundle.get("graphs", {}).keys())
    )
    total_added = total_removed = total_modified = 0

    for gname in sorted(all_graph_names):
        old_g = old_bundle.get("graphs", {}).get(gname, {"nodes": {}, "edges": []})
        new_g = new_bundle.get("graphs", {}).get(gname, {"nodes": {}, "edges": []})
        old_nodes = set(old_g.get("nodes", {}).keys())
        new_nodes = set(new_g.get("nodes", {}).keys())
        added = new_nodes - old_nodes
        removed = old_nodes - new_nodes
        modified = {
            nid for nid in old_nodes & new_nodes
            if _node_signature(old_g["nodes"][nid]) != _node_signature(new_g["nodes"][nid])
        }
        if added or removed or modified:
            lines.append(f"[{gname}]")
            if added:   lines.append(f"  + Added:    {', '.join(sorted(added)[:5])}" + (" ..." if len(added) > 5 else ""))
            if removed: lines.append(f"  - Removed:  {', '.join(sorted(removed)[:5])}" + (" ..." if len(removed) > 5 else ""))
            if modified: lines.append(f"  ~ Modified: {', '.join(sorted(modified)[:5])}" + (" ..." if len(modified) > 5 else ""))
            lines.append("")
            total_added += len(added)
            total_removed += len(removed)
            total_modified += len(modified)

    if total_added == 0 and total_removed == 0 and total_modified == 0:
        lines.append("✓ No changes detected across all graphs.")
    else:
        lines.append(f"Summary: +{total_added} added, -{total_removed} removed, ~{total_modified} modified")

    return "\n".join(lines)
