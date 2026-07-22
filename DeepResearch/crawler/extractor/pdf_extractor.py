from typing import Optional, Any
import hashlib
from crawler.models.document import Document
from crawler.models.metadata import DocumentMetadata
from crawler.exceptions import ExtractionError

class PDFExtractor:
    def __init__(self, pdf_parser: Any) -> None:
        self.pdf_parser = pdf_parser

    def extract(self, local_pdf_path: str, source_url: Optional[str] = None) -> Document:
        try:
            # We block synchronously because the extract function is synchronous
            # Run the parser run loop
            import asyncio
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            if loop.is_running():
                # Run standard blocking wrapper via thread runner
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    parsed = pool.submit(lambda: asyncio.run(self.pdf_parser.parse(local_pdf_path))).result()
            else:
                parsed = loop.run_until_complete(self.pdf_parser.parse(local_pdf_path))
                
            metadata = DocumentMetadata(
                source_url=source_url,
                title=parsed.get("metadata", {}).get("title"),
                author=parsed.get("metadata", {}).get("author"),
                description=parsed.get("metadata", {}).get("subject"),
                extra=parsed.get("metadata", {})
            )
            doc_id = hashlib.sha256(parsed.get("text", "").encode("utf-8")).hexdigest()
            return Document(
                id=doc_id,
                content=parsed.get("text", ""),
                raw_content_path=local_pdf_path,
                mime_type="application/pdf",
                metadata=metadata
            )
        except Exception as e:
            raise ExtractionError(f"PDF extraction failed for {local_pdf_path}: {e}")
