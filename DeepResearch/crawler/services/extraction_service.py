import os
from typing import Optional, Any
from crawler.models.document import Document
from crawler.extractor.html_extractor import HTMLExtractor
from crawler.extractor.pdf_extractor import PDFExtractor
from crawler.extractor.metadata_extractor import MetadataExtractor
from crawler.extractor.text_cleaner import TextCleaner
from crawler.pdf.parser import PDFParser
from crawler.constants import EXTENSION_TO_MIME
from crawler.utils import calculate_text_hash

class ExtractionService:
    def __init__(self, pdf_parser: PDFParser) -> None:
        self.html_extractor = HTMLExtractor()
        self.pdf_extractor = PDFExtractor(pdf_parser)
        
    async def extract_from_file(self, local_path: str, source_url: Optional[str] = None) -> Document:
        _, ext = os.path.splitext(local_path.lower())
        mime = EXTENSION_TO_MIME.get(ext, "application/octet-stream")
        
        if ext in [".html", ".htm"]:
            with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                html = f.read()
            content = self.html_extractor.extract_main_content(html)
            clean_content = TextCleaner.clean(content)
            metadata = MetadataExtractor.extract(html, source_url or local_path)
            doc_id = calculate_text_hash(clean_content)
            return Document(
                id=doc_id,
                content=clean_content,
                raw_content_path=local_path,
                mime_type=mime,
                metadata=metadata
            )
            
        elif ext == ".pdf":
            return self.pdf_extractor.extract(local_path, source_url)
            
        else:
            with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            clean_content = TextCleaner.clean(content)
            from crawler.models.metadata import DocumentMetadata
            from datetime import datetime
            doc_id = calculate_text_hash(clean_content)
            return Document(
                id=doc_id,
                content=clean_content,
                raw_content_path=local_path,
                mime_type=mime,
                metadata=DocumentMetadata(
                    source_url=source_url or local_path,
                    title=os.path.basename(local_path),
                    crawled_at=datetime.utcnow()
                )
            )
