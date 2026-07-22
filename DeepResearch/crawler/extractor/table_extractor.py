from typing import List
from bs4 import BeautifulSoup

class TableExtractor:
    @staticmethod
    def extract_tables_as_markdown(html: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")
        md_tables: List[str] = []
        
        for table in soup.find_all("table"):
            rows = table.find_all("tr")
            if not rows:
                continue
            
            md_lines = []
            max_cols = 0
            
            for row in rows:
                cells = row.find_all(["td", "th"])
                cell_texts = [c.get_text().strip().replace("\n", " ") for c in cells]
                max_cols = max(max_cols, len(cell_texts))
                md_lines.append("| " + " | ".join(cell_texts) + " |")
            
            if md_lines:
                separator = "| " + " | ".join(["---"] * max_cols) + " |"
                md_lines.insert(1, separator)
                md_tables.append("\n".join(md_lines))
                
        return md_tables
