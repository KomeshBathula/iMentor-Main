# iMentor — Technical Architecture Overview
**Date:** 2026-03-27 | **Audience:** Senior Software Engineer
**Version:** 2.0.0 (Team3 base + Teams 1–6 merged, routing hardened March 2026)

---

## 1. Executive Summary

iMentor is an **agentic GraphRAG educational chatbot** for higher education. It combines:
- Multi-model LLM routing (Gemini, Groq, Ollama/SGLang, Anthropic, OpenAI)
- Dual-database RAG (Qdrant vector search + Neo4j graph traversal)
- Socratic tutoring with session-persistent state machines
- Tree-of-Thought (ToT) and ReAct orchestration patterns
- Full gamification engine (XP, badges, boss battles, bounties, streaks)
- Deep research pipeline (multi-agent CrewAI or fallback web crawl + synthesis)

---

## 2. System Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (React/Vite :3000)                                         │
│  Tailwind CSS + shadcn/ui  |  Socket.io-client  |  useChat hook     │
└────────────────┬────────────────────────────────────────────────────┘
                 │ SSE / REST / WebSocket
┌────────────────▼────────────────────────────────────────────────────┐
│  Node.js / Express :5001                                            │
│  40+ REST routes  |  Socket.io  |  JWT auth  |  Rate limiting       │
│  Routing Waterfall → Chat Handler Chain → Agent Orchestrators       │
└──────┬────────────────────────────┬──────────────────────────────────┘
       │ HTTP (axios)               │ DB drivers
       │                            │
┌──────▼────────────┐   ┌──────────▼──────────────────────────────────┐
│  Python FastAPI   │   │  Infrastructure (Docker)                    │
│  :2001 (RAG)      │   │  MongoDB :27017   — chat history, users      │
│  Qdrant + Neo4j   │   │  Redis   :6379    — sessions, routing cache  │
│  Embeddings       │   │  Neo4j   :7687    — knowledge graph (Bolt)   │
│  KG extraction    │   │  Qdrant  :6333    — vector embeddings        │
│  Skill trees      │   │  Elasticsearch :9200 — full-text search      │
│  Study questions  │   │  Ollama  :11434   — embeddings (CPU)         │
│  Deep research    │   │  SGLang  :8000    — LLM inference (GPU)      │
└───────────────────┘   └─────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS | Port 3000; SSE streaming |
| **Backend** | Node.js ≥20, Express 4 | Port 5001 |
| **RAG Service** | Python 3.12, FastAPI, Uvicorn | Port 2001; conda env `imentor` |
| **Primary DB** | MongoDB 7 (Mongoose) | Chat history, users, configs |
| **Graph DB** | Neo4j 5 + APOC plugin | Knowledge graph, curriculum graph |
| **Vector DB** | Qdrant (latest) | Semantic search; REST + gRPC |
| **Cache/Queue** | Redis 7 | Routing cache, agent state, sessions |
| **Search** | Elasticsearch 8.13 | Full-text fallback search |
| **Embeddings** | Ollama (mxbai-embed-large, CPU) | Dev; sentence-transformers fallback |
| **Local LLM** | SGLang + Qwen2.5-7B-Instruct-AWQ | GPU; OpenAI-compatible API |
| **Cloud LLMs** | Gemini (google-generativeai), Groq (llama), Anthropic (claude), OpenAI | API keys in .env |
| **Monitoring** | Prometheus + Grafana, Sentry APM | Optional; ports 9090/3001 |
| **Reverse Proxy** | Nginx (production profile only) | Ports 80/443 |

---

## 4. Repository Structure

