import urllib.robotparser
from urllib.parse import urljoin, urlparse
from typing import List, Set, Optional
from bs4 import BeautifulSoup
from crawler.config import settings
from crawler.logger import setup_logger
from crawler.utils import normalize_url

logger = setup_logger(__name__)

class LinkExtractor:
    def __init__(self, current_domain: str) -> None:
        self.current_domain = current_domain.lower()
        self.rp: Optional[urllib.robotparser.RobotFileParser] = None

    def load_robots_txt(self, robots_txt_content: str) -> None:
        self.rp = urllib.robotparser.RobotFileParser()
        self.rp.parse(robots_txt_content.splitlines())

    def is_allowed(self, url: str) -> bool:
        if not settings.crawler.respect_robots_txt or not self.rp:
            return True
        return self.rp.can_fetch("*", url)

    def extract_links(self, html: str, base_url: str) -> List[str]:
        soup = BeautifulSoup(html, "lxml")
        links: Set[str] = set()
        
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"].strip()
            full_url = urljoin(base_url, href)
            normalized = normalize_url(full_url)
            
            parsed = urlparse(normalized)
            domain = parsed.netloc.lower()
            
            if settings.crawler.allowed_domains:
                if domain not in settings.crawler.allowed_domains:
                    continue
            else:
                if domain != self.current_domain:
                    continue
            
            if any(normalized.endswith(ext) for ext in settings.crawler.ignored_extensions):
                continue
                
            if self.is_allowed(normalized):
                links.add(normalized)
                
        return list(links)
