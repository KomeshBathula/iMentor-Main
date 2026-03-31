"""
Renders lecture notes to:
  1. Markdown (.md) — portable, plain
  2. Self-contained HTML (.html) — beautiful, interactive
     KaTeX (math) and Mermaid (diagrams) render client-side from CDN.
     The CDN only serves JS/CSS libraries — your content never leaves the machine.

Mirrors the output quality expected from the iMentor subtopic notes system.
"""
import os
import re
from datetime import datetime
from typing import List, Optional, Tuple

from lecture_generator.concept_extractor import Concept, KnowledgeGraph
from lecture_generator.note_writer import ConceptNote


# ── Markdown renderer ──────────────────────────────────────────────────

def _escape_md(text: str) -> str:
    return text  # Keep LaTeX intact; avoid over-escaping


def to_markdown(
    kg: KnowledgeGraph,
    notes: List[Tuple[Concept, Optional[ConceptNote]]],
    concept_map_rel_path: Optional[str] = None,
) -> str:
    concept_map_path = concept_map_rel_path  # alias for backwards compat
    lines = []
    ts = datetime.now().strftime("%Y-%m-%d")

    lines += [
        f"# {kg.title}",
        f"*Generated {ts} · iMentor Lecture Generator · Local SGLang*",
        "",
        "---",
        "",
        "## Overview",
        "",
        kg.summary,
        "",
        "### Learning Objectives",
        "",
    ]
    for obj in kg.learning_objectives:
        lines.append(f"- {obj}")

    lines += ["", "---", "", "## Concept Map", ""]
    if concept_map_path:
        lines.append(f"> Interactive concept map: [{os.path.basename(concept_map_path)}]({os.path.basename(concept_map_path)})")
    lines.append("")

    # Table of contents
    lines += ["## Contents", ""]
    for i, (concept, _) in enumerate(notes, 1):
        anchor = re.sub(r"[^a-z0-9-]", "", concept.label.lower().replace(" ", "-"))
        lines.append(f"{i}. [{concept.label}](#{anchor}) — *{concept.importance}*")
    lines.append("")

    # Concept sections
    for i, (concept, note) in enumerate(notes, 1):
        anchor = re.sub(r"[^a-z0-9-]", "", concept.label.lower().replace(" ", "-"))
        lines += ["---", "", f"## {i}. {concept.label} {{#{anchor}}}", ""]

        if note is None:
            lines += [f"> ⚠️ Note generation failed for this concept.", "", concept.description, ""]
            continue

        # Definition
        lines += ["### Definition", "", note.definition, ""]

        # Intuition
        lines += ["### Intuition", "", note.intuition, ""]

        # Math
        if note.math.has_math and note.math.formulas:
            lines += ["### Mathematical Formulation", ""]
            for formula in note.math.formulas:
                lines += [
                    f"**{formula.label}**",
                    "",
                    f"$$\n{formula.latex}\n$$",
                    "",
                    f"*{formula.meaning}*",
                    "",
                ]

        # Diagram
        if note.mermaid_diagram:
            lines += [
                "### Diagram",
                "",
                "```mermaid",
                note.mermaid_diagram,
                "```",
                "",
            ]
            if note.mermaid_caption:
                lines += [f"*{note.mermaid_caption}*", ""]

        # Examples
        if note.examples:
            lines += ["### Examples", ""]
            for ex in note.examples:
                lines += [f"#### {ex.title}", "", ex.content, ""]

        # Key takeaways
        if note.key_takeaways:
            lines += ["### Key Takeaways", ""]
            for pt in note.key_takeaways:
                lines.append(f"- {pt}")
            lines.append("")

        # Misconceptions
        if note.misconceptions:
            lines += ["### Common Misconceptions", ""]
            for m in note.misconceptions:
                lines.append(f"- ⚠️ {m}")
            lines.append("")

    lines += ["---", "", f"*End of lecture notes: {kg.title}*", ""]
    return "\n".join(lines)


# ── HTML renderer ──────────────────────────────────────────────────────

_HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — Lecture Notes</title>

  <!-- KaTeX: math renders client-side from the KaTeX library only.
       Your LaTeX content NEVER leaves this machine. -->
  <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script defer
        src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script defer
        src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
        onload="renderMathInElement(document.body, {{
          delimiters: [
            {{left:'$$', right:'$$', display:true}},
            {{left:'$', right:'$', display:false}},
            {{left:'\\\\[', right:'\\\\]', display:true}},
            {{left:'\\\\(', right:'\\\\)', display:false}}
          ],
          throwOnError: false
        }});">
  </script>

  <!-- Mermaid: diagrams render client-side only. Your diagram code stays local. -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({{
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {{
        background: '#0D0D1A',
        primaryColor: '#1565C0',
        primaryTextColor: '#ECEFF1',
        lineColor: '#546E7A',
        edgeLabelBackground: '#1A1A2E',
        fontFamily: 'monospace'
      }}
    }});
  </script>

  <style>
    :root {{
      --bg:       #0D0D1A;
      --surface:  #1A1A2E;
      --border:   #2A2A3E;
      --text:     #ECEFF1;
      --muted:    #78909C;
      --accent1:  #90CAF9;
      --accent2:  #A5D6A7;
      --warn:     #FFCC80;
      --core:     #1565C0;
      --support:  #E65100;
      --detail:   #1B5E20;
      --sidebar-w: 280px;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    html {{ scroll-behavior: smooth; }}

    body {{
      background: var(--bg);
      color: var(--text);
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 15px;
      line-height: 1.7;
      display: flex;
    }}

    /* ── Sidebar ─────────────────────────────── */
    #sidebar {{
      width: var(--sidebar-w);
      min-width: var(--sidebar-w);
      height: 100vh;
      position: sticky;
      top: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 20px 14px;
      flex-shrink: 0;
    }}
    #sidebar h2 {{
      color: var(--accent1);
      font-size: 12px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }}
    #sidebar .toc-item {{
      display: block;
      padding: 5px 8px;
      border-radius: 5px;
      text-decoration: none;
      color: var(--muted);
      font-size: 13px;
      transition: all .15s;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}
    #sidebar .toc-item:hover {{ background: rgba(144,202,249,.1); color: var(--accent1); }}
    #sidebar .toc-item.core {{
      color: #90CAF9; font-weight: 600;
    }}
    #sidebar .toc-item.supporting {{ color: #FFAB91; }}
    #sidebar .toc-item.detail {{ color: #A5D6A7; }}
    .toc-badge {{
      display: inline-block;
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 8px;
      margin-left: 4px;
      vertical-align: middle;
    }}
    .badge-core    {{ background: #0D47A1; color: #90CAF9; }}
    .badge-support {{ background: #BF360C; color: #FFAB91; }}
    .badge-detail  {{ background: #1B5E20; color: #A5D6A7; }}

    .concept-map-thumb {{
      display: block;
      width: 100%;
      height: 120px;
      border-radius: 6px;
      border: 1px solid var(--border);
      margin: 14px 0;
      overflow: hidden;
    }}
    .concept-map-link {{
      display: block;
      text-align: center;
      font-size: 11px;
      color: var(--accent1);
      text-decoration: none;
      padding: 6px;
      background: rgba(21,101,192,.15);
      border-radius: 5px;
      margin-bottom: 16px;
    }}
    .concept-map-link:hover {{ background: rgba(21,101,192,.3); }}

    /* ── Main content ────────────────────────── */
    #content {{
      flex: 1;
      max-width: 880px;
      padding: 48px 52px;
      overflow-x: hidden;
    }}

    .lecture-header {{
      border-bottom: 2px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 36px;
    }}
    .lecture-header h1 {{
      font-size: 32px;
      color: var(--accent1);
      margin-bottom: 8px;
      line-height: 1.3;
    }}
    .lecture-meta {{
      color: var(--muted);
      font-size: 12px;
      font-family: monospace;
      margin-bottom: 16px;
    }}
    .lecture-summary {{
      font-size: 16px;
      color: #B0BEC5;
      line-height: 1.8;
      margin-bottom: 20px;
    }}

    .objectives {{
      background: var(--surface);
      border-left: 3px solid var(--accent2);
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 32px;
    }}
    .objectives h3 {{
      color: var(--accent2);
      font-size: 12px;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }}
    .objectives li {{
      color: #B0BEC5;
      margin-left: 18px;
      margin-bottom: 4px;
      font-size: 14px;
    }}

    /* ── Concept sections ─────────────────────── */
    .concept-section {{
      margin-bottom: 64px;
      border-top: 1px solid var(--border);
      padding-top: 36px;
    }}
    .concept-title {{
      font-size: 26px;
      margin-bottom: 6px;
      line-height: 1.3;
    }}
    .concept-title .num {{ color: var(--muted); font-size: 20px; margin-right: 8px; }}
    .importance-badge {{
      display: inline-block;
      font-size: 11px;
      padding: 2px 10px;
      border-radius: 12px;
      margin-left: 10px;
      vertical-align: middle;
      font-family: monospace;
    }}
    .imp-core    {{ background: #0D47A1; color: #90CAF9; }}
    .imp-supporting {{ background: #BF360C; color: #FFAB91; }}
    .imp-detail  {{ background: #1B5E20; color: #A5D6A7; }}

    .section-heading {{
      font-size: 14px;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--muted);
      margin: 28px 0 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }}

    .definition-box {{
      background: var(--surface);
      border-left: 3px solid var(--accent1);
      padding: 14px 18px;
      border-radius: 0 8px 8px 0;
      font-size: 15px;
      color: #CFD8DC;
      margin-bottom: 24px;
    }}

    .intuition-text {{
      color: #B0BEC5;
      line-height: 1.85;
      white-space: pre-wrap;
    }}

    /* ── Math ─────────────────────────────────── */
    .math-block {{
      background: #0A0A18;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px 24px;
      margin: 16px 0;
      overflow-x: auto;
    }}
    .math-label {{
      font-size: 11px;
      color: var(--muted);
      font-family: monospace;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }}
    .math-meaning {{
      font-size: 12px;
      color: var(--muted);
      margin-top: 8px;
      font-style: italic;
    }}

    /* ── Mermaid diagrams ─────────────────────── */
    .diagram-wrapper {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px;
      margin: 16px 0;
      overflow-x: auto;
      text-align: center;
    }}
    .diagram-caption {{
      font-size: 12px;
      color: var(--muted);
      margin-top: 10px;
      font-style: italic;
    }}
    .mermaid {{
      font-family: monospace !important;
    }}

    /* ── Examples ─────────────────────────────── */
    .example-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px 22px;
      margin: 12px 0;
    }}
    .example-title {{
      font-size: 13px;
      font-weight: bold;
      color: var(--warn);
      margin-bottom: 10px;
    }}
    .example-content {{
      color: #B0BEC5;
      font-size: 14px;
      line-height: 1.8;
      white-space: pre-wrap;
    }}

    /* ── Takeaways & misconceptions ───────────── */
    .takeaway-list li {{
      padding: 5px 0;
      color: #CFD8DC;
      margin-left: 20px;
    }}
    .takeaway-list li::marker {{ color: var(--accent2); }}

    .misconception-item {{
      display: flex;
      gap: 10px;
      padding: 8px 0;
      color: #EF9A9A;
      font-size: 14px;
    }}
    .misconception-item::before {{
      content: '⚠';
      flex-shrink: 0;
    }}

    /* ── Inline code ──────────────────────────── */
    code {{
      background: #0A0A18;
      border: 1px solid var(--border);
      padding: 1px 5px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 13px;
    }}
    pre code {{
      display: block;
      padding: 14px;
      overflow-x: auto;
      line-height: 1.6;
    }}

    /* ── Print styles ─────────────────────────── */
    @media print {{
      #sidebar {{ display: none; }}
      #content {{ max-width: 100%; padding: 20px; }}
      .concept-section {{ page-break-before: always; }}
      a {{ color: inherit; text-decoration: none; }}
    }}

    /* ── Search highlight ─────────────────────── */
    mark {{ background: #FFF176; color: #000; border-radius: 2px; }}
  </style>
</head>
<body>

<!-- ── Sidebar ────────────────────────────────────────────────────────── -->
<nav id="sidebar">
  <h2>Table of Contents</h2>
  {concept_map_sidebar}
  {toc_html}
</nav>

<!-- ── Main content ───────────────────────────────────────────────────── -->
<main id="content">
  <div class="lecture-header">
    <h1>{title}</h1>
    <div class="lecture-meta">Generated {timestamp} &nbsp;·&nbsp; iMentor Lecture Generator &nbsp;·&nbsp; SGLang (local)</div>
    <p class="lecture-summary">{summary}</p>
    <div class="objectives">
      <h3>Learning Objectives</h3>
      <ul>{objectives_html}</ul>
    </div>
  </div>

  {concept_map_section}

  {coverage_table}

  {sections_html}

  <div style="border-top:1px solid #2A2A3E;padding-top:24px;margin-top:48px;
              color:#37474F;font-size:12px;font-family:monospace;">
    End of lecture notes · {title} · {timestamp}
  </div>
</main>

<!-- ── In-page search ─────────────────────────────────────────────────── -->
<div id="page-search" style="position:fixed;bottom:20px;right:20px;z-index:9999;
     background:rgba(13,13,26,.95);padding:10px 14px;border-radius:8px;
     border:1px solid #334;font-family:monospace;display:flex;gap:8px;align-items:center;">
  <span style="color:#607D8B;font-size:12px;">🔍</span>
  <input id="pg-search" type="text" placeholder="Search notes… (Ctrl+F)"
    style="background:#1E1E2E;border:1px solid #445;color:#ECE;padding:5px 8px;
           border-radius:4px;font-size:12px;width:180px;outline:none;"
    oninput="pgSearch(this.value)">
  <span id="pg-count" style="color:#546E7A;font-size:11px;min-width:40px;"></span>
</div>

<script>
// Simple in-page text search with highlight
var _marks = [];
function pgSearch(q) {{
  // Clear previous highlights
  _marks.forEach(function(el) {{
    var parent = el.parentNode;
    if (parent) {{ parent.replaceChild(document.createTextNode(el.textContent), el); parent.normalize(); }}
  }});
  _marks = [];
  if (!q || q.length < 2) {{ document.getElementById('pg-count').textContent = ''; return; }}
  var content = document.getElementById('content');
  var count = _highlightText(content, q);
  document.getElementById('pg-count').textContent = count + ' match' + (count !== 1 ? 'es' : '');
  if (_marks.length > 0) _marks[0].scrollIntoView({{ behavior: 'smooth', block: 'center' }});
}}

function _highlightText(node, q) {{
  var count = 0;
  if (node.nodeType === 3) {{  // Text node
    var idx = node.textContent.toLowerCase().indexOf(q.toLowerCase());
    if (idx >= 0) {{
      var mark = document.createElement('mark');
      mark.textContent = node.textContent.substring(idx, idx + q.length);
      var after = node.splitText(idx);
      after.textContent = after.textContent.substring(q.length);
      node.parentNode.insertBefore(mark, after);
      _marks.push(mark);
      count = 1;
    }}
  }} else if (node.nodeType === 1 && !['SCRIPT','STYLE','mark'].includes(node.tagName)) {{
    Array.from(node.childNodes).forEach(function(child) {{ count += _highlightText(child, q); }});
  }}
  return count;
}}

document.addEventListener('keydown', function(e) {{
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {{
    e.preventDefault();
    document.getElementById('pg-search').focus();
  }}
  if (e.key === 'Escape') {{
    document.getElementById('pg-search').value = '';
    pgSearch('');
  }}
}});
</script>

</body>
</html>
"""


def _importance_badge(importance: str) -> str:
    cls = {"core": "imp-core", "supporting": "imp-supporting", "detail": "imp-detail"}.get(importance, "")
    return f'<span class="importance-badge {cls}">{importance}</span>'


def _toc_badge(importance: str) -> str:
    cls = {"core": "badge-core", "supporting": "badge-support", "detail": "badge-detail"}.get(importance, "")
    label = {"core": "core", "supporting": "key", "detail": "adv"}.get(importance, "")
    return f'<span class="toc-badge {cls}">{label}</span>'


def _escape_html(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _section_id(label: str) -> str:
    return re.sub(r"[^a-z0-9-]", "", label.lower().replace(" ", "-"))


def _coverage_table_html(coverage: dict, lectures_count: int) -> str:
    """Build an HTML coverage matrix: rows = concepts, columns = lectures."""
    if not coverage or lectures_count == 0:
        return ""

    lec_nums = list(range(1, lectures_count + 1))
    header = "".join(f"<th>L{n}</th>" for n in lec_nums)

    rows = []
    for cov in sorted(coverage.values(), key=lambda c: (-c.lecture_count, c.concept_label)):
        cells = []
        for n in lec_nums:
            if n in cov.lecture_indices:
                cells.append('<td style="text-align:center;color:#A5D6A7;">●</td>')
            else:
                cells.append('<td style="text-align:center;color:#263238;">·</td>')
        cross = ' style="color:#90CAF9;font-weight:bold;"' if cov.is_cross_lecture else ""
        rows.append(
            f"<tr><td{cross}>{_escape_html(cov.concept_label)}</td>{''.join(cells)}</tr>"
        )

    return f"""
<div class="concept-section" style="margin-bottom:40px;">
  <h2 style="color:var(--accent1);font-size:22px;margin-bottom:16px;">
    📋 Concept Coverage by Lecture
  </h2>
  <p style="color:var(--muted);font-size:13px;margin-bottom:16px;">
    ● = covered in that lecture &nbsp;·&nbsp;
    <span style="color:#90CAF9;font-weight:bold;">Blue = spans multiple lectures</span>
  </p>
  <div style="overflow-x:auto;">
  <table style="border-collapse:collapse;font-family:monospace;font-size:12px;width:100%;">
    <thead>
      <tr style="border-bottom:1px solid #334;">
        <th style="text-align:left;padding:6px 12px;color:#607D8B;">Concept</th>
        {header}
      </tr>
    </thead>
    <tbody style="color:#B0BEC5;">
      {"".join(f'<tr style="border-bottom:1px solid #1A1A2A;">{r[4:-5]}</tr>' for r in rows)}
    </tbody>
  </table>
  </div>
</div>"""


def to_html(
    kg: KnowledgeGraph,
    notes: List[Tuple[Concept, Optional[ConceptNote]]],
    concept_map_rel_path: Optional[str] = None,
    coverage: Optional[dict] = None,
    lectures_count: int = 0,
) -> str:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")

    # ── TOC ────────────────────────────────────────────────────────────
    toc_items = []
    for i, (concept, _) in enumerate(notes, 1):
        sid = _section_id(concept.label)
        badge = _toc_badge(concept.importance)
        toc_items.append(
            f'<a href="#{sid}" class="toc-item {concept.importance}">'
            f'{i}. {_escape_html(concept.label)}{badge}</a>'
        )
    toc_html = "\n".join(toc_items)

    # ── Concept map sidebar ─────────────────────────────────────────────
    if concept_map_rel_path:
        cm_sidebar = (
            f'<iframe src="{concept_map_rel_path}" class="concept-map-thumb" '
            f'scrolling="no" frameborder="0"></iframe>\n'
            f'<a href="{concept_map_rel_path}" target="_blank" class="concept-map-link">'
            f'🗺 Open Full Concept Map</a>'
        )
        cm_section = (
            f'<div class="concept-section" style="border:none;padding-top:0;margin-bottom:48px;">'
            f'<h2 style="color:var(--accent1);font-size:22px;margin-bottom:16px;">Concept Map</h2>'
            f'<iframe src="{concept_map_rel_path}" style="width:100%;height:520px;'
            f'border:1px solid var(--border);border-radius:10px;" frameborder="0"></iframe>'
            f'</div>'
        )
    else:
        cm_sidebar = ""
        cm_section = ""

    # ── Learning objectives ─────────────────────────────────────────────
    obj_items = "".join(f"<li>{_escape_html(o)}</li>" for o in kg.learning_objectives)

    # ── Concept sections ────────────────────────────────────────────────
    sections = []
    for i, (concept, note) in enumerate(notes, 1):
        sid = _section_id(concept.label)
        imp_b = _importance_badge(concept.importance)
        title_line = (
            f'<h2 class="concept-title" id="{sid}">'
            f'<span class="num">{i}.</span> {_escape_html(concept.label)}{imp_b}</h2>'
        )

        if note is None:
            sections.append(
                f'<div class="concept-section">{title_line}'
                f'<div class="definition-box" style="border-color:#F44336;">'
                f'⚠️ Note generation failed. Raw description:<br>{_escape_html(concept.description)}'
                f'</div></div>'
            )
            continue

        body = [title_line]

        # Definition
        body.append('<div class="section-heading">Definition</div>')
        body.append(f'<div class="definition-box">{_escape_html(note.definition)}</div>')

        # Intuition
        body.append('<div class="section-heading">Intuition</div>')
        body.append(f'<p class="intuition-text">{_escape_html(note.intuition)}</p>')

        # Math
        if note.math.has_math and note.math.formulas:
            body.append('<div class="section-heading">Mathematical Formulation</div>')
            for formula in note.math.formulas:
                body.append(
                    f'<div class="math-block">'
                    f'<div class="math-label">{_escape_html(formula.label)}</div>'
                    f'<div>$$\n{formula.latex}\n$$</div>'
                    f'<div class="math-meaning">{_escape_html(formula.meaning)}</div>'
                    f'</div>'
                )

        # Mermaid diagram
        if note.mermaid_diagram:
            cap = f'<div class="diagram-caption">{_escape_html(note.mermaid_caption)}</div>' if note.mermaid_caption else ""
            body.append(
                f'<div class="section-heading">Diagram</div>'
                f'<div class="diagram-wrapper">'
                f'<pre class="mermaid">{_escape_html(note.mermaid_diagram)}</pre>'
                f'{cap}</div>'
            )

        # Examples
        if note.examples:
            body.append('<div class="section-heading">Examples</div>')
            for ex in note.examples:
                body.append(
                    f'<div class="example-card">'
                    f'<div class="example-title">{_escape_html(ex.title)}</div>'
                    f'<div class="example-content">{_escape_html(ex.content)}</div>'
                    f'</div>'
                )

        # Key takeaways
        if note.key_takeaways:
            body.append('<div class="section-heading">Key Takeaways</div>')
            items = "".join(f"<li>{_escape_html(pt)}</li>" for pt in note.key_takeaways)
            body.append(f'<ul class="takeaway-list">{items}</ul>')

        # Misconceptions
        if note.misconceptions:
            body.append('<div class="section-heading">Common Misconceptions</div>')
            for m in note.misconceptions:
                body.append(f'<div class="misconception-item">{_escape_html(m)}</div>')

        sections.append(
            f'<div class="concept-section">{"".join(body)}</div>'
        )

    cov_table = _coverage_table_html(coverage, lectures_count) if coverage else ""

    return _HTML_TEMPLATE.format(
        title=_escape_html(kg.title),
        timestamp=ts,
        summary=_escape_html(kg.summary),
        objectives_html=obj_items,
        concept_map_sidebar=cm_sidebar,
        concept_map_section=cm_section,
        coverage_table=cov_table,
        toc_html=toc_html,
        sections_html="\n".join(sections),
    )
