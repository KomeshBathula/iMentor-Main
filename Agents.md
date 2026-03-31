# iMentor: Major Modules & Agent Construction Architecture

---

## Part 1 — Major Modules & Processes

### M1 · Auth & User Management
**Files:** `server/routes/auth.js`, `server/models/User.js`, `frontend/src/components/auth/`
- JWT auth, role-based access (student / admin), onboarding flow, pending registration queue
- Contextual memory middleware attaches user profile to every request

---

### M2 · LLM Routing Layer
**Files:** `server/services/llmRouterService.js`, `server/services/queryClassifierService.js`, `server/services/semanticRouterService.js`, `server/config/routingConfig.js`
- **Query classifier** → intent (factual / reasoning / lecture / research)
- **Semantic router** → cosine similarity cache → provider match
- **LLM Router** → dispatches to SGLang (3-tier), Gemini, Groq, Claude, Ollama
- **Fallback chain** → if primary fails, cascades to next provider
- **Streaming service** → chunked SSE to frontend

---

### M3 · Chat Pipeline
**Files:** `server/routes/chat/`, `server/routes/chat/handlers/`, `server/services/contextManager.js`
- Two modes: `standardHandler` (direct Q&A) and `tutorHandler` (Socratic guided)
- Context manager builds sliding-window + KG-augmented prompt
- Streaming responses via SSE

---

### M4 · Socratic Tutor Engine
**Files:** `server/services/socraticTutorService.js`, `server/services/tutorStateMachine.js`, `server/services/pedagogicalEngine.js`, `server/config/tutorStates.js`
- State machine: `PROBE → SCAFFOLD → CHALLENGE → REFLECT → ASSESS`
- Bloom's taxonomy scoring, adaptive scaffolding, teaching reflection
- CoT (chain-of-thought) and ToT (tree-of-thought) reasoning services
- Syllabus-anchored teaching policy

---

### M5 · Agentic / Tool-Use Layer
**Files:** `server/services/agentOrchestrator.js`, `server/services/toolRegistry.js`, `server/services/toolReactOrchestrator.js`, `server/services/taskDecompositionService.js`
- ReAct loop: Reason → Select Tool → Execute → Observe → Next
- Tools: web search, web crawl, KG query, calculator, code exec
- Task graph for multi-step decomposed plans
- Deep Research Orchestrator: plan → parallel searches → synthesis

---

### M6 · RAG + Knowledge Pipeline (Python)
**Files:** `server/rag_service/`, `server/rag_service/graph_rag.py`, `server/rag_service/vector_db_service.py`, `server/rag_service/course_pipeline.py`
- **Ingestion:** PDF → markdown → chunked embeddings → Qdrant
- **Graph RAG:** Neo4j stores concept nodes + `RELATES_TO`, `PREREQUISITE_OF` edges
- **Retrieval Router:** decides dense (Qdrant) vs graph (Neo4j) vs hybrid
- **Syllabus Linker:** connects Qdrant chunks to Neo4j skill tree nodes

---

### M7 · Course Authoring & Lecture Generation
**Files:** `lecture_generator/`, `generate_lecture.py`, `bootstrap_course.py`
- Syllabus.csv → concept extraction → lecture HTML/MD generation (via SGLANG_HEAVY)
- Concept map builder (pyvis graph)
- Skill tree generator → study questions per node → subtopic notes
- Output: `lectures/<topic>/` with HTML, MD, concept_map.html

---

### M8 · Gamification System
**Files:** `server/services/gamificationService.js`, `server/services/bossBattleService.js`, `server/services/bountyService.js`, `server/models/GamificationProfile.js`
- XP, levels, badges, streaks, energy system
- **Boss Battles:** AI-generated multi-question assessment events
- **Bounties:** open challenge questions with reward XP
- Cron jobs: nightly evaluator, spaced repetition scheduler, boss/bounty generators

---

### M9 · Learning Analytics & Adaptation
**Files:** `server/services/knowledgeGapAnalyzer.js`, `server/services/sessionAnalysisService.js`, `server/models/StudentKnowledgeState.js`, `server/services/continuousLearningScheduler.js`
- Student knowledge state tracked per concept node
- Gap analysis after each session → feeds adaptive scaffolding
- Spaced repetition scheduler (SM-2 style)
- Drift detection: model performance vs student outcomes

