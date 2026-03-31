"""
Interactive HTML visualization using pyvis + custom search/filter UI.
All outputs are self-contained HTML files (no server needed).
"""
import json
import os
import re
import networkx as nx
from pyvis.network import Network

from graph_analyzer.config import VIS_OPTIONS, NODE_COLORS, NODE_TYPE_LABELS, EDGE_COLORS


# ─────────────────────────────────────────────────────────────────────────
# Search + filter panel injected into every HTML file
# ─────────────────────────────────────────────────────────────────────────

_CONTROLS_HTML = """
<!-- ── Graph Controls Panel ────────────────────────────────────────── -->
<div id="controls-panel" style="
    position: fixed; top: 12px; left: 12px; z-index: 9999;
    background: rgba(18,18,28,0.95); padding: 14px 16px;
    border-radius: 10px; border: 1px solid #334;
    min-width: 240px; max-width: 280px; font-family: monospace;
    box-shadow: 0 4px 24px rgba(0,0,0,0.6);
">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
    <span style="color:#90CAF9; font-weight:bold; font-size:14px;">🔭 Graph Explorer</span>
    <button onclick="togglePanel()" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;" id="toggle-btn">▲</button>
  </div>
  <div id="panel-body">
    <!-- Search -->
    <div style="margin-bottom:10px;">
      <input id="graph-search" type="text" placeholder="Search nodes…"
        style="width:100%;padding:7px 10px;border-radius:6px;border:1px solid #445;
               background:#1E1E2E;color:#ECEFF1;font-size:12px;box-sizing:border-box;outline:none;"
        oninput="liveSearch(this.value)" />
      <div style="display:flex;gap:4px;margin-top:5px;">
        <button onclick="clearSearch()" style="flex:1;padding:4px;background:#263238;color:#90CAF9;border:1px solid #445;border-radius:4px;cursor:pointer;font-size:11px;">Clear</button>
        <button onclick="showNeighbors()" style="flex:1;padding:4px;background:#263238;color:#A5D6A7;border:1px solid #445;border-radius:4px;cursor:pointer;font-size:11px;">Neighbors</button>
        <button onclick="resetView()" style="flex:1;padding:4px;background:#263238;color:#FFCC80;border:1px solid #445;border-radius:4px;cursor:pointer;font-size:11px;">Reset</button>
      </div>
    </div>

    <!-- Stats -->
    <div id="graph-stats" style="color:#78909C;font-size:11px;margin-bottom:10px;padding:6px;background:#1A1A2A;border-radius:4px;">
      Loading…
    </div>

    <!-- Type filters -->
    <div style="color:#607D8B;font-size:10px;letter-spacing:1px;margin-bottom:5px;">FILTER BY TYPE</div>
    <div id="type-filters" style="max-height:200px;overflow-y:auto;padding-right:4px;"></div>

    <!-- Legend -->
    <div style="color:#607D8B;font-size:10px;letter-spacing:1px;margin:10px 0 5px 0;border-top:1px solid #334;padding-top:8px;">LEGEND</div>
    <div id="legend" style="max-height:180px;overflow-y:auto;padding-right:4px;"></div>
  </div>
</div>

<!-- ── Node Info Panel ────────────────────────────────────────────────── -->
<div id="node-info" style="
    position:fixed; top:12px; right:12px; z-index:9999;
    background:rgba(18,18,28,0.95); padding:14px 16px;
    border-radius:10px; border:1px solid #334;
    min-width:200px; max-width:300px; font-family:monospace;
    box-shadow:0 4px 24px rgba(0,0,0,0.6); display:none;
">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <span style="color:#A5D6A7;font-weight:bold;font-size:13px;">📌 Node Details</span>
    <button onclick="document.getElementById('node-info').style.display='none'"
            style="background:none;border:none;color:#888;cursor:pointer;font-size:15px;">✕</button>
  </div>
  <div id="node-info-content" style="color:#B0BEC5;font-size:12px;line-height:1.6;word-break:break-all;"></div>
</div>
"""

