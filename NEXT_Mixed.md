# iMentor Hybrid Migration Strategy: Go Gateway + Python Agent Swarm

## 1. Architectural Vision
iMentor will evolve into a **Hybrid Agentic System**:
- **Go Gateway (The "Fast-Path"):** Handles Auth, Rate-limiting, Simple RAG, and UI state. It ensures sub-100ms TTFB for standard queries.
- **Python Agent Swarm (The "Deep-Path"):** Handles Socratic Tutoring, Deep Research, and GraphRAG reasoning via LangGraph/CrewAI.
- **Flutter Frontend:** A single, high-performance codebase for Web, Android, and iOS.

---

## 2. Phase 0: Contract & Schema (The Blueprint)

**Agent 1 — The Schema Architect**
- **Definition:** Analyzes current Node.js models and Express routes to generate shared contracts.
- **Tasks:** 
  - Generate `api_contract.json` (OpenAPI 3.0).
  - Generate Go structs and Dart models for all entities (User, Message, SkillTree).
- **Test of Completion:** `go build` succeeds on generated models; `flutter analyze` passes on Dart models.

---

## 3. Phase 1: Go Gateway & Auth (The Fast-Path)

**Agent 2 — Go Foundation Agent**
- **Definition:** Builds the high-concurrency Go server using Gin/Fiber.
- **Tasks:**
  - Implement JWT Auth matching existing logic.
  - Implement Redis-backed Rate Limiting.
  - Port "Simple Fast Path" (Semantic Router → Direct LLM call).
- **Test of Completion:** 
  - Login returns a valid JWT.
  - `GET /health` returns 200 within 5ms.
  - Simple chat queries return a response in <500ms.

---

## 4. Phase 2: Python Agentic Swarm (The Intelligence)

**Agent 3 — Orchestrator Agent (Runtime)**
- **Definition:** A LangGraph-based master agent in Python that takes over complex intents.
- **Tasks:**
  - Port the "Routing Waterfall" from Node.js to a "Sentinel Router Agent".
  - Implement "Stateful Socratic Agent" (replaces `tutorStateMachine.js`).
  - Integrate CrewAI for "Deep Research Agent".
- **Test of Completion:**
  - Python `/agent/chat` endpoint correctly switches between "Tutor" and "Standard" modes based on intent.
  - Research agent produces a multi-step plan with cited sources.

**Agent 4 — Knowledge Graph Agent (Runtime)**
- **Definition:** Specializes in Neo4j traversal and GraphRAG.
- **Tasks:**
  - Optimize Python Neo4j drivers for concurrent access.
  - Implement entity-relation extraction for real-time KG updates.
- **Test of Completion:**
  - Querying "How does X relate to Y?" returns a structured graph path in the RAG context.

---

## 5. Phase 3: Flutter UI Migration (The Interface)

**Agent 5 — Flutter Core Agent**
- **Definition:** Builds the Flutter app architecture using Riverpod for state management.
- **Tasks:**
  - Implement a robust SSE (Server-Sent Events) consumer for streaming text.
  - Port the 80+ React components to Flutter Widgets.
- **Test of Completion:**
  - App renders chat history from MongoDB.
  - Streaming text displays without stuttering on Android and Web.

---

## 6. Phase 4: Agentic CI/CD (The Guardians)

**Agent 6 — The Code Guardian (CI)**
- **Definition:** Monitors PRs for architectural drift.
- **Tasks:**
  - Run `ruff` (Python), `staticcheck` (Go), and `flutter analyze`.
  - Perform "Contract Testing" (ensure Go and Flutter schemas match).
- **Test of Completion:** PR is blocked if a field is added to Go but missing in Dart.

**Agent 7 — The Regression Sentinel (CD)**
- **Definition:** Automates E2E testing and self-healing rollbacks.
- **Tasks:**
  - Run Playwright (Web) and Flutter Integration Tests.
  - Monitor Sentry error rates post-deploy; trigger `git revert` if errors spike >10%.
- **Test of Completion:** A deployment with a broken chat route is automatically rolled back within 60 seconds.

---

## 7. Migration Roadmap Summary

| Phase | Component | Primary Tech | Goal |
| :--- | :--- | :--- | :--- |
| **0** | Contracts | JSON/OpenAPI | Single Source of Truth |
| **1** | Gateway | Go (Gin) | Low Latency & Security |
| **2** | Intelligence | Python (LangGraph) | Socratic Depth & Research |
| **3** | UI | Flutter (Dart) | Multi-platform Polish |
| **4** | CI/CD | GitHub Actions | Automated Quality |

---

## 8. Final Validation Suite
To consider the migration complete, the following tests must pass:
1. **The Latency Test:** 95th percentile of "Simple" queries must be < 1s.
2. **The Intelligence Test:** A blind comparison shows the "Socratic Tutor Agent" is rated 20% higher by students than the old Node.js version.
3. **The Multi-platform Test:** The app must be fully functional on Web, iOS, and Android with 100% feature parity.