---

### M10 · Fine-Tuning / Self-Improvement Loop
**Files:** `server/services/trainingDataGenerator.js`, `server/services/fineTuningLoop.js`, `server/services/modelEvaluationService.js`, `server/services/incrementalTrainer.js`
- Good sessions → synthetic data generation → fine-tune dataset
- Evaluation harness, performance logging, incremental trainer
- Model deployment service manages new weights

---

### M11 · Infrastructure Layer
**Docker:** MongoDB, Redis, Neo4j, Qdrant, Elasticsearch, Ollama, SGLang
- MongoDB: all user/session/model data
- Redis: session cache, routing cache, rate limiting
- Neo4j: knowledge graph traversal
- Qdrant: vector similarity search
- Elasticsearch: full-text fallback search
- Ollama: embeddings only (mxbai-embed-large, CPU)

---

### M12 · Admin & Observability
**Files:** `server/routes/admin.js`, `server/services/modelMonitoringService.js`, `monitor/`
- Admin: LLM config management, user management, system benchmarks
- Monitor: log watcher, AI-driven error handler, metrics exporter
- Reasoning telemetry logs, audit trails

---

---

## Part 2 — Agent Construction Plan

### Agent 1 — `InfrastructureAgent`
**Scope:** M11 (Docker, DBs, networking)
**Definition:**
> You own all infrastructure: Docker Compose, DB schema initializations, connection pooling, environment configuration, and network topology. You provision MongoDB, Redis, Neo4j, Qdrant, Elasticsearch, and the LLM serving layer (Ollama for embeddings, SGLang/vLLM for generation). Output: working `docker-compose.yml`, init scripts, `.env.example`, and health-check endpoints. You expose contracts — connection strings and health routes — that all other agents depend on. You do NOT write application logic.

**Outputs consumed by:** All agents (connection strings), DevOpsAgent (deployment)

---

### Agent 2 — `AuthAgent`
**Scope:** M1
**Definition:**
> You own identity: JWT issuance and validation, role schema (student/admin), registration flow with pending queue, password hashing, refresh tokens, and middleware that attaches decoded user identity to every request. You write the User model (Mongoose), auth routes, auth middleware, and the onboarding state tracker. You expose a standard `req.user` contract that all other route agents must consume.

**Outputs consumed by:** All backend agents (middleware)

---

### Agent 3 — `LLMRoutingAgent`
**Scope:** M2
**Definition:**
> You own the entire LLM dispatch layer. Build a query classifier (intent detection: factual / reasoning / lecture / research), a semantic router with embedding-based similarity matching and Redis caching, a multi-provider dispatcher (SGLang tiers, Gemini, Groq, Claude, Ollama), a cascading fallback chain, and a streaming SSE service. You expose a single `route(query, context) → StreamingResponse` interface. You must support hot-swap of provider configs without restart. You do NOT handle conversation context — that is the ChatAgent's job.

**Outputs consumed by:** ChatAgent, TutorAgent, ResearchAgent

---

### Agent 4 — `ChatAgent`
**Scope:** M3
**Definition:**
> You own the real-time chat pipeline: context window construction (history + KG-augmented facts), the standard Q&A handler, the streaming SSE endpoint, and session persistence to MongoDB. You consume the `route()` interface from LLMRoutingAgent and the `retrieveContext()` interface from RAGAgent. You expose REST `/chat` and WebSocket endpoints. You do NOT implement tutor logic or routing — delegate to those agents.

**Outputs consumed by:** Frontend, TutorAgent

---

### Agent 5 — `TutorAgent`
**Scope:** M4
**Definition:**
> You own the Socratic tutor engine: design and implement a finite state machine with states PROBE → SCAFFOLD → CHALLENGE → REFLECT → ASSESS. Implement Bloom's taxonomy scoring, adaptive scaffolding based on student performance, teaching reflection after sessions, and syllabi-anchored teaching policy. Integrate CoT for step-by-step reasoning and ToT for exploring multiple solution paths. You expose a `tutorTurn(studentMessage, sessionState) → {response, newState, scoreUpdate}` interface. You consume LLMRoutingAgent for generation and RAGAgent for grounding.

**Outputs consumed by:** ChatAgent (tutorHandler), GamificationAgent (score events)

---