```
chatbot/
├── frontend/                    React/Vite SPA
│   └── src/
│       ├── components/          ~80 JSX components (chat, admin, gamification…)
│       ├── hooks/               useChat.jsx (SSE consumer + state)
│       ├── services/api.js      Axios wrapper, all REST + SSE calls
│       └── index.css            Tailwind + custom vars
├── server/                      Node.js backend
│   ├── server.js                Express app entry, DB init, cron, file watchers
│   ├── config/
│   │   ├── db.js                MongoDB connect
│   │   ├── redisClient.js       Redis connect
│   │   ├── neo4j.js             Neo4j driver
│   │   ├── promptTemplates.js   All system prompts (single source of truth)
│   │   └── routingConfig.js     Route types, decision methods, provider matrix
│   ├── models/                  Mongoose schemas (User, ChatHistory, LLMConfiguration…)
│   ├── routes/                  Express routers (40+ files)
│   │   └── chat/                Chat route decomposed into handlers
│   │       ├── index.js         Routing waterfall entry point
│   │       ├── helpers.js       streamEvent, detectNonAcademic, TUTOR_MODE_TYPES
│   │       └── handlers/        quizHandler, researchHandler, codeHandler, tutorHandler, standardHandler
│   ├── services/                ~100 JS service modules
│   ├── middleware/              auth, rate limiting, contextual memory, validation
│   ├── jobs/                    node-cron jobs (boss battles, bounties, spaced rep)
│   ├── scripts/                 Admin/maintenance scripts (not on hot path)
│   ├── utils/                   logger, metrics, crypto, network
│   └── rag_service/             Python FastAPI service (lives inside server/)
│       ├── app.py               FastAPI entry, all endpoints
│       ├── config.py            Env vars, embedding model factory, logging
│       ├── vector_db_service.py Qdrant CRUD + similarity search
│       ├── graph_rag.py         Neo4j GraphRAG (extract + query)
│       ├── neo4j_handler.py     Neo4j driver wrapper
│       ├── ai_core.py           LLM call abstraction (Gemini/Ollama)
│       ├── skill_tree_generator.py   Builds course skill trees
│       ├── study_questions_generator.py  Generates study Qs per topic
│       ├── subtopic_notes_generator.py   Generates structured notes
│       ├── course_pipeline.py   End-to-end PDF → vectors + graph pipeline
│       ├── deep_research.py     Standalone deep research logic
│       ├── crew/research_crew.py  CrewAI multi-agent research (lazy import)
│       └── …40+ other py modules (quiz, podcast, TTS/STT, fine-tuner…)
├── docker-compose.yml           All infra + app services
├── Dockerfile                   Multi-stage: server + frontend targets
└── startup.sh                   Dev launcher (3 gnome-terminal tabs)
```

---

## 5. Request Routing Waterfall (Critical Path)

Every chat message hits `POST /api/chat/message`. The routing waterfall in [server/routes/chat/index.js](server/routes/chat/index.js) decides which handler executes:

```
Step 0 — Keyword pre-check (~0ms)
   └─ current-events regex → auto-enable web search

Step 1 — Session-flag short-circuit (~0ms)
   └─ tutorMode / quizMode / deepResearchMode set → skip embedding

Step 2 — Redis cache hit (~1ms)
   └─ identical query within 5min TTL → cached route decision

Step 3 — Manual model selection (~0ms)
   └─ user explicitly chose a model → honour it

Step 4 — Semantic embedding router (~10ms)
   └─ routeQuery() → Ollama embed → cosine similarity vs. intent prototypes
   └─ confidence ≥ 0.65 → accept route
   └─ enables tools: web_search, academic_search, tot, deep_research

Step 5 — LLM Tool Router (~100–500ms, only if confidence < 0.65)
   └─ routeWithLLM() → small LLM (Groq/Ollama) classifies query

Step 6 — Keyword fallback (~0.1ms)
   └─ simple regex patterns → route decision

Step 7 — Complexity scoring
   └─ calculateComplexityScore() → score 0–100
   └─ score < 35 + short query → simpleFastPath = true

→ Handler dispatch:
   deepResearchMode  → researchHandler
   isQuizMode        → quizHandler
   codeHandler.handle() (returns false if not code intent)
   tutorHandler.handleGeneral() (GENERAL_SOCRATIC)
   tutorHandler.handleStructured() (course-structured)
   standardHandler.handle() (default: RAG + optional ToT/ReAct)
```

**Key file:** [server/config/routingConfig.js](server/config/routingConfig.js) — single source of truth for all route types and thresholds.

---

## 6. Chat Handler Chain

### 6.1 Standard Handler ([server/routes/chat/handlers/standardHandler.js](server/routes/chat/handlers/standardHandler.js))

The default path. Orchestrates:
1. **RAG retrieval** → `ragQueryService.js` calls Python RAG `/query` (Qdrant + Neo4j)
2. **LLM selection** → `llmRouterService.selectLLM()` picks provider/model
3. **Context building** → `contextManager.buildOptimalContext()` trims history + rolling summary
4. **Reasoning mode dispatch:**
   - `criticalThinkingEnabled` (score > 85 or user-explicit) → `totOrchestrator` (Tree-of-Thought)
   - `useReAct` → `reactOrchestrator` (tool-use agent loop)
   - `simpleFastPath` → single LLM pass (no agent loop)
   - Default → `agentService.runAgenticLoop()` (multi-step with tool calls)