_CONTROLS_JS = """
<script>
// ── State ──────────────────────────────────────────────────────────────
var allNodesData = {};
var allEdgesData = {};
var hiddenTypes = new Set();
var selectedNodeId = null;
var searchActive = false;

// ── Bootstrap ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initControls, 800);  // Wait for pyvis network to init
});

function initControls() {
    if (typeof network === 'undefined') { setTimeout(initControls, 300); return; }

    // Snapshot original node data
    network.body.data.nodes.get().forEach(function(n) {
        allNodesData[n.id] = JSON.parse(JSON.stringify(n));
    });
    network.body.data.edges.get().forEach(function(e) {
        allEdgesData[e.id || e.from + '_' + e.to] = e;
    });

    updateStats();
    buildTypeFilters();
    buildLegend();

    // Click handler → show node info
    network.on('click', function(params) {
        if (params.nodes.length > 0) {
            showNodeInfo(params.nodes[0]);
        } else {
            document.getElementById('node-info').style.display = 'none';
        }
    });

    // Double-click → focus neighborhood
    network.on('doubleClick', function(params) {
        if (params.nodes.length > 0) {
            selectedNodeId = params.nodes[0];
            showNeighbors();
        }
    });
}

// ── Stats ────────────────────────────────────────────────────────────
function updateStats() {
    var nodes = network.body.data.nodes.get();
    var edges = network.body.data.edges.get();
    var types = {};
    nodes.forEach(function(n) {
        var t = (n.node_type || 'unknown');
        types[t] = (types[t] || 0) + 1;
    });
    var typeStr = Object.entries(types).map(function(e) { return e[0]+':'+e[1]; }).join(' | ');
    document.getElementById('graph-stats').innerHTML =
        '<b>' + nodes.length + '</b> nodes &nbsp;·&nbsp; <b>' + edges.length + '</b> edges<br>' +
        '<span style="font-size:10px;color:#546E7A;">' + typeStr + '</span>';
}

// ── Search ────────────────────────────────────────────────────────────
function liveSearch(query) {
    query = query.trim().toLowerCase();
    var allNodes = network.body.data.nodes.get();
    searchActive = query.length > 0;
    var updates = allNodes.map(function(n) {
        var label = (n.label || '').toLowerCase();
        var title = (n.title || '').toLowerCase();
        var matches = !searchActive || label.includes(query) || title.includes(query);
        return {
            id: n.id,
            opacity: matches ? 1.0 : 0.08,
            color: matches
                ? (allNodesData[n.id] ? allNodesData[n.id].color : n.color)
                : { background: '#1A1A2A', border: '#2A2A3A',
                    highlight: { background: '#1A1A2A', border: '#2A2A3A' } }
        };
    });
    network.body.data.nodes.update(updates);
    // Focus first match
    if (searchActive) {
        var first = allNodes.find(function(n) {
            return (n.label||'').toLowerCase().includes(query) || (n.title||'').toLowerCase().includes(query);
        });
        if (first) network.focus(first.id, { scale: 1.3, animation: { duration: 400 } });
    }
}

function clearSearch() {
    document.getElementById('graph-search').value = '';
    liveSearch('');
    searchActive = false;
}

function resetView() {
    clearSearch();
    hiddenTypes.clear();
    document.querySelectorAll('.type-checkbox').forEach(function(cb) { cb.checked = true; });
    var allNodes = network.body.data.nodes.get();
    var updates = allNodes.map(function(n) {
        var orig = allNodesData[n.id];
        return { id: n.id, opacity: 1, hidden: false,
                 color: orig ? orig.color : n.color };
    });
    network.body.data.nodes.update(updates);
    network.fit({ animation: { duration: 600 } });
}

// ── Neighbor Highlight ────────────────────────────────────────────────
function showNeighbors() {
    var sel = network.getSelectedNodes();
    if (sel.length === 0) { alert('Select a node first (click it)'); return; }
    var nodeId = sel[0];
    var connected = network.getConnectedNodes(nodeId);
    var connectedSet = new Set(connected);
    connectedSet.add(nodeId);
    var allNodes = network.body.data.nodes.get();
    var updates = allNodes.map(function(n) {
        return {
            id: n.id,
            opacity: connectedSet.has(n.id) ? 1.0 : 0.05,
        };
    });
    network.body.data.nodes.update(updates);
}

// ── Node Info Panel ────────────────────────────────────────────────────
function showNodeInfo(nodeId) {
    var node = network.body.data.nodes.get(nodeId);
    if (!node) return;
    var connected = network.getConnectedNodes(nodeId);
    var edges = network.getConnectedEdges(nodeId);
    var inEdges = edges.filter(function(eid) {
        var e = network.body.data.edges.get(eid);
        return e && e.to === nodeId;
    });
    var outEdges = edges.filter(function(eid) {
        var e = network.body.data.edges.get(eid);
        return e && e.from === nodeId;
    });
    var html = '<b style="color:#FFF9C4;">' + (node.label || nodeId) + '</b><br>' +
               '<span style="color:#90CAF9;">Type: ' + (node.node_type || 'unknown') + '</span><br>' +
               '<span style="color:#A5D6A7;">In-edges: ' + inEdges.length + '</span><br>' +
               '<span style="color:#FFAB91;">Out-edges: ' + outEdges.length + '</span><br>' +
               '<span style="color:#B0BEC5;">Neighbors: ' + connected.length + '</span><br>';
    if (node.title && node.title !== node.label) {
        html += '<hr style="border-color:#334;margin:6px 0;">' +
                '<span style="color:#78909C;word-break:break-all;">' + node.title + '</span>';
    }
    document.getElementById('node-info-content').innerHTML = html;
    document.getElementById('node-info').style.display = 'block';
}

// ── Type Filters ───────────────────────────────────────────────────────
function buildTypeFilters() {
    var allNodes = network.body.data.nodes.get();
    var types = {};
    allNodes.forEach(function(n) {
        var t = n.node_type || 'default';
        if (!types[t]) types[t] = { count: 0, color: getNodeColor(n) };
        types[t].count++;
    });

    var container = document.getElementById('type-filters');
    container.innerHTML = '';
    Object.entries(types).sort().forEach(function(entry) {
        var t = entry[0], info = entry[1];
        var div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;';
        div.innerHTML =
            '<input type="checkbox" class="type-checkbox" checked id="filter_' + t + '" ' +
            'onchange="toggleType(\\'' + t + '\\', this.checked)">' +
            '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;' +
            'background:' + info.color + ';flex-shrink:0;"></span>' +
            '<label for="filter_' + t + '" style="color:#B0BEC5;font-size:11px;cursor:pointer;">' +
            t + ' <span style="color:#546E7A;">(' + info.count + ')</span></label>';
        container.appendChild(div);
    });
}

function getNodeColor(node) {
    if (!node.color) return '#607D8B';
    if (typeof node.color === 'string') return node.color;
    if (node.color.background) return node.color.background;
    return '#607D8B';
}

function toggleType(typeName, visible) {
    if (!visible) hiddenTypes.add(typeName); else hiddenTypes.delete(typeName);
    var allNodes = network.body.data.nodes.get();
    var updates = allNodes
        .filter(function(n) { return (n.node_type || 'default') === typeName; })
        .map(function(n) { return { id: n.id, hidden: !visible }; });
    network.body.data.nodes.update(updates);
}

// ── Legend ─────────────────────────────────────────────────────────────
var NODE_TYPE_LABELS = NODE_TYPE_LABELS_JSON;
function buildLegend() {
    var allNodes = network.body.data.nodes.get();
    var seenTypes = new Set();
    allNodes.forEach(function(n) { seenTypes.add(n.node_type || 'default'); });
    var container = document.getElementById('legend');
    container.innerHTML = '';
    seenTypes.forEach(function(t) {
        var label = NODE_TYPE_LABELS[t] || t;
        var color = getTypeColor(t);
        var div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:3px;';
        div.innerHTML =
            '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;' +
            'background:' + color + ';flex-shrink:0;"></span>' +
            '<span style="color:#90A4AE;font-size:10px;">' + label + '</span>';
        container.appendChild(div);
    });
}

var NODE_COLORS_MAP = NODE_COLORS_JSON;
function getTypeColor(t) {
    var c = NODE_COLORS_MAP[t];
    if (!c) return '#607D8B';
    if (typeof c === 'string') return c;
    return c.background || '#607D8B';
}

// ── Panel Toggle ───────────────────────────────────────────────────────
function togglePanel() {
    var body = document.getElementById('panel-body');
    var btn = document.getElementById('toggle-btn');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        btn.textContent = '▲';
    } else {
        body.style.display = 'none';
        btn.textContent = '▼';
    }
}

// Keyboard shortcut: / = focus search
document.addEventListener('keydown', function(e) {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('graph-search').focus();
    }
    if (e.key === 'Escape') {
        clearSearch();
        document.getElementById('graph-search').blur();
        document.getElementById('node-info').style.display = 'none';
    }
});
</script>
"""


