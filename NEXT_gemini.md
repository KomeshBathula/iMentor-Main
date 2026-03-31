# iMentor Migration Strategy: Flutter + Python Agentic Backend

## 1. Migration Strategy
The migration will occur in four parallel tracks:

1. **Frontend (React → Flutter):**
   - **Architecture:** Transition from React's `useChat` hook to Flutter's **Provider** or **Bloc** pattern for state management.
   - **Communication:** Implement SSE (Server-Sent Events) and WebSocket clients in Flutter to handle streaming response patterns.
   - **UI Parity:** Rebuild 80+ React components as Flutter widgets.

2. **Backend Orchestration (Node.js → Python Agentic Core):**
   - **Framework:** Use **LangGraph** or **CrewAI** to replace the current Node.js `server/routes/chat/index.js` waterfall.
   - **Consolidation:** Move "Routing Waterfall" logic into a **Master Router Agent** in the Python `rag_service`.
   - **State Management:** Move Redis-based session state to a unified schema managed by the Python agent orchestrator.

3. **Infrastructure (Decoupling):**
   - Replace the Node.js Express server with a lightweight **Go** or **FastAPI** gateway for Auth (JWT) and Rate Limiting, delegating all logic to the Agent Swarm.

4. **Database Integration:**
   - Keep the existing "Dual-DB" (Qdrant + Neo4j) and MongoDB/Redis setup, accessed exclusively via Python agents.

## 2. Agent Swarm Definitions
To replace the existing 100+ services and complex routing, 7 specialized agents are needed:

- **Sentinel Router:** The entry point. Classifies user intent (Socratic, Research, Code, or Quiz).
- **Knowledge Retriever (RAG):** Performs hybrid search across Qdrant and Neo4j.
- **Socratic Tutor:** Manages the pedagogical state machine (`EXPLORE → GUIDE → ASSESS`).
- **Deep Researcher:** Orchestrates multi-step plans, web/academic searches, and fact-checking.
- **Logic/Code Architect:** Handles code analysis, debugging, and test case generation.
- **Curriculum Guardian:** Manages the Knowledge Graph and user progression.
- **Gamification Oracle:** Tracks XP, badges, streaks, and triggers "Boss Battles."

## 3. CI/CD Agent Definitions
For an agentic DevOps approach:

1. **Code Guardian Agent (CI - Static):** Automates linting, security scanning, and PR reviews.
2. **Test Pilot Agent (CI - Dynamic):** Manages execution of Playwright/Pytest suites with "self-heal" capabilities.
3. **Deployment Sentinel Agent (CD):** Orchestrates Docker builds and monitors deployment health. Rollbacks on spike in error rates.
4. **Feedback Loop Agent (Post-Deploy):** Analyzes `router_feedback.json` to identify router/RAG failures and retrain prototypes.