5. **Streaming** → SSE via `streamEvent()` helper

### 6.2 Tutor Handler ([server/routes/chat/handlers/tutorHandler.js](server/routes/chat/handlers/tutorHandler.js))

Two sub-paths:
- **GENERAL_SOCRATIC** — `SocraticTutorService` with state machine (`tutorStateMachine.js`)
  - State: `INIT → EXPLORE → GUIDE → ASSESS → CONCLUDE`
  - Persisted to Redis per sessionId
- **STRUCTURED** — course-aware path; injects curriculum context from RAG + Neo4j skill tree

### 6.3 Research Handler ([server/routes/chat/handlers/researchHandler.js](server/routes/chat/handlers/researchHandler.js))

Triggers `deepResearchOrchestrator.js`:
- Primary: CrewAI multi-agent crew (`rag_service/crew/research_crew.py`) — lazy import, disabled in dev
- Fallback: JS orchestrator → parallel web crawl + academic search → synthesis via Gemini/Groq

### 6.4 Code Handler ([server/routes/chat/handlers/codeHandler.js](server/routes/chat/handlers/codeHandler.js))

Detects code intent → calls Python RAG `/code/analyze` endpoint → streams result.

### 6.5 Quiz Handler ([server/routes/chat/handlers/quizHandler.js](server/routes/chat/handlers/quizHandler.js))

Evaluates quiz answers: extracts CORRECT ANSWER from system prompt, grades student response, awards XP.

---

## 7. Agent Service & Orchestrators

### agentService.js — Core Agentic Loop
- `runAgenticLoop(query, context, llmService, options)` — multi-step agent with tool calls
- Uses `toolRegistry.js` (registered tools: rag_search, web_search, academic_search, kg_query, calculator…)
- `toolChainOrchestrator.js` — sequences tool calls, handles intermediate results
- State persistence: `agentStateService.js` → Redis (`agent_state:{sessionId}`)
- Fast LLM calls (decomposition, critique, synthesis) use `llmFallbackService.callFast()` → Groq llama-3.1-8b-instant

### totOrchestrator.js — Tree-of-Thought
- Generates N branches (reasoning paths) via LLM
- Scores each branch → prunes low-confidence paths (`totPruningService.js`)
- Redis state key: `tot_state:{sessionId}` — persists branch history + insights
- Gate: complexity score ≥ 85 required (or user explicitly requested)

### reactOrchestrator.js — ReAct Pattern
- Implements Reason → Act → Observe loop
- `reactToolSelector.js` picks tools per step
- `toolReactOrchestrator.js` executes selected tools

### deepResearchOrchestrator.js — Multi-step Research
- Coordinates research plan → sub-queries → synthesis
- `researchPlanService.js` + `researchSynthesisService.js`
- Optional: CitationGraph, FactChecking, SourceCredibility services

---

## 8. LLM Routing & Model Selection

### llmRouterService.js — selectLLM()
Decision order:
1. Check user's `modelRoutingMode` (manual/auto/course-specific)
2. Course adapter mapping (`CourseAdapterMapping` model) — per-course fine-tuned models
3. Smart router: `smartModelRouterService.calculateComplexityScore()` → picks Groq/Gemini/Ollama/SGLang
4. Provider priority: `providerPriorityService.getProviderChain()` — ordered fallback
5. Result cached in Redis (5min TTL)

### LLM Providers (services layer)
| Service | Provider | Use Case |
|---|---|---|
| `geminiService.js` | Google Gemini Flash/Pro | Default cloud provider |
| `groqService.js` | Groq (llama-3.1-8b-instant, 70b) | Fast calls, routing, synthesis |
| `sglangService.js` | SGLang + Qwen2.5-7B-AWQ | Local GPU inference |
| `ollamaService.js` | Ollama (qwen2.5:3b + mxbai-embed-large) | Local embeddings + small LLM |
| `anthropicService.js` | Claude (Anthropic) | Optional cloud |
| `openaiService.js` | OpenAI GPT-4 | Optional cloud |
| `mistralService.js` | Mistral | Optional cloud |
| `llmFallbackService.js` | Cascade: Groq → Ollama → Gemini | Auto-fallback on error |
| `llmStreamingService.js` | Provider-agnostic streaming | SSE wrapper |

