import re
from typing import List, Dict, Any


def markdown_to_html(md_text: str) -> str:
    """
    Simple, robust Markdown-to-HTML converter for research report rendering.
    Converts headers, bold, italics, lists, blockquotes, and code blocks.
    """
    if not md_text:
        return ""

    html = md_text

    # Code blocks
    html = re.sub(r"```(?:\w+)?\n(.*?)\n```", r"<pre><code>\1</code></pre>", html, flags=re.DOTALL)

    # Headers
    html = re.sub(r"^### (.*?)$", r"<h3>\1</h3>", html, flags=re.MULTILINE)
    html = re.sub(r"^## (.*?)$", r"<h2>\1</h2>", html, flags=re.MULTILINE)
    html = re.sub(r"^# (.*?)$", r"<h1>\1</h1>", html, flags=re.MULTILINE)

    # Bold and Italics
    html = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", html)
    html = re.sub(r"\*(.*?)\*", r"<em>\1</em>", html)

    # Unordered Lists
    html = re.sub(r"^\* (.*?)$", r"<li>\1</li>", html, flags=re.MULTILINE)
    html = re.sub(r"^- (.*?)$", r"<li>\1</li>", html, flags=re.MULTILINE)
    html = re.sub(r"(<li>.*?</li>)", r"<ul>\1</ul>", html, flags=re.DOTALL)

    # Paragraphs
    paragraphs = html.split("\n\n")
    html_paragraphs = []
    for p in paragraphs:
        p = p.strip()
        if not p.startswith("<"):
            html_paragraphs.append(f"<p>{p}</p>")
        else:
            html_paragraphs.append(p)

    return "\n".join(html_paragraphs)


def inject_citations(content: str, sources: List[Dict[str, Any]]) -> str:
    """
    Format citation numbers in markdown/HTML text to point to source links.
    """
    for idx, source in enumerate(sources, 1):
        url = source.get("url", "#")
        title = source.get("title", f"Source {idx}")
        pattern = rf"\[{idx}\]"
        replacement = f'<a href="{url}" target="_blank" title="{title}">[{idx}]</a>'
        content = re.sub(pattern, replacement, content)
    return content
