"""
Concept map visualisation using pyvis (already installed for the codebase analyzer).
Produces an interactive HTML graph matching the dark aesthetic of the other graphs.
"""
import json
import os
import networkx as nx
from pyvis.network import Network
from typing import List, Optional

from lecture_generator.concept_extractor import KnowledgeGraph

# ── Importance → visual style ──────────────────────────────────────────
_IMPORTANCE_STYLE = {
    "core":       {"color": {"background": "#1565C0", "border": "#0D47A1",
                              "highlight": {"background": "#1E88E5", "border": "#0D47A1"}}, "size": 30},
    "supporting": {"color": {"background": "#E65100", "border": "#BF360C",
                              "highlight": {"background": "#FB8C00", "border": "#BF360C"}}, "size": 22},
    "detail":     {"color": {"background": "#1B5E20", "border": "#4CAF50",
                              "highlight": {"background": "#43A047", "border": "#1B5E20"}}, "size": 16},
}

# ── Relationship type → edge color ─────────────────────────────────────
_REL_COLORS = {
    "requires":       "#F44336",   # red — dependency
    "leads_to":       "#4CAF50",   # green — progression
    "part_of":        "#9C27B0",   # purple — hierarchy
    "example_of":     "#00BCD4",   # cyan — instantiation
    "contrasts_with": "#FF9800",   # orange — comparison
    "generalizes":    "#3F51B5",   # indigo — abstraction
}

_VIS_OPTIONS = {
    "nodes": {
        "shape": "dot",
        "font": {"size": 14, "color": "#ECEFF1", "face": "monospace"},
        "borderWidth": 2,
        "shadow": {"enabled": True},
    },
    "edges": {
        "arrows": {"to": {"enabled": True, "scaleFactor": 0.7}},
        "smooth": {"type": "curvedCW", "roundness": 0.15},
        "font": {"size": 10, "color": "#B0BEC5", "strokeWidth": 0},
    },
    "physics": {
        "solver": "forceAtlas2Based",
        "forceAtlas2Based": {
            "gravitationalConstant": -80,
            "centralGravity": 0.01,
            "springLength": 160,
            "springConstant": 0.05,
            "avoidOverlap": 0.5,
        },
        "stabilization": {"iterations": 250},
    },
    "interaction": {
        "hover": True,
        "navigationButtons": True,
        "keyboard": True,
    },
}

_SEARCH_JS = """
<script>
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        if (typeof network === 'undefined') return;

        // Build search box
        var box = document.createElement('div');
        box.style.cssText = 'position:fixed;top:12px;left:12px;z-index:9999;' +
            'background:rgba(13,13,26,.95);padding:12px;border-radius:8px;' +
            'border:1px solid #334;font-family:monospace;min-width:220px;';
        box.innerHTML = '<div style="color:#90CAF9;font-size:13px;font-weight:bold;margin-bottom:8px;">🗺 Concept Map</div>' +
            '<input id="cm-search" type="text" placeholder="Search concept…" ' +
            'style="width:100%;padding:6px;border-radius:4px;border:1px solid #445;' +
            'background:#1E1E2E;color:#ECE;font-size:12px;box-sizing:border-box;" ' +
            'oninput="cmSearch(this.value)">' +
            '<div id="cm-stats" style="color:#546E7A;font-size:10px;margin-top:6px;"></div>';
        document.body.appendChild(box);

        // Stats
        var ns = network.body.data.nodes.get().length;
        var es = network.body.data.edges.get().length;
        document.getElementById('cm-stats').textContent = ns + ' concepts · ' + es + ' relationships';

        // Keyboard shortcut
        document.addEventListener('keydown', function(e) {
            if (e.key === '/') { e.preventDefault(); document.getElementById('cm-search').focus(); }
            if (e.key === 'Escape') { document.getElementById('cm-search').value=''; cmSearch(''); }
        });
    }, 600);
});

function cmSearch(q) {
    q = q.toLowerCase().trim();
    var nodes = network.body.data.nodes.get();
    network.body.data.nodes.update(nodes.map(function(n) {
        var match = !q || (n.label||'').toLowerCase().includes(q) || (n.title||'').toLowerCase().includes(q);
        return { id: n.id, opacity: match ? 1 : 0.08 };
    }));
    if (q) {
        var first = nodes.find(function(n) { return (n.label||'').toLowerCase().includes(q); });
        if (first) network.focus(first.id, { scale: 1.4, animation: { duration: 400 } });
    }
}
</script>
"""


def build_concept_map(
    kg: KnowledgeGraph,
    output_path: str,
    coverage: Optional[dict] = None,   # concept_id → ConceptCoverage
) -> None:
    """
    Build an interactive pyvis concept map and save to output_path.
    """
    G = nx.DiGraph()

    # Add concept nodes
    concept_by_id = {c.id: c for c in kg.concepts}
    for concept in kg.concepts:
        style = _IMPORTANCE_STYLE.get(concept.importance, _IMPORTANCE_STYLE["supporting"])
        cov = coverage.get(concept.id) if coverage else None

        # Build tooltip
        tooltip_parts = [
            f"<b>{concept.label}</b>",
            f"<i>{concept.importance.upper()}</i>",
            "",
            concept.description,
        ]
        if concept.has_math:
            tooltip_parts.append("<br>📐 Involves math/formulas")
        if cov and cov.lecture_indices:
            lec_str = ", ".join(f"Lecture {i}" for i in sorted(cov.lecture_indices))
            tooltip_parts.append(f"<br>📖 Covered in: {lec_str}")
            if cov.is_cross_lecture:
                tooltip_parts.append("<br>🔗 <b>Cross-lecture concept</b>")
        elif cov:
            tooltip_parts.append("<br>⚪ Not found in source files")

        # Label: add lecture tag if coverage data available
        label = concept.label
        if cov and cov.lecture_indices:
            label = f"{concept.label}\n({cov.lecture_label})"

        # Increase size for cross-lecture concepts (they're structurally important)
        size = style["size"]
        if cov and cov.is_cross_lecture:
            size = min(size + cov.lecture_count * 3, 50)

        G.add_node(
            concept.id,
            label=label,
            title="<br>".join(tooltip_parts),
            color=style["color"],
            size=size,
        )

    # Add relationship edges
    for rel in kg.relationships:
        if rel.source in concept_by_id and rel.target in concept_by_id:
            G.add_edge(
                rel.source,
                rel.target,
                label=rel.label,
                color={"color": _REL_COLORS.get(rel.rel_type, "#546E7A"), "opacity": 0.8},
                title=rel.rel_type,
            )

    # Build pyvis network
    net = Network(
        height="100vh",
        width="100%",
        bgcolor="#0D0D1A",
        font_color="#ECEFF1",
        directed=True,
        notebook=False,
    )
    net.set_options(json.dumps(_VIS_OPTIONS))

    for nid, attrs in G.nodes(data=True):
        net.add_node(str(nid), **attrs)
    for src, dst, attrs in G.edges(data=True):
        net.add_edge(str(src), str(dst), **attrs)

    net.write_html(output_path)

    # Inject search widget
    with open(output_path, "r", encoding="utf-8") as fh:
        html = fh.read()
    html = html.replace("</body>", _SEARCH_JS + "\n</body>")
    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(html)
