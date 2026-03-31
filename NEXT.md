# iMentor Migration Strategy: React → Flutter, Node.js → Go

## Migration Targets

| Layer | From | To |
|---|---|---|
| Frontend | React/Vite | Flutter (Dart) |
| API Server | Node.js (Express) | Go (Gin/Fiber) |
| AI/RAG Service | Python FastAPI | Keep as microservice OR port non-ML core to Go |
| All DBs | Unchanged | MongoDB, Redis, Neo4j, Qdrant, Elasticsearch |

The Python RAG service should **stay as a Python microservice** — porting `marker-pdf`, `sentence-transformers`, `qdrant-client`, and `neo4j` to Go is not worth it. The Go server simply calls it over HTTP, exactly as Node.js does now. This is the only pragmatic call here.

---

## Overall Phase Strategy

```
Phase 0 — Audit & Contract Generation     (Agents 1-2)
Phase 1 — Go Server Scaffold + Core       (Agents 3-5)
Phase 2 — Go Route + Service Migration    (Agents 6-9)
Phase 3 — Flutter Scaffold + State        (Agents 10-12)
Phase 4 — Flutter UI Migration            (Agents 13-15)
Phase 5 — Integration & Validation        (Agents 16-17)
Phase 6 — CI/CD Automation               (Agents 18-21)
```

Each agent operates in an isolated git worktree branch. No agent merges to `main` — that is the CI/CD agent's responsibility after validation passes.

---

## Agent Definitions

### Phase 0 — Audit & Contract

---

**Agent 1 — Codebase Audit Agent**

```
Role: Code analyst / spec generator
Trigger: Once, at migration kickoff
Input: Entire repo (server/, frontend/, docker-compose.yml)

Responsibilities:
  - Enumerate all REST routes with method, path, auth requirement,
    request/response shape, and streaming flag (SSE vs JSON)
  - Map all services to their dependencies (DB clients, LLM calls,
    Python RAG calls, Redis keys)
  - Identify all environment variables and their consumers
  - Flag stateful vs stateless handlers
  - Output: migration_spec/api_contracts.json
             migration_spec/service_dependency_map.json
             migration_spec/env_var_registry.json
             migration_spec/streaming_endpoints.md

Does NOT write any Go or Dart code.
```

---

**Agent 2 — Data Model Agent**

```
Role: Schema extractor and Go/Dart struct generator
Trigger: After Agent 1 completes
Input: migration_spec/api_contracts.json, server/models/, MongoDB schemas

Responsibilities:
  - Extract all MongoDB document shapes from Mongoose models
  - Generate Go structs with bson/json tags for each model
  - Generate Dart model classes with fromJson/toJson for Flutter
  - Generate OpenAPI 3.0 spec from api_contracts.json
  - Output: go_server/internal/models/*.go
             flutter_app/lib/models/*.dart
             migration_spec/openapi.yaml

These files are the source of truth for all downstream agents.
```

---

### Phase 1 — Go Server Foundation

---

**Agent 3 — Go Scaffold Agent**

```
Role: Go project architect
Trigger: After Agent 2 completes
Input: migration_spec/env_var_registry.json

Responsibilities:
  - Initialize Go module (go mod init)
  - Set up directory structure:
      go_server/
        cmd/server/main.go
        internal/
          config/     (env loading via viper)
          db/         (mongo, redis, neo4j, qdrant clients)
          middleware/ (auth JWT, CORS, rate limit, request logging)
          models/     (from Agent 2)
          routes/
          services/
        pkg/
  - Wire all DB connection pools with health check endpoints
  - Implement /health and /ready endpoints
  - Set up structured logging (zerolog or slog)
  - Set up Gin router with middleware chain matching current Express chain
  - Write Dockerfile for go_server
  - Does NOT implement any business logic routes yet
```

---

**Agent 4 — Go Auth Agent**

```
Role: Auth route + JWT middleware migrator
Trigger: After Agent 3 completes
Input: server/routes/auth.js, server/middleware/ (inferred from server.js)

Responsibilities:
  - Port /auth/register, /auth/login, /auth/logout, /auth/refresh
  - Implement JWT signing/verification matching current secret + algorithm
  - Implement session middleware compatible with existing Redis session keys
  - Port role-based access control if present
  - Write unit tests for all auth handlers
  - Validate against migration_spec/openapi.yaml auth endpoints
```

---

**Agent 5 — Go DB Adapter Agent**

```
Role: Database client wrapper author
Trigger: Parallel with Agent 4
Input: All server/services/*.js files that touch MongoDB/Redis/Neo4j/Qdrant

Responsibilities:
  - Write typed Go wrappers for every MongoDB collection operation
    (no raw bson.M — all typed with structs from Agent 2)
  - Write Redis key-namespaced client with TTL policies matching current
  - Write Neo4j session pool with Cypher query functions for every
    distinct query found in Node.js services
  - Write Qdrant Go client wrappers for each collection
    (my_qdrant_rag_collection, stn_notes, pedagogical_notes,
     scholarly_claims, study_questions)
  - Write integration tests that run against real local DBs
  - Does NOT implement any route logic
```