### semanticRouter.js — routeQuery()
- Embeds query via Ollama `/api/embeddings`
- Cosine similarity vs. cached intent prototypes (stored in `server/data/semantic_router_cache.json`)
- Returns `{ intent, confidence, tools[], shouldReject, rejectionMessage }`
- Feedback loop: `routerFeedbackService.js` records misses to `server/data/router_feedback.json`

---

## 9. Python RAG Service (FastAPI)

### app.py — Key Endpoints

| Endpoint | Handler | Description |
|---|---|---|
| `POST /query` | VectorDBService + GraphRAG | Hybrid RAG: Qdrant semantic + Neo4j graph + ES full-text |
| `POST /ingest` | course_pipeline | PDF → chunks → embed → Qdrant + Neo4j KG |
| `POST /ingest/cpurses` | material_discovery | Scan Cpurses/ dir, auto-ingest new PDFs |
| `POST /generate/skill-tree` | skill_tree_generator | Build JSON skill tree from course content |
| `POST /generate/study-questions` | study_questions_generator | Generate study Qs per topic |
| `POST /generate/subtopic-notes` | subtopic_notes_generator | Generate structured notes |
| `POST /deep-research` | deep_research / CrewAI | Multi-agent deep research |
| `POST /code/analyze` | ai_core | Code analysis + test case generation |
| `POST /generate/quiz` | quiz_utils | Quiz question generation |
| `GET /health` | — | Health check (Node calls this on startup) |

### vector_db_service.py — VectorDBService
- Qdrant client for collection CRUD
- `search_documents(query, collection, top_k, filter)` → embed query → cosine search
- Embedding provider: `config.get_embedding_model()` → Ollama (`EMBED_PROVIDER=ollama`) or SentenceTransformers
- Collection vector dim: 1024 (mxbai-embed-large)

### graph_rag.py — GraphRAG
- `extract_and_store_graph(text, doc_name, user_id)` → LLM extracts entities/relations → Neo4j
- `query_graph(query, user_id)` → Neo4j full-text index `node_search_index` + Cypher traversal
- Requires index: `CALL db.index.fulltext.createNodeIndex('node_search_index', ['KnowledgeNode'], ['nodeId', 'description'])`

### config.py — Key Config Variables
```python
QDRANT_HOST / QDRANT_URL / QDRANT_COLLECTION_NAME
NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD / NEO4J_DATABASE
EMBED_PROVIDER          # 'ollama' (default) | 'sentence_transformers'
OLLAMA_BASE_URL         # http://localhost:11434
QUERY_EMBEDDING_MODEL_NAME  # mxbai-embed-large
QDRANT_COLLECTION_VECTOR_DIM  # 1024
GEMINI_API_KEY          # from server/.env
```

---

## 10. Frontend Architecture

### Entry Point & Routing
- `main.jsx` → React Router → `App.jsx`
- Protected routes via JWT in localStorage

### Core Hook: useChat.jsx
- Manages all chat state: messages, sessions, mode toggles
- Consumes SSE stream from `/api/chat/message`
- Handles `streamEvent` types: `thinking`, `tool_call`, `partial_answer`, `final_answer`, `error`
- Controls: `tutorMode`, `criticalThinkingEnabled`, `useWebSearch`, `useAcademicSearch`, `deepResearchMode`, `useReAct`

### Key Components
| Component | Location | Purpose |
|---|---|---|
| `CenterPanel.jsx` | layout/ | Main chat window orchestrator |
| `ChatInput.jsx` | chat/ | Message input + toggle controls |
| `MessageBubble.jsx` | chat/ | Renders markdown, code blocks, citations |
| `StreamingResponse.jsx` | chat/ | Live token streaming display |
| `AnimatedThinking.jsx` | chat/ | ToT branch visualization |
| `TaskTreeVisualization.jsx` | chat/ | ReAct step-by-step tree |
| `DeepResearchPage.jsx` | research/ | Full deep research UI |
| `ResearchPipelineTracker.jsx` | research/ | Live pipeline progress |
| `TutorSessionPanel.jsx` | chat/ | Socratic tutor session controls |
| `KnowledgeGraphViewer.jsx` | analysis/ | D3/Cytoscape KG visualization |
| `OrchestratorMonitor.jsx` | debug/ | Dev: routing + agent debug panel |
| `AdminDashboardPage.jsx` | admin/ | Full admin dashboard |
| `LLMConfigManager.jsx` | admin/ | Model catalog management |

