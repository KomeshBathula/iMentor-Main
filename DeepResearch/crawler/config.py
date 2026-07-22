"""
Configuration management module for the RAG Crawler.
Utilizes Pydantic V2 Settings for type-safe environment variable parsing and configuration validation.
"""

from typing import List, Optional, Dict, Any
from pydantic import Field, BaseModel, AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class LogSettings(BaseModel):
    """Logging configuration settings."""
    level: str = Field(default="INFO", description="Global logging level (DEBUG, INFO, WARNING, ERROR)")
    format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="Standard logging format string"
    )
    json_format: bool = Field(default=False, description="Enable structured JSON logging output")
    log_file: Optional[str] = Field(default="logs/crawler.log", description="Path to write log files")


class CrawlerSettings(BaseModel):
    """Configuration specific to the crawling orchestrator."""
    max_depth: int = Field(default=3, ge=0, description="Maximum depth for recursive crawling")
    max_pages: int = Field(default=100, ge=1, description="Maximum total pages to crawl per job")
    concurrency_limit: int = Field(default=5, ge=1, description="Number of parallel scraping tasks")
    request_timeout: int = Field(default=30, ge=1, description="Timeout in seconds for HTTP requests")
    rate_limit_delay: float = Field(default=1.0, ge=0.0, description="Delay between requests in seconds")
    respect_robots_txt: bool = Field(default=True, description="Enforce robots.txt rules")
    user_agents: List[str] = Field(
        default=[
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ],
        description="List of User-Agents to rotate during crawl operations"
    )
    allowed_domains: List[str] = Field(default=[], description="Whitelist of domains allowed to crawl")
    ignored_extensions: List[str] = Field(
        default=[".mp4", ".mp3", ".zip", ".tar.gz", ".exe", ".dmg", ".iso", ".bin", ".dmg"],
        description="File extensions to skip entirely"
    )


class ProxySettings(BaseModel):
    """Proxy settings for network requests."""
    enabled: bool = Field(default=False, description="Whether to use proxies for HTTP operations")
    proxy_urls: List[str] = Field(default=[], description="List of proxy URLs (e.g., 'http://user:pass@host:port')")
    rotate_proxies: bool = Field(default=True, description="Rotate proxies sequentially or randomly")


class RetrySettings(BaseModel):
    """Network request retry configuration."""
    max_retries: int = Field(default=3, ge=0, description="Maximum retry attempts for transient errors")
    backoff_factor: float = Field(default=2.0, ge=0.1, description="Exponential backoff multiplier")
    retry_statuses: List[int] = Field(
        default=[429, 500, 502, 503, 504],
        description="HTTP status codes that trigger a retry"
    )


class PlaywrightSettings(BaseModel):
    """Configuration for headless Playwright browser processing."""
    enabled: bool = Field(default=False, description="Enable Playwright for Javascript-heavy dynamic rendering")
    browser_type: str = Field(default="chromium", description="Browser engine to use (chromium, firefox, webkit)")
    headless: bool = Field(default=True, description="Run browser in headless mode")
    wait_until: str = Field(
        default="networkidle",
        description="Page load state to wait for (domcontentloaded, load, networkidle)"
    )
    screenshot_enabled: bool = Field(default=False, description="Capture page screenshots for visual debugging")


class ExtractorSettings(BaseModel):
    """Content parsing and metadata extraction settings."""
    ocr_enabled: bool = Field(default=False, description="Fallback to OCR when PDFs/images have no native text")
    ocr_languages: str = Field(default="eng+deu", description="Tesseract OCR language string")
    tesseract_cmd: Optional[str] = Field(default=None, description="Absolute path to the tesseract executable")
    fallback_encoding: str = Field(default="utf-8", description="Encoding to fallback to if page headers lack it")
    detect_language: bool = Field(default=True, description="Enable automatic language detection of text")
    supported_languages: List[str] = Field(
        default=["en", "de", "fr", "es", "it"],
        description="Whitelisted languages for processing"
    )


class CacheSettings(BaseModel):
    """Caching settings for parsed content, downloads, and embeddings."""
    provider: str = Field(
        default="memory",
        description="Cache backend provider. Supported: 'redis', 'diskcache', 'memory'"
    )
    redis_url: str = Field(default="redis://localhost:6379/0", description="Connection string for Redis cache")
    diskcache_dir: str = Field(default="data/cache", description="Directory path for local disk cache files")
    ttl_seconds: int = Field(default=86400, ge=0, description="Time to live for cache entries (seconds)")