def _inject_controls(html_content: str, graph_name: str, node_colors: dict, node_type_labels: dict) -> str:
    """Inject search/filter controls into a pyvis-generated HTML file."""

    # Embed the color map and label map as JS variables
    colors_js = f"var NODE_COLORS_JSON = {json.dumps(node_colors)};"
    labels_js = f"var NODE_TYPE_LABELS_JSON = {json.dumps(node_type_labels)};"

    controls_js_with_data = _CONTROLS_JS.replace(
        "var NODE_TYPE_LABELS = NODE_TYPE_LABELS_JSON;",
        labels_js + "\nvar NODE_TYPE_LABELS = NODE_TYPE_LABELS_JSON;"
    ).replace(
        "var NODE_COLORS_MAP = NODE_COLORS_JSON;",
        colors_js + "\nvar NODE_COLORS_MAP = NODE_COLORS_JSON;"
    )

    # Build title bar
    title_bar = f"""
<div style="position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:9999;
     background:rgba(18,18,28,0.9);padding:6px 18px;border-radius:20px;
     border:1px solid #334;color:#607D8B;font-family:monospace;font-size:12px;
     white-space:nowrap;">
  {graph_name} &nbsp;·&nbsp; <span style="color:#4FC3F7;">Press / to search</span> &nbsp;·&nbsp; <span style="color:#A5D6A7;">Double-click = neighbors</span> &nbsp;·&nbsp; <span style="color:#FFCC80;">Scroll = zoom</span>
</div>"""

    # Inject before </body>
    inject = _CONTROLS_HTML + title_bar + controls_js_with_data
    if "</body>" in html_content:
        return html_content.replace("</body>", inject + "\n</body>")
    return html_content + inject


