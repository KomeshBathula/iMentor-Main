from typing import List, Dict, Any
from schemas.source import SearchResultItem
from utils.logger import logger
from utils.markdown import markdown_to_html


class ReportAgent:
    """
    Report Agent responsible for assembling final HTML representations,
    calculating word counts and metrics, and preparing export structures.
    """

    def assemble_final_report(
        self,
        title: str,
        markdown_content: str,
        sources: List[SearchResultItem],
        bibliography: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Package final report assets into a unified dictionary structure.
        """
        logger.info(f"[ReportAgent] Assembling final report assets for title: '{title}'")

        words = len(markdown_content.split())
        html_content = markdown_to_html(markdown_content)

        # Append bibliography HTML section
        bib_html_items = "".join([
            f'<li><a href="{b["url"]}" target="_blank"><strong>{b["title"]}</strong></a> ({b["provider"]})</li>\n'
            for b in bibliography
        ])
        full_html = f"{html_content}\n<hr/>\n<h3>References</h3>\n<ol>\n{bib_html_items}</ol>"

        return {
            "title": title,
            "summary": markdown_content[:300].replace("#", "").strip() + "...",
            "content_markdown": markdown_content,
            "content_html": full_html,
            "word_count": words,
            "bibliography": bibliography,
        }