### api.js — Service Layer
- `sendMessage(payload)` → SSE fetch to `/api/chat/message`
- `startDeepResearch(query)` → `/api/deep-research`
- All other REST calls (sessions, files, gamification, admin…)

---

## 11. Gamification Engine

Node.js cron jobs + service layer:

| Component | File | Description |
|---|---|---|
| XP / Leveling | `gamificationService.js` | Award XP on message, quiz, study |
| Badges | `badgeService.js`, `achievementService.js` | Unlock criteria checks |
| Streaks | `streakService.js` | Daily login streaks |
| Energy | `energyService.js` | Stamina system for actions |
| Boss Battles | `bossBattleService.js` | Cron: generate → fight → cleanup |
| Bounties | `bountyService.js` | Challenge quests with rewards |
| Skill Tree Game | `skillTreeGameService.js` | Mastery node progression |
| Spaced Repetition | `jobs/spacedRepetitionScheduler.js` | SM-2 algorithm scheduling |
| Bloom Scoring | `bloomScoringService.js` | Classify answer depth (Bloom taxonomy) |

---

## 12. Knowledge Graph Pipeline

### Ingestion (Python)
1. PDF uploaded → `pdf_processor.py` → chunks
2. Chunks embedded → Qdrant collection
3. LLM extracts entity-relation triples → `neo4j_handler.py` → Neo4j nodes + edges
4. Curriculum graph: `curriculum_graph_handler.py` → subject → topic → subtopic nodes
5. Skill tree: `skill_tree_generator.py` → JSON + Neo4j

### Query (Node.js)
- `kgService.js` → Neo4j Cypher queries for concept traversal
- `kgExtractionService.js` → extract KG from user messages (real-time)
- `retrievalRouter.js` → decides Qdrant vs. Neo4j vs. Elasticsearch per query type
- Real-time KG: `isKgRealtimeEnabled` flag → KG extraction on each message

---

## 13. Context Management

### contextManager.js — buildOptimalContext()
- Trims chat history to fit LLM context window
- Rolling summary: if history > threshold → `llmFallbackService.callFast()` → summarize → stored in MongoDB ChatHistory.summary
- `doesQuerySuggestRecall()` — detect "remember when…" → load more history

### agentStateService.js — Redis State
```
Redis keys:
  agent_state:{sessionId}     — priorInsights, branchHistory, toolResults
  reasoning_state:{sessionId} — ToT dimensions, insights
  tot_state:{sessionId}       — Tree-of-Thought branches
  routing_cache:{queryHash}   — 5min cached routing decision
```

### contextualMemoryMiddleware.js
- Injects user learning profile + recent session context into system prompt
- Runs before every chat request

---

## 14. Security & Middleware Stack

```
Request → Helmet (CSP/HSTS) → CORS → mongoSanitize (NoSQL injection)
        → rateLimitMiddleware (Redis-backed; per-route limits)
        → authMiddleware (JWT verify)
        → validateChatMessage (Zod schema)
        → injectContextualMemory
        → route handler
```

- **API keys**: User keys AES-encrypted in MongoDB (`utils/crypto.js`), decrypted per-request
- **Rate limits**: Auth (5/15min), Chat (60/min), Research (10/min), Tools (30/min)
- **Admin**: Separate `adminAuthMiddleware` + `adminMasterRouter`
- **APM**: Sentry on every response, Prometheus metrics at `/metrics`

---

## 15. Persistence Layer Summary

| Store | What's Persisted |
|---|---|
| MongoDB | Users, ChatHistory (messages + rolling summary), LLMConfiguration catalog, CourseAdapterMapping, gamification state, feedback, analytics |
| Redis | Agent/reasoning/ToT state per session, routing cache, rate limit counters, session tokens |
| Neo4j | Knowledge graph nodes/edges, curriculum graph, skill trees, concept relationships |
| Qdrant | Document embeddings by collection (per-course + user-uploaded docs) |
| Elasticsearch | Full-text document index for keyword fallback search |
| Filesystem | `server/Cpurses/` (watched PDFs), `server/course_bootstrap/` (processed pipelines + skill_tree.json), `server/assets/` (user uploads), `server/data/` (router feedback cache) |

---

## 16. Course Material Pipeline