---

### Phase 2 — Go Route & Service Migration

These agents run **in parallel** after Phase 1 completes.

---

**Agent 6 — Go Chat & Tutor Routes Agent**

```
Role: Chat pipeline migrator
Input: server/routes/chat/index.js, handlers/standardHandler.js,
       handlers/tutorHandler.js, helpers.js,
       server/services/llmRouterService.js,
       server/services/llmStreamingService.js,
       server/services/socraticTutorService.js,
       server/services/contextManager.js

Responsibilities:
  - Port /chat POST endpoint with all routing logic
  - Implement SSE streaming handler in Go (http.Flusher pattern)
  - Port query classifier logic (map JS semantic router to Go)
  - Port context manager (conversation history window, Redis storage)
  - Port tutor mode: Socratic question generation, hint escalation,
    mastery tracking calls
  - Call Python RAG service via HTTP (do not re-implement RAG)
  - All LLM calls go to SGLang :8000 via OpenAI-compatible client
  - Write integration tests with mocked LLM and real Redis
```

---

**Agent 7 — Go Deep Research Routes Agent**

```
Role: Research orchestrator migrator
Input: server/routes/deepResearch.js,
       server/services/deepResearchOrchestrator.js,
       server/services/researchSynthesisService.js,
       server/services/agentService.js,
       server/services/toolExecutionService.js

Responsibilities:
  - Port /deep-research POST and SSE streaming endpoint
  - Port multi-step orchestrator: query decomposition → parallel
    sub-queries → synthesis → streaming result back to client
  - Port tool execution service (web search, RAG calls, code execution)
  - Port agent service (tool-use loop against SGLang)
  - Maintain SSE event schema identical to current (frontend depends on it
    until Flutter migration is validated)
```

---

**Agent 8 — Go Progress & Knowledge Routes Agent**

```
Role: Progress tracking + knowledge base migrator
Input: server/routes/progress.js, server/routes/knowledgeSource.js,
       server/routes/upload.js

Responsibilities:
  - Port /progress GET/POST (XP, Bloom's level, skill tree state)
  - Port /knowledge-source CRUD
  - Port /upload with multipart handling, file validation,
    and Python RAG service handoff (POST /pipeline/run)
  - Maintain identical JSON response shapes
```

---

**Agent 9 — Go LLM Fallback & Model Manager Agent**

```
Role: LLM infrastructure migrator
Input: server/services/llmFallbackService.js,
       server/services/ollamaService.js,
       server/services/ollamaHealthService.js,
       server/services/ollamaModelManager.js,
       server/services/sglangService.js,
       server/models/LLMConfiguration.js,
       server/config/routingConfig.js

Responsibilities:
  - Port LLM provider abstraction (SGLang primary, Ollama fallback)
  - Port health polling goroutine for Ollama/SGLang
  - Port model routing config (load from DB + env, hot-reload on change)
  - Port fallback chain: SGLang → Ollama → error
  - Write LLM provider interface so future providers are plug-in
```

---

### Phase 3 — Flutter Foundation

---

**Agent 10 — Flutter Scaffold Agent**

```
Role: Flutter project architect
Trigger: Can start parallel to Phase 2
Input: migration_spec/openapi.yaml, migration_spec/streaming_endpoints.md

Responsibilities:
  - Initialize Flutter project (flutter create)
  - Set up directory structure:
      lib/
        core/
          api/       (Dio HTTP client, SSE stream handler)
          auth/      (token storage via flutter_secure_storage)
          router/    (GoRouter)
        features/
          auth/
          chat/
          research/
          progress/
        models/      (from Agent 2 Dart files)
        shared/
  - Set up Riverpod as state management
  - Set up GoRouter with auth guard
  - Configure Dio with interceptors (auth token, error handling)
  - Write SSE client that reconnects and parses event streams
  - Configure build flavors: dev (localhost) / prod
  - Write pubspec.yaml with all required packages
```

---

**Agent 11 — Flutter API Service Agent**

```
Role: API client layer author
Trigger: After Agent 10 completes
Input: migration_spec/openapi.yaml, migration_spec/streaming_endpoints.md,
       Dart models from Agent 2

Responsibilities:
  - Generate typed API service classes for every endpoint group:
      AuthApiService, ChatApiService, ResearchApiService,
      ProgressApiService, UploadApiService
  - Implement SSE stream parsing for /chat and /deep-research
  - Implement request/response serialization using Dart models
  - Write mock API services for UI development (offline-first testing)
  - Write Riverpod providers for each service
  - Write unit tests for serialization round-trips
```

