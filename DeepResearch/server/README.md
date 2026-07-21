# Deep Research AI Backend Server

A production-grade, multi-agent AI research backend inspired by OpenAI Deep Research, Perplexity AI, and Gemini Deep Research.

## Tech Stack

- **Framework**: FastAPI (Async/Await)
- **Language**: Python 3.12+
- **Database**: PostgreSQL with SQLAlchemy 2.x ORM
- **Async Cache & Queue**: Redis + Celery Workers
- **Multi-Agent Orchestration**: LangGraph + LangChain + OpenAI GPT-4o
- **Vector Database**: ChromaDB + OpenAI `text-embedding-3-small` Embeddings
- **Search Providers**: Tavily, arXiv, Wikipedia, GitHub Search
- **Export Engine**: PDF, DOCX, HTML, and Markdown renderers

## Getting Started

### Local Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Set `OPENAI_API_KEY`, `TAVILY_API_KEY`, etc.

3. **Start FastAPI Backend**:
   ```bash
   uvicorn app:app --reload --port 8000
   ```

4. **Start Celery Worker**:
   ```bash
   celery -A workers.celery_app.celery_app worker --loglevel=info
   ```

### Docker Setup

Run the full stack (PostgreSQL, Redis, FastAPI, Celery) via Docker Compose:

```bash
docker compose up --build -d
```

## API Documentation

Interactive OpenAPI Swagger UI is available at:
`http://localhost:8000/docs`