class StorageSettings(BaseModel):
    """Database and filesystem storage options."""
    local_storage_dir: str = Field(default="data", description="Local storage directory root for RAG output")
    
    # MongoDB
    mongodb_uri: str = Field(default="mongodb://localhost:27017", description="MongoDB connection string")
    mongodb_db_name: str = Field(default="rag_crawler", description="MongoDB target database name")
    
    # Qdrant Vector Search
    qdrant_url: str = Field(default="http://localhost:6334", description="Qdrant API host server URL")
    qdrant_api_key: Optional[str] = Field(default=None, description="Optional authentication key for Qdrant Cloud")
    qdrant_collection_name: str = Field(default="rag_documents", description="Target collection name in Qdrant")

    # Elasticsearch
    elasticsearch_hosts: List[str] = Field(default=["http://localhost:9200"], description="List of Elasticsearch node URLs")
    elasticsearch_index: str = Field(default="rag_crawler_docs", description="Target Elasticsearch search index")
    elasticsearch_username: Optional[str] = Field(default=None, description="Username for Elasticsearch basic auth")
    elasticsearch_password: Optional[str] = Field(default=None, description="Password for Elasticsearch basic auth")
    
    # Neo4j Graph
    neo4j_uri: str = Field(default="bolt://localhost:7687", description="Neo4j driver connection URI")
    neo4j_username: str = Field(default="neo4j", description="Neo4j login username")
    neo4j_password: str = Field(default="password", description="Neo4j login password")


class EmbeddingSettings(BaseModel):
    """Model embedding service configuration."""
    provider: str = Field(
        default="sentence-transformers",
        description="Embedding model provider. Supported: 'openai', 'huggingface', 'sentence-transformers'"
    )
    model_name: str = Field(
        default="all-MiniLM-L6-v2",
        description="Specific model identifier to load or call"
    )
    api_key: Optional[str] = Field(default=None, description="API key (if embedding service requires it)")
    dimension: int = Field(default=384, ge=1, description="Embedding vector representation dimensions")
    batch_size: int = Field(default=32, ge=1, description="Batch processing size for generating embeddings")


class ProcessorSettings(BaseModel):
    """Post-processing and chunking configurations."""
    chunk_strategy: str = Field(
        default="recursive",
        description="Text splitting algorithm: 'fixed', 'recursive', 'semantic', 'markdown'"
    )
    chunk_size: int = Field(default=500, ge=10, description="Target chunk size in tokens or characters")
    chunk_overlap: int = Field(default=50, ge=0, description="Overlap size between contiguous text chunks")
    tokenizer_name: str = Field(default="cl100k_base", description="Tokenizer name (e.g., cl100k_base, gpt2)")
    similarity_threshold: float = Field(
        default=0.9,
        ge=0.0,
        le=1.0,
        description="Duplicate detection cosine similarity threshold"
    )


class Settings(BaseSettings):
    """Global unified settings structure for the RAG Crawler application."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_nested_delimiter="__",
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    env: str = Field(default="development", description="Execution environment (development, staging, production)")
    
    logging: LogSettings = Field(default_factory=LogSettings)
    crawler: CrawlerSettings = Field(default_factory=CrawlerSettings)
    proxy: ProxySettings = Field(default_factory=ProxySettings)
    retry: RetrySettings = Field(default_factory=RetrySettings)
    playwright: PlaywrightSettings = Field(default_factory=PlaywrightSettings)
    extractor: ExtractorSettings = Field(default_factory=ExtractorSettings)
    cache: CacheSettings = Field(default_factory=CacheSettings)
    storage: StorageSettings = Field(default_factory=StorageSettings)
    embedding: EmbeddingSettings = Field(default_factory=EmbeddingSettings)
    processor: ProcessorSettings = Field(default_factory=ProcessorSettings)


# Global Config Instance
settings = Settings()

if __name__ == "__main__":
    # Demonstration and configuration validation output
    print("Validating Settings initialization...")
    print(settings.model_dump_json(indent=2))
