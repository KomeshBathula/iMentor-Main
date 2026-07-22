from bs4 import BeautifulSoup
from typing import Optional

def extract_title(soup: BeautifulSoup) -> Optional[str]:
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        return str(og_title.get("content")).strip()
    
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    
    first_h1 = soup.find("h1")
    if first_h1:
        return first_h1.get_text().strip()
    return None

def extract_meta_field(soup: BeautifulSoup, name_or_property: str) -> Optional[str]:
    tag = soup.find("meta", attrs={"name": name_or_property}) or           soup.find("meta", attrs={"property": name_or_property})
    if tag and tag.get("content"):
        return str(tag.get("content")).strip()
    return None