def build_pyvis_network(G: nx.DiGraph, height: str = "100vh") -> Network:
    """Convert a NetworkX graph to a pyvis Network."""
    net = Network(
        height=height,
        width="100%",
        bgcolor="#0D0D1A",
        font_color="#ECEFF1",
        directed=True,
        notebook=False,
    )
    net.set_options(json.dumps(VIS_OPTIONS))

    for node_id, attrs in G.nodes(data=True):
        label = attrs.get("label", str(node_id))
        title = attrs.get("title", str(node_id))
        color = attrs.get("color", NODE_COLORS["default"])
        size = attrs.get("size", 18)
        node_type = attrs.get("node_type", "default")

        net.add_node(
            str(node_id),
            label=label,
            title=title,
            color=color,
            size=size,
            node_type=node_type,
        )

    for src, dst, attrs in G.edges(data=True):
        label = attrs.get("label", "")
        color = attrs.get("color", {"color": "#546E7A", "opacity": 0.75})
        edge_type = attrs.get("edge_type", "default")
        net.add_edge(str(src), str(dst), label=label, color=color, edge_type=edge_type)

    return net


def render_graph(
    G: nx.DiGraph,
    output_path: str,
    graph_name: str,
    height: str = "100vh",
) -> None:
    """Render a NetworkX graph to an interactive HTML file."""
    net = build_pyvis_network(G, height)

    # Write to temp file first
    net.write_html(output_path)

    # Read back and inject controls
    with open(output_path, "r", encoding="utf-8") as fh:
        html = fh.read()

    # Prepare simplified color map for JS (just background hex per type)
    simplified_colors = {
        k: (v["background"] if isinstance(v, dict) else v)
        for k, v in NODE_COLORS.items()
    }

    html = _inject_controls(html, graph_name, simplified_colors, NODE_TYPE_LABELS)

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(html)


