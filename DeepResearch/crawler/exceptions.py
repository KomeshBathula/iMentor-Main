class CrawlerError(Exception):
    """Base exception class for all crawler related errors."""
    pass

class DownloadError(CrawlerError):
    """Raised when downloading a resource fails."""
    pass

class ExtractionError(CrawlerError):
    """Raised when extracting content from a resource fails."""
    pass

class StorageError(CrawlerError):
    """Raised when storing content to any storage backend fails."""
    pass

class ValidationError(CrawlerError):
    """Raised when validation of models or configuration parameters fails."""
    pass

class ConfigurationError(CrawlerError):
    """Raised when settings or configurations are invalid."""
    pass

class ProcessingError(CrawlerError):
    """Raised during document processing/chunking operations."""
    pass