---

**Agent 12 — Flutter State Management Agent**

```
Role: Application state architect
Trigger: After Agent 11 completes
Input: frontend/src/hooks/useChat.jsx, useAuth (inferred from App.jsx),
       services/api.js

Responsibilities:
  - Port useChat hook logic → Riverpod ChatNotifier
    (conversation history, streaming buffer, loading states)
  - Port auth state → Riverpod AuthNotifier
    (login, logout, token refresh, persistence)
  - Port deep research state → Riverpod ResearchNotifier
    (step progress, intermediate results, final synthesis)
  - Port progress/gamification state → Riverpod ProgressNotifier
  - Wire all notifiers to API services from Agent 11
  - No UI widgets in this agent's scope
```

---

### Phase 4 — Flutter UI Migration

These agents run **in parallel** after Phase 3 completes.

---

**Agent 13 — Flutter Auth UI Agent**

```
Role: Auth screens builder
Input: frontend/src/components/auth/AuthModal.jsx,
       Riverpod AuthNotifier from Agent 12

Responsibilities:
  - Login screen (email + password, form validation)
  - Register screen
  - Token-based navigation guard (redirect to chat on success)
  - Match visual design of current modal (dark theme, iMentor branding)
  - Write widget tests
```

---

**Agent 14 — Flutter Chat UI Agent**

```
Role: Chat interface builder
Input: frontend/src/components/chat/ChatInput.jsx,
       frontend/src/components/chat/MessageBubble.jsx,
       frontend/src/components/layout/CenterPanel.jsx,
       frontend/src/components/layout/TopNav.jsx

Responsibilities:
  - ChatScreen with scrollable message list
  - MessageBubble widget: user vs assistant, markdown rendering
    (flutter_markdown), code highlighting
  - ChatInput with send button, mode selector (normal/tutor/deep research)
  - SSE streaming: append tokens to last bubble in real-time
  - TopNav with course selector, mode indicator, user menu
  - Knowledge base dropdown (port KnowledgeBaseDropdown.jsx)
  - Write widget tests for bubble rendering
```

---

**Agent 15 — Flutter Deep Research UI Agent**

```
Role: Research panel builder
Input: frontend/src/components/research/DeepResearchPage.jsx,
       frontend/src/components/research/DeepResearchPanel.jsx,
       Riverpod ResearchNotifier from Agent 12

Responsibilities:
  - Research query input screen
  - Step-by-step progress display (sub-query → result → synthesis)
  - Animated progress indicators for each research stage
  - Final synthesis display with source citations
  - SSE event-driven updates (each stage streams as it completes)
  - Collapsible intermediate results
```

---

### Phase 5 — Integration & Validation

---

**Agent 16 — Contract Validation Agent**

```
Role: API contract regression tester
Trigger: After Go server Phase 2 is complete
Input: migration_spec/openapi.yaml, running Go server, running Node.js server

Responsibilities:
  - Run both servers simultaneously on different ports
  - For every non-streaming endpoint: send identical requests to both,
    diff JSON responses, assert structural equality
  - For SSE endpoints: capture full event streams from both, compare
    event sequence and payload shapes
  - For auth: validate JWT tokens issued by Go server are accepted
    by Go middleware (round-trip)
  - Report: contract_validation_report.json
  - FAILS the migration phase if any critical endpoint diverges
  - Does not merge anything — only reports
```

---

**Agent 17 — Flutter Integration Test Agent**

```
Role: End-to-end Flutter tester
Trigger: After Phase 3-4 complete
Input: Running Go server (or Node.js as proxy), Flutter app

Responsibilities:
  - Integration tests using flutter_test + integration_test package
  - Test: login → send chat message → receive streaming response
  - Test: start deep research → observe step progress → read synthesis
  - Test: upload document → pipeline trigger → knowledge base updated
  - Test: progress page shows correct XP after chat session
  - Screenshot regression tests for key screens
  - Run on Android emulator + web target
```

---

### Phase 6 — CI/CD Agents

These are **continuously running agents** wired to git events.

---

**Agent 18 — Build Verification Agent** *(CI — on every push)*

```
Role: Build integrity enforcer
Trigger: Every push to any branch

Responsibilities:
  Go server:
    - go build ./...  (zero warnings policy)
    - go vet ./...
    - staticcheck ./...
    - go test ./... -race (race detector on)
    - Report binary size delta vs main branch

  Flutter:
    - flutter analyze (zero warnings policy)
    - flutter test
    - flutter build apk --debug (confirm it compiles)
    - flutter build web --release

  Python RAG service:
    - ruff check server/rag_service/
    - mypy server/rag_service/ (strict mode)
    - pytest server/rag_service/tests/ (if test dir exists)

  Output: build_report.json posted as PR comment
  Blocks merge if: any build fails, go vet errors, flutter analyze errors
```