def render_index(
    output_dir: str,
    graphs: list,  # [(filename, graph_name, description, node_count, edge_count)]
    timestamp: str,
    has_diff: bool,
) -> None:
    """Render a dashboard HTML index page linking to all graph files."""
    cards_html = ""
    for filename, name, description, nc, ec in graphs:
        cards_html += f"""
        <a href="{filename}" class="graph-card">
          <div class="card-title">{name}</div>
          <div class="card-desc">{description}</div>
          <div class="card-stats">
            <span class="badge blue">{nc} nodes</span>
            <span class="badge orange">{ec} edges</span>
          </div>
        </a>"""

    if has_diff:
        cards_html += """
        <a href="diff.html" class="graph-card diff-card">
          <div class="card-title">🔀 Architecture Diff</div>
          <div class="card-desc">Changes since previous analysis run</div>
          <div class="card-stats">
            <span class="badge green">Added</span>
            <span class="badge red">Removed</span>
            <span class="badge orange">Modified</span>
          </div>
        </a>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>iMentor Architecture Graphs — {timestamp}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ background: #0D0D1A; color: #ECEFF1; font-family: 'Segoe UI', monospace; }}
    .header {{ background: linear-gradient(135deg, #1A1A2E 0%, #16213E 100%);
               padding: 40px 60px; border-bottom: 1px solid #334; }}
    .header h1 {{ font-size: 28px; color: #90CAF9; margin-bottom: 8px; }}
    .header p {{ color: #607D8B; font-size: 14px; }}
    .header .ts {{ color: #A5D6A7; font-size: 12px; margin-top: 6px; font-family: monospace; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
             gap: 20px; padding: 40px 60px; }}
    .graph-card {{
      background: #1A1A2E; border: 1px solid #334; border-radius: 12px;
      padding: 24px; text-decoration: none; color: inherit; transition: all 0.2s;
      display: flex; flex-direction: column; gap: 10px;
    }}
    .graph-card:hover {{ border-color: #90CAF9; transform: translateY(-2px);
                         box-shadow: 0 8px 24px rgba(0,0,0,0.4); background: #1E1E2E; }}
    .diff-card {{ border-color: #FF9800; }}
    .diff-card:hover {{ border-color: #FFCC02; }}
    .card-title {{ font-size: 16px; font-weight: bold; color: #90CAF9; }}
    .diff-card .card-title {{ color: #FFCC80; }}
    .card-desc {{ font-size: 13px; color: #607D8B; line-height: 1.5; flex: 1; }}
    .card-stats {{ display: flex; gap: 8px; flex-wrap: wrap; }}
    .badge {{ padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; }}
    .blue  {{ background: #0D47A1; color: #90CAF9; }}
    .orange {{ background: #BF360C; color: #FFAB91; }}
    .green {{ background: #1B5E20; color: #A5D6A7; }}
    .red   {{ background: #B71C1C; color: #EF9A9A; }}
    .footer {{ text-align: center; padding: 30px; color: #37474F; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="header">
    <h1>🗺️ iMentor Architecture Knowledge Graphs</h1>
    <p>Interactive visualization of the codebase structure, API routing, service dependencies, and data flow.</p>
    <div class="ts">Generated: {timestamp} &nbsp;·&nbsp; Click any card to open the interactive graph</div>
  </div>
  <div class="grid">{cards_html}
  </div>
  <div class="footer">
    Each graph is a self-contained HTML file with zoom, pan, search (press /) and click-to-inspect.<br>
    Diff graphs highlight architectural changes since the previous run.
  </div>
</body>
</html>"""

    index_path = os.path.join(output_dir, "index.html")
    with open(index_path, "w", encoding="utf-8") as fh:
        fh.write(html)