```
Admin uploads PDF → server/Cpurses/
        ↓ chokidar file watcher (5s debounce, server.js)
POST /ingest/cpurses → Python RAG service
        ↓ pdf_processor.py → text chunks
        ↓ embed chunks → Qdrant (per-course collection)
        ↓ LLM extract triples → Neo4j KG nodes
        ↓ skill_tree_generator.py → skill_tree.json + Neo4j
        ↓ study_questions_generator.py → pre-computed study Qs
        ↓ subtopic_notes_generator.py → structured notes
Result: course fully indexed for RAG + Socratic tutor
```

Also supported: `server/course_bootstrap/` for batch pre-processing with `pipeline_state.json` tracking.

---

## 17. Deep Research Pipeline

```
User query with deepResearchMode=true
   → deepResearchOrchestrator.js
       → researchPlanService.js → decompose into sub-questions
       → FOR EACH sub-question (parallel):
           - webSearchService.js (DuckDuckGo/Serper)
           - academicSourceService.js (Semantic Scholar, ArXiv, CrossRef)
           - ragQueryService.js (internal knowledge)
       → factCheckingService.js + sourceCredibilityService.js
       → citationEnrichmentService.js → DOI resolution
       → researchSynthesisService.js → Gemini/Groq synthesis
       → Stream structured report with citations to frontend

OR (if USE_CREWAI_RESEARCH=true):
   → Python RAG /deep-research → crew/research_crew.py
       → CrewAI agents: Researcher, Analyst, Writer, Critic
```

---

## 18. Development Startup

```bash
# 1. Start infrastructure
docker compose up -d mongo redis neo4j qdrant elasticsearch ollama sglang

# 2. Terminal 1 — Python RAG service
cd server/rag_service && conda run -n imentor python app.py

# 3. Terminal 2 — Node.js backend
cd server && node server.js

# 4. Terminal 3 — React frontend
cd frontend && npm run dev

# Or use the launcher:
./startup.sh   # opens 3 gnome-terminal tabs automatically
```

**Environment:** `server/.env` must have `GEMINI_API_KEY`, `GROQ_API_KEY`, `MONGO_URI`, `REDIS_URL`, `NEO4J_URI`, `QDRANT_URL`, `OLLAMA_API_BASE_URL`, `PYTHON_RAG_SERVICE_URL=http://localhost:2001`

---

## 19. Key Extension Points

| What to Modify | Where |
|---|---|
| Add new LLM provider | `server/services/<provider>Service.js` + wire in `llmRouterService.js` + `routingConfig.js` |
| Add new chat route/intent | `routingConfig.js` ROUTES + `chat/index.js` waterfall + new handler in `chat/handlers/` |
| Add tool to agent | `toolRegistry.js` + implement in `toolExecutionService.js` |
| Add RAG endpoint | `rag_service/app.py` + call from `ragQueryService.js` |
| Add gamification rule | `gamificationService.js` + `badgeService.js` criteria |
| Change prompt templates | `server/config/promptTemplates.js` (single source) |
| Add admin dashboard panel | `frontend/src/components/admin/` + new route in admin router |
| Change semantic router prototypes | `server/data/semantic_router_cache.json` or retrain via `scripts/rebuild_semantic_cache.py` |
| Change embedding model | `server/rag_service/config.py` `EMBED_PROVIDER` + `QUERY_EMBEDDING_MODEL_NAME` |
| Tune routing thresholds | `routingConfig.js` THRESHOLDS section |

---

## 20. Known Architecture Notes

1. **Dev vs. Production**: In dev, server/rag/frontend run as local processes. Docker app services (server, rag, frontend containers) are for production only. Never run `docker compose up -d rag` in dev.
2. **GPU allocation**: SGLang owns the GPU. Ollama is CPU-only (`OLLAMA_NUM_GPU=0`). Set `SGLANG_ENABLED=false` in .env to disable local inference and fall through to cloud.
3. **CrewAI**: Disabled by default (`USE_CREWAI_RESEARCH=false`). Lazily imported; import failures are silently swallowed — deep research falls back to JS pipeline.
4. **Rolling summary**: Chat history compaction happens in-band on every request via `contextManager`. Long-lived sessions accumulate a MongoDB `summary` field; actual message array is pruned.
5. **Router feedback loop**: Semantic router misses are logged to `server/data/router_feedback.json`. Run `scripts/rebuild_semantic_cache.py` to incorporate feedback into the cache.
6. **File watchers**: `chokidar` on `Cpurses/` with 5s debounce triggers ingestion. On startup, ingestion is always triggered regardless of new files.