### Agent 6 — `RAGAgent`
**Scope:** M6
**Definition:**
> You own the entire knowledge retrieval pipeline in Python (FastAPI). Implement: PDF/document ingestion → chunking → embedding (Ollama mxbai-embed-large) → Qdrant upsert; Graph RAG over Neo4j with concept nodes and prerequisite edges; a retrieval router that picks dense vs graph vs hybrid retrieval based on query type; and a syllabus linker that binds vector chunks to skill tree nodes. Expose `/retrieve`, `/ingest`, `/graph-query` REST endpoints consumed by the Node.js backend. You do NOT serve LLM generation.

**Outputs consumed by:** ChatAgent, TutorAgent, CourseAuthoringAgent

---

### Agent 7 — `CourseAuthoringAgent`
**Scope:** M7
**Definition:**
> You own the course content generation pipeline. Given a `syllabus.csv` (Module, Lecture Number, Lecture Topic, Subtopics), implement: concept extraction following the syllabus hierarchy, lecture generation (HTML + MD) via the heavy LLM tier, concept map generation using pyvis, skill tree construction with prerequisite links, study question generation per skill node, and subtopic notes. Output structured course directories. You consume RAGAgent for source material retrieval and LLMRoutingAgent's heavy-tier endpoint for generation.

**Outputs consumed by:** RAGAgent (ingests generated content), Frontend (displays lectures)

---

### Agent 8 — `AgentOrchestratorAgent`
**Scope:** M5
**Definition:**
> You own the agentic/tool-use layer. Implement the ReAct loop (Reason → Select Tool → Execute → Observe → Repeat). Build a tool registry with: web search, web crawl, knowledge graph query, calculator, and code execution tools. Implement task decomposition (breaking complex queries into a DAG of subtasks), a task graph manager for execution state, and the Deep Research Orchestrator (plan → parallel search → synthesis → citations). You expose an `agent(task, tools, context) → result` interface. You consume LLMRoutingAgent for reasoning steps.

**Outputs consumed by:** ChatAgent (complex queries), ResearchAgent

---

### Agent 9 — `GamificationAgent`
**Scope:** M8
**Definition:**
> You own the engagement and reward system. Implement: XP calculation, level progression, badge award logic, streak tracking, and energy system. Build the Boss Battle system (AI-generated assessment events with multiple questions, triggered by cron). Build the Bounty system (open challenge questions with XP rewards). Implement all cron jobs: nightly session evaluator, spaced repetition scheduler, boss/bounty generators and cleaners. You expose event-driven hooks: `onSessionComplete(result)`, `onCorrectAnswer(context)` that any module can call.

**Outputs consumed by:** Frontend (gamification UI), LearningAnalyticsAgent

---

### Agent 10 — `LearningAnalyticsAgent`
**Scope:** M9
**Definition:**
> You own the adaptive learning intelligence. Track per-student per-concept knowledge state in MongoDB. Implement: session analysis (identify knowledge gaps from conversation), gap-to-scaffold mapping (what to show next), SM-2 spaced repetition scheduling, drift detection (model performance degradation vs student outcome correlation), and a continuous learning scheduler. Expose `analyzeSession(session) → {gaps, nextReviewDates, scaffoldHints}` and `getStudentState(userId, conceptId) → KnowledgeState`. Feed analysis results to TutorAgent and GamificationAgent.

**Outputs consumed by:** TutorAgent (scaffolding), GamificationAgent (review triggers), FineTuningAgent

---

### Agent 11 — `FineTuningAgent`
**Scope:** M10
**Definition:**
> You own the self-improvement loop. Implement: training data extraction from high-quality sessions (rated by LearningAnalyticsAgent), synthetic data augmentation, fine-tuning dataset formatting, incremental trainer integration with the LLM serving layer, model evaluation harness (held-out test sets, performance metrics), and model deployment service. You consume LearningAnalyticsAgent outputs and write to the TrainingDataset and EvaluationResult models. You expose `triggerFineTuningRun(datasetId)` and `evaluateModel(modelId, testSetId)`.

**Outputs consumed by:** InfrastructureAgent (deploy new weights), LLMRoutingAgent (updated endpoints)

---