---

**Agent 19 — Test Runner & Coverage Agent** *(CI — on PR open/update)*

```
Role: Test quality gatekeeper
Trigger: On PR creation or new commits to PR branch

Responsibilities:
  - Run full Go test suite with -coverprofile
  - Assert coverage does not drop below threshold (70% for services,
    90% for models and DB adapters)
  - Run Flutter unit + widget tests with coverage
  - Run Python pytest with coverage
  - Run contract validation agent (Agent 16) against PR branch
  - Diff coverage vs main branch — flag regressions
  - Post coverage delta table as PR comment
  - Block merge if coverage drops or contract tests fail
```

---

**Agent 20 — Docker Build & Compose Validation Agent** *(CI — on PR to main)*

```
Role: Container integrity enforcer
Trigger: On PR targeting main branch

Responsibilities:
  - Build Docker image for Go server (multi-stage, scratch final image)
  - Build Docker image for Python RAG service
  - Build Flutter web image (Nginx-served)
  - Run docker-compose up with full stack
  - Execute smoke tests against dockerized stack:
      POST /auth/login → 200
      POST /chat → SSE stream opens and closes cleanly
      GET /health on all services → 200
      POST /pipeline/run (dry-run mode) → 202
  - Measure container startup time — fail if > 30s for Go server
  - Assert Go server image < 50MB (scratch base)
  - Clean up all containers after test
  - Block merge if any smoke test fails or image build fails
```

---

**Agent 21 — Deployment Agent** *(CD — on merge to main)*

```
Role: Release orchestrator
Trigger: Merge to main branch (after Agents 18-20 pass)

Responsibilities:
  Staging deployment:
    - Tag images with git SHA
    - Push to container registry
    - Deploy to staging environment via docker-compose pull + up
    - Run health checks every 5s for 60s (fail deployment if not healthy)
    - Run integration test suite against staging URL
    - Send deployment summary (services updated, image tags, test results)
      to configured notification channel

  Production gate:
    - Require manual approval (human-in-the-loop gate)
    - On approval: rolling restart of Go server (zero-downtime)
    - Keep Python RAG service up during Go server restart
      (Python is stateless per-request, Redis holds state)
    - Post-deploy: run smoke tests against production
    - On failure: automatic rollback to previous image tag
    - Record deployment in deployment_log.json (SHA, timestamp, who approved)

  Rollback capability:
    - Always keep last 3 image versions in registry
    - Rollback command: re-deploy previous SHA without full pipeline
```

---

## Summary Table

| # | Agent | Phase | Parallel? |
|---|---|---|---|
| 1 | Codebase Audit | 0 | No (first) |
| 2 | Data Model | 0 | After 1 |
| 3 | Go Scaffold | 1 | After 2 |
| 4 | Go Auth | 1 | After 3 |
| 5 | Go DB Adapter | 1 | Parallel with 4 |
| 6 | Go Chat & Tutor Routes | 2 | Parallel group |
| 7 | Go Deep Research Routes | 2 | Parallel group |
| 8 | Go Progress & Knowledge Routes | 2 | Parallel group |
| 9 | Go LLM Fallback & Model Manager | 2 | Parallel group |
| 10 | Flutter Scaffold | 3 | Parallel with Phase 2 |
| 11 | Flutter API Service | 3 | After 10 |
| 12 | Flutter State Management | 3 | After 11 |
| 13 | Flutter Auth UI | 4 | Parallel group |
| 14 | Flutter Chat UI | 4 | Parallel group |
| 15 | Flutter Deep Research UI | 4 | Parallel group |
| 16 | Contract Validation | 5 | After Phase 2 |
| 17 | Flutter Integration Test | 5 | After Phase 4 |
| 18 | Build Verification | CI | Every push |
| 19 | Test Runner & Coverage | CI | Every PR |
| 20 | Docker Build & Compose Validation | CI | PR to main |
| 21 | Deployment | CD | Merge to main |

**Total: 21 agents — 17 migration agents + 4 CI/CD agents**

---

## Key Design Principles

1. **Agents 1-2 generate machine-readable specs** (JSON, OpenAPI) that all downstream agents consume — this prevents drift between Go and Flutter implementations.

2. **Python RAG service is never touched by any migration agent.** The Go server calls it identically to how Node.js does. This de-risks the highest-complexity part of the system.

3. **CI/CD agents enforce contracts, not just builds.** Agent 16 (contract validation) runs in both CI and CD so regressions are caught at PR time, not after deployment.

4. **Agent 21 has a mandatory human gate before production.** CD automation handles staging completely; production requires approval. This is appropriate given the SGLang GPU dependency and stateful Redis/Neo4j.

5. **Each agent owns a branch.** No agent writes directly to `main`. All merges go through the CI/CD agents after validation passes.
