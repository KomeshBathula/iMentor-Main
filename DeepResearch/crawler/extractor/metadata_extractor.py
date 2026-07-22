from bs4 import BeautifulSoup
from crawler.models.metadata import DocumentMetadata
from crawler.extractor.helpers import extract_title, extract_meta_field
from datetime import datetime

class MetadataExtractor:
    @staticmethod
    def extract(html: str, url: str) -> DocumentMetadata:
        soup = BeautifulSoup(html, "lxml")
        
        title = extract_title(soup) or "Untitled Document"
        description = extract_meta_field(soup, "description") or extract_meta_field(soup, "og:description")
        author = extract_meta_field(soup, "author") or extract_meta_field(soup, "article:author")
        
        extra = {}
        for meta in soup.find_all("meta"):
            name = meta.get("name") or meta.get("property")
            content = meta.get("content")
            if name and content:
                extra[str(name)] = str(content)

        return DocumentMetadata(
            source_url=url,
            title=title,
            author=author,
            description=description,
            crawled_at=datetime.utcnow(),
            extra=extra
        )