### Agent 12 — `FrontendAgent`
**Scope:** Frontend React/Vite application
**Definition:**
> You own the complete React/Vite frontend. Build components for: Auth (login/register modal), Chat interface (message bubbles, streaming SSE consumption, input), Tutor mode UI (state display, guided chat), Course browser (syllabus tree, skill tree visualization, lecture viewer), Research panel (deep research with source cards), Gamification dashboard (XP bar, badges, boss battle UI, bounty list), Admin panel (LLM config, user management), Knowledge base (document upload, graph viewer), and Profile/Onboarding. You consume all backend REST and WebSocket endpoints. You use Tailwind CSS. You do NOT implement business logic — call APIs.

**Outputs consumed by:** (end user)

---

### Agent 13 — `AdminObservabilityAgent`
**Scope:** M12
**Definition:**
> You own monitoring, admin APIs, and observability. Implement: admin routes (LLM config management, user management, system benchmark triggers), log watcher with structured parsing, AI-driven error handler (classify errors, suggest fixes), Prometheus-compatible metrics exporter, reasoning telemetry log storage, and Redis audit trails. Expose admin-authenticated routes under `/api/admin`. You instrument other agents' services non-invasively via middleware hooks — you do NOT modify their core logic.

**Outputs consumed by:** InfrastructureAgent (alerts), all agents (logging hooks)

---

---

## Part 3 — Inter-Agent Contracts & Coordination

```
InfrastructureAgent
       │ connection strings, health checks
       ▼
AuthAgent ──────────────────── req.user middleware ──────────────────► all routes
       │
LLMRoutingAgent ◄──────────────────────────────────────────────────────┐
       │ route(query) → stream                                          │
       ▼                                                                │
ChatAgent ──► RAGAgent                      AgentOrchestratorAgent ────┘
       │           │ retrieveContext()             │ tools, decomposition
       ▼           ▼                               ▼
TutorAgent ◄── context + grounding       ResearchAgent (deep research)
       │
       ├──► GamificationAgent ◄── onSessionComplete events
       │                               │
       ▼                               ▼
LearningAnalyticsAgent ◄───────── session scores
       │
       ▼
FineTuningAgent ──► new model weights ──► InfrastructureAgent

CourseAuthoringAgent ──► RAGAgent (ingest) ──► FrontendAgent (display)

AdminObservabilityAgent ──── instruments all ────────────────────────►
```

---

## Part 4 — Agent Independence vs. Collective Work

| Agent | Can work solo | Needs before starting |
|---|---|---|
| InfrastructureAgent | Yes | Nothing |
| AuthAgent | Yes | InfrastructureAgent (MongoDB URI) |
| LLMRoutingAgent | Yes | InfrastructureAgent (Redis), LLM server URLs |
| RAGAgent | Yes | InfrastructureAgent (Qdrant, Neo4j, Ollama) |
| CourseAuthoringAgent | Yes | RAGAgent contract, LLMRoutingAgent heavy tier |
| ChatAgent | No | Auth middleware, LLMRoutingAgent, RAGAgent |
| TutorAgent | No | ChatAgent pipeline, LLMRoutingAgent, RAGAgent |
| AgentOrchestratorAgent | Partially | LLMRoutingAgent, tool endpoint contracts |
| GamificationAgent | Yes | AuthAgent (userId), MongoDB schema |
| LearningAnalyticsAgent | No | TutorAgent events, KnowledgeState schema |
| FineTuningAgent | No | LearningAnalyticsAgent, LLM serving infra |
| FrontendAgent | Partially | API contracts from all backend agents |
| AdminObservabilityAgent | Yes | InfrastructureAgent, other agents' log interfaces |

---

## Part 5 — Build Order (Parallel Rounds)

**Round 1 (parallel — no dependencies):**
- InfrastructureAgent
- AuthAgent
- LLMRoutingAgent
- RAGAgent
- GamificationAgent

**Round 2 (parallel — depends on Round 1 contracts):**
- ChatAgent
- TutorAgent
- CourseAuthoringAgent
- AgentOrchestratorAgent
- AdminObservabilityAgent

**Round 3 (parallel — depends on Round 2):**
- LearningAnalyticsAgent
- FrontendAgent

**Round 4 (depends on analytics data flowing):**
- FineTuningAgent

---

> **Key design insight:** LLMRoutingAgent and RAGAgent are the shared backbone — every intelligent feature depends on them. Build those first with clean, versioned API contracts and every other agent can develop independently against those contracts.
