# Enterprise AI RAG Crawler Module

An enterprise-grade, asynchronous crawling, document layout extraction, chunking, and database indexing pipeline for Retrieval-Augmented Generation (RAG) applications. 

Designed following Clean Architecture, SOLID principles, Dependency Injection, and Python 3.12+ standard typing specifications.

---

## Key Features

1. **Robust Async Downloader**: Built on top of `httpx` with exponential backoff retries and Playwright browser integration for JS-heavy dynamic rendering websites.
2. **Smart Web Scraper**: Respects `robots.txt`, implements domain-locked recursive crawl loops, and processes rate limits / concurrency throttling.
3. **High-Fidelity Parser**: Separates boilerplate menus from main content using `trafilatura` and `readability-lxml`.
4. **PDF Layout Engine & OCR Fallback**: Native PDF text parsing using `PyMuPDF (fitz)`. Falls back automatically to Tesseract OCR via `pytesseract` and `Pillow` on scanned documents.
5. **Multi-Strategy NLP Chunker**: Groups texts using **Fixed-size**, **Recursive Character**, **Semantic Sentence**, and **Markdown Header-aware** chunking.
6. **Pluggable Vector Generation**: Generates vectors using local `SentenceTransformers` model representations or OpenAI's embeddings API.
7. **Database Storage Adapters**: Integrates filesystem storage alongside vector (`Qdrant`), search index (`Elasticsearch`), document (`MongoDB`), and knowledge graph (`Neo4j`) storages.
8. **JSON Logging & Monitoring**: Log rotation with optional structured JSON formatting.

---

## Directory tree structure

```text
crawler/
├── __init__.py
├── main.py                 # FastAPI Application Entrypoint
├── config.py               # Pydantic V2 type-safe environment configurations
├── constants.py            # Global MIME mappings, headers, selectors
├── logger.py               # JSON structured log output setup
├── exceptions.py           # Core exceptions tree
├── utils.py                # Asynchronous executors, hashing & normalizers
├── requirements.txt        # Package dependencies list
│
├── api/                    # API Routing endpoints
│   ├── __init__.py
│   ├── crawl.py            # Recursive background crawling triggers
│   ├── extract.py          # Direct URL content extraction endpoints
│   ├── upload.py           # Raw file upload ingestion endpoints
│   └── status.py           # Health checks
│
├── cache/                  # Modular caching interfaces
│   ├── __init__.py
│   ├── cache_manager.py    # Cache interface definitions
│   ├── redis_cache.py      # Async Redis backend wrapper
│   ├── memory_cache.py     # LRU safe in-memory cache
│   ├── file_cache.py       # diskcache filesystem backend
│   └── cache_utils.py      # Serializers (JSON/Pickle)
│
├── downloader/             # Raw asset retrieval
│   ├── __init__.py
│   ├── web_downloader.py   # Async HTTPX network crawler
│   ├── pdf_downloader.py   # PDF streams downloaders
│   ├── image_downloader.py # Image download handlers
│   ├── file_downloader.py  # Generic formats downloader
│   └── retry.py            # Exponential retry async decorator
│
├── extractor/              # Clean text & structural extractors
│   ├── __init__.py
│   ├── html_extractor.py   # Trafilatura & BS4 boilerplate stripping
│   ├── pdf_extractor.py    # High-level PDF delegate
│   ├── image_extractor.py  # Image OCR parsing
│   ├── metadata_extractor.py # SEO/HTML meta parser
│   ├── table_extractor.py  # Table layout converting to Markdown
│   ├── link_extractor.py   # Absolute URL filtering
│   ├── text_cleaner.py     # String spacing normalizers
│   ├── language_detector.py # Automatic langdetect
│   └── helpers.py          # Standard parsing helpers
│
├── pdf/                    # Low-level PDF parsers
│   ├── __init__.py
│   ├── parser.py           # Orchestrator for native text & OCR fallback
│   ├── reader.py           # Native fitz extraction
│   ├── ocr.py              # Page-to-image OCR rendering
│   ├── splitter.py         # Multi-page splitter utilities
│   ├── converter.py        # PDF page-to-image converters
│   ├── cleaner.py          # Header and footer stripping rules
│   └── embeddings.py
│
├── processors/             # Content text layout processors
│   ├── __init__.py
│   ├── cleaner.py          # Margin space scrubbers
│   ├── chunker.py          # Ingestion chunkers (Semantic, Markdown, etc.)
│   ├── tokenizer.py        # Tiktoken tokenizer counters
│   ├── language.py
│   ├── duplicate_detector.py # Content deduplication signatures checks
│   └── summarizer.py       # Sentence scoring extractive summarizers
│
├── services/               # Core business services
│   ├── __init__.py
│   ├── crawl_service.py    # Recursive crawl logic manager
│   ├── extraction_service.py # Layout parse router
│   ├── embedding_service.py # Pluggable embeddings model manager
│   └── indexing_service.py # Core RAG ingestion coordinator
│
└── storage/                # Database adapters
    ├── __init__.py
    ├── filesystem.py       # Local raw/processed files storage
    ├── mongodb.py          # Document database client
    ├── qdrant.py           # Vector database search connector
    ├── elasticsearch.py    # Full-text search search adapter
    └── neo4j.py            # Ingestion graph relation mapper
```

---

## Execution Requirements & Setup

### System Prerequisites
1. **Python 3.12+**
2. **Tesseract OCR** (For PDF/Image OCR capabilities):
   - **Windows**: Install Tesseract OCR and ensure `tesseract.exe` is in your system path, or set `EXTRACTOR__TESSERACT_CMD` environment variable to the path of your executable.
   - **Mac**: `brew install tesseract`
   - **Linux**: `sudo apt-get install tesseract-ocr`
3. **Docker** (Recommended for local database services like Redis, Qdrant, MongoDB, and Elasticsearch).

### Environment Configuration (`.env`)
Create a `.env` file in the project root folder to configure local credentials and connection endpoints:
```env
# General
ENV=development

# Logging
LOGGING__LEVEL=INFO
LOGGING__JSON_FORMAT=false

# Cache Backend (memory / diskcache / redis)
CACHE__PROVIDER=memory
CACHE__REDIS_URL=redis://localhost:6379/0

# Storage Databases Configuration
STORAGE__LOCAL_STORAGE_DIR=data
STORAGE__MONGODB_URI=mongodb://localhost:27017
STORAGE__QDRANT_URL=http://localhost:6334
STORAGE__ELASTICSEARCH_HOSTS=["http://localhost:9200"]
STORAGE__NEO4J_URI=bolt://localhost:7687
STORAGE__NEO4J_USERNAME=neo4j
STORAGE__NEO4J_PASSWORD=password

# Ingestion Embeddings (sentence-transformers / openai)
EMBEDDING__PROVIDER=sentence-transformers
EMBEDDING__MODEL_NAME=all-MiniLM-L6-v2
EMBEDDING__DIMENSION=384
```

---

## Steps to Execute the Project

### 1. Installation
Set up your virtual environment and install dependency specifications:
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r crawler/requirements.txt
```

### 2. Running Web Server (API)
Start the FastAPI server using `uvicorn`:
```bash
uvicorn crawler.main:app --host 127.0.0.1 --port 8000 --reload
```
Once running, you can access:
- **Interactive Documentation (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Status Endpoint**: [http://127.0.0.1:8000/status](http://127.0.0.1:8000/status)

### 3. Execution Verification
To run tests and confirm config loadings, text cleanups, and chunk segments:
```bash
python -m unittest discover -s tests
```
The workspace includes test assets and mock raw inputs (located in `data/raw/sample_doc.txt`) to test indexing flows.
