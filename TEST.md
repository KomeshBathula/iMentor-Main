# iMentor Webapp — Comprehensive Test Plan

**Test User:** `ultra.boy7@gmail.com` / `123456`
**Base URL:** `http://localhost:5001` (backend) · `http://localhost:5173` (frontend)
**Date:** 2026-03-30

---

## Overview

This plan covers two layers of testing:

1. **API Layer** — Direct HTTP calls using `curl` / `axios` / Python `requests`, validating every feature endpoint independently of the UI.
2. **UI Layer** — Browser automation (Playwright) that clicks, types, and asserts exactly what a real user would see.

---

## Part 1 — API Tests

All authenticated requests require a JWT token obtained from the signin endpoint.

### 1.1 Authentication

#### T-AUTH-01 — Signin
```
POST /api/auth/signin
Body: { "email": "ultra.boy7@gmail.com", "password": "123456" }

Expected: 200, { token, _id, email, username, hasCompletedOnboarding }
Store: TOKEN = response.token
      USER_ID = response._id
```

#### T-AUTH-02 — Signin with bad password
```
POST /api/auth/signin
Body: { "email": "ultra.boy7@gmail.com", "password": "wrongpass" }

Expected: 401, { message: "Invalid email address or password." }
```

#### T-AUTH-03 — Protected route without token
```
GET /api/user/profile  (no Authorization header)

Expected: 401 Unauthorized
```

---

### 1.2 Session Management

All requests use `Authorization: Bearer <TOKEN>`

#### T-SESSION-01 — Create new session
```
POST /api/chat/history
Body: { "previousSessionId": null, "skipAnalysis": true }

Expected: 200, { newSessionId: <uuid>, message: "New session started." }
Store: SESSION_ID = response.newSessionId
```

#### T-SESSION-02 — List sessions
```
GET /api/chat/sessions

Expected: 200, array of session summaries with { sessionId, preview, messageCount, isTutorMode }
```

#### T-SESSION-03 — Get specific session
```
GET /api/chat/session/<SESSION_ID>

Expected: 200, { sessionId, messages: [], isTutorMode: false }
```

#### T-SESSION-04 — Chat stats
```
GET /api/chat/stats

Expected: 200, { totalSessions, totalMessages, ... }
```

---

### 1.3 General Chat (Standard Mode)

Uses SSE streaming. Test by consuming the event stream and collecting `final_answer` event.

#### T-CHAT-01 — Basic general chat
```
POST /api/chat/message
Body: {
  "query": "What is the difference between supervised and unsupervised learning?",
  "sessionId": "<SESSION_ID>"
}

Expected: SSE stream with events including final_answer containing a bot response.
          source_pipeline should NOT be "deep-research" or "tot"
```

#### T-CHAT-02 — Chat persists in session
```
POST /api/chat/message  (same SESSION_ID as T-CHAT-01)
Body: { "query": "Give me an example of what you just described", "sessionId": "<SESSION_ID>" }

Expected: Bot refers back to the previous context (supervised/unsupervised).
          GET /api/chat/session/<SESSION_ID> should show 4 messages (2 user + 2 bot).
```

#### T-CHAT-03 — Non-academic query rejection
```
POST /api/chat/message
Body: { "query": "What happened in the cricket match yesterday?", "sessionId": "<SESSION_ID>", "tutorMode": true }

Expected: final_answer contains rejection message about academic scope.
          source_pipeline: "semantic-router-rejection" or "academic-filter"
```

---

### 1.4 Chat With Tools — Manual Activation

#### T-TOOL-WEB-01 — Web search (manual toggle ON)
```
POST /api/chat/message
Body: {
  "query": "What are the latest advances in transformer architectures in 2025?",
  "sessionId": "<SESSION_ID>",
  "useWebSearch": true
}

Expected: final_answer includes web sources/references.
          Response metadata includes isWebSearchEnabled: true.
```

#### T-TOOL-WEB-02 — Web search (intent-triggered, no toggle)
```
POST /api/chat/message
Body: {
  "query": "What are the recent trends in large language models?",
  "sessionId": "<SESSION_ID>"
}

Expected: Server auto-enables web search via keyword pre-check or semantic router.
          final_answer references current developments.
```

#### T-TOOL-WEB-03 — User explicitly disables web search
```
POST /api/chat/message
Body: {
  "query": "Latest news in AI",
  "sessionId": "<SESSION_ID>",
  "useWebSearch": false,
  "userExplicitlyDisabledWebSearch": true
}

Expected: Web search NOT activated despite news-like query.
```

#### T-TOOL-ACAD-01 — Academic search (manual)
```
POST /api/chat/message
Body: {
  "query": "Explain the theoretical foundations of support vector machines with citations",
  "sessionId": "<SESSION_ID>",
  "useAcademicSearch": true
}

Expected: Response includes academic citations / paper references.
```

#### T-TOOL-ACAD-02 — Academic search (intent-triggered)
```
POST /api/chat/message
Body: {
  "query": "What does the research literature say about gradient descent convergence?",
  "sessionId": "<SESSION_ID>"
}

Expected: Semantic router activates academic_search.
```

#### T-TOOL-TOT-01 — Tree-of-Thought (manual)
```
POST /api/chat/message
Body: {
  "query": "Analyze the trade-offs between bias and variance in machine learning models",
  "sessionId": "<SESSION_ID>",
  "criticalThinkingEnabled": true
}

Expected: SSE stream shows intermediate reasoning events or thinking steps.
          source_pipeline contains "tot" or "tree-of-thought".
          confidenceScore present in final_answer.
```

#### T-TOOL-TOT-02 — ToT auto-triggered by complexity
```
POST /api/chat/message
Body: {
  "query": "Compare deep reinforcement learning, model-based RL, and multi-agent RL across 5 dimensions",
  "sessionId": "<SESSION_ID>"
}

Expected: Semantic router or LLM tool router enables criticalThinking due to high complexity score.
```

#### T-TOOL-REACT-01 — ReAct mode
```
POST /api/chat/message
Body: {
  "query": "Step by step, derive the backpropagation equations for a 2-layer neural network",
  "sessionId": "<SESSION_ID>",
  "useReAct": true
}

Expected: Streamed response shows multi-step reasoning/action pattern.
```

#### T-TOOL-KG-01 — Knowledge base (RAG / document context)
```
POST /api/chat/message
Body: {
  "query": "Explain the key concepts from the course material",
  "sessionId": "<SESSION_ID>",
  "documentContextName": "Machine Learning"
}

Expected: Response grounded in course materials.
          Fast-path (simpleFastPath) bypassed.
          source_pipeline indicates RAG usage.
```

#### T-TOOL-KG-02 — Knowledge base with specific subtopic
```
POST /api/chat/message
Body: {
  "query": "What is the hypothesis space and inductive bias?",
  "sessionId": "<SESSION_ID>",
  "documentContextName": "Machine Learning"
}

Expected: Answer pulled from Qdrant `my_qdrant_rag_collection`, mentioning course content.
```

#### T-TOOL-DEEP-01 — Deep research via chat toggle
```
POST /api/chat/message
Body: {
  "query": "Conduct a comprehensive analysis of federated learning privacy guarantees",
  "sessionId": "<SESSION_ID>",
  "deepResearchMode": true
}

Expected: Routed to researchHandler (not standardHandler).
          SSE events include research progress steps.
          Multiple sources in final_answer.
```

---

### 1.5 Deep Research (Standalone Endpoints)

#### T-DR-01 — Basic research search
```
POST /api/deep-research/search
Body: { "query": "How does attention mechanism work in transformers?" }

Expected: 200, { success: true, data: { synthesizedResult, sources, sourceBreakdown, metadata } }
```

#### T-DR-02 — Enhanced research report
```
POST /api/deep-research/report
Body: {
  "query": "Impact of dropout regularization on neural network generalization",
  "depthLevel": "deep",
  "reportStyle": "academic",
  "includeFactCheck": true
}

Expected: 200, { success: true, data: { synthesizedResult, report, factCheck, sources, metadata } }
```

#### T-DR-03 — Fact check endpoint
```
POST /api/deep-research/fact-check
Body: {
  "text": "BERT uses bidirectional training of Transformer and was pre-trained on Wikipedia and BooksCorpus.",
  "query": "BERT architecture"
}

Expected: 200, { success: true, data: { overallReliability, verifiedCount, flaggedCount, claims } }
```

#### T-DR-04 — Research history
```
GET /api/deep-research/history

Expected: 200, { success: true, data: [array of past research items] }
```

---

### 1.6 Tutor / Study Mode

#### T-TUTOR-01 — General Socratic mode
```
POST /api/chat/message
Body: {
  "query": "I want to understand gradient descent",
  "sessionId": "<SESSION_ID>",
  "tutorMode": true,
  "tutorModeType": "general_socratic"
}

Expected: Response ends with a Socratic follow-up question.
          source_pipeline: "tutor-general-socratic" or similar.
```

#### T-TUTOR-02 — Structured tutor (course-specific)
```
POST /api/chat/message
Body: {
  "query": "Teach me about overfitting",
  "sessionId": "<SESSION_ID>",
  "tutorMode": true,
  "tutorModeType": "structured",
  "documentContextName": "Machine Learning",
  "currentModulePathId": "overfitting"
}

Expected: Response uses STN teaching_context for the overfitting subtopic.
          Response structured as tutor explanation, not raw factual dump.
```

#### T-TUTOR-03 — Assistant mode (HARD academic filter)
```
POST /api/chat/message
Body: {
  "query": "What movies are trending this week?",
  "sessionId": "<SESSION_ID>",
  "tutorMode": true,
  "tutorModeType": "assistant"
}

Expected: Rejection response using REJECTION TEMPLATE.
```

#### T-TUTOR-04 — ToT disabled in tutor mode (expected behavior)
```
POST /api/chat/message
Body: {
  "query": "Explain support vector machines",
  "sessionId": "<SESSION_ID>",
  "tutorMode": true,
  "criticalThinkingEnabled": true
}

Expected: criticalThinking silently disabled (tutor mode incompatible).
          Response includes disabledToggles: ["criticalThinking"].
```

---

### 1.7 Progress Tracking (Machine Learning Course)

#### T-PROGRESS-SETUP — Clear all progress before test
```
# First, read current progress
GET /api/progress/Machine%20Learning
Expected: 200, { progress: { completedTopics, completedModules, completedSubtopics, quizResults } }

# Clear by syncing with empty arrays
POST /api/progress/update
Body: {
  "courseName": "Machine Learning",
  "type": "sync",
  "completedTopics": [],
  "completedModules": [],
  "completedSubtopics": []
}
Expected: 200, { success: true, progress: { completedTopics: [], completedModules: [], ... } }
```

#### T-PROGRESS-01 — Mark subtopic complete
```
POST /api/progress/update
Body: { "courseName": "Machine Learning", "type": "subtopic", "id": "definition_of_ml" }

Expected: 200, progress.completedSubtopics contains "definition_of_ml"
```

#### T-PROGRESS-02 — Mark topic complete
```
POST /api/progress/update
Body: { "courseName": "Machine Learning", "type": "topic", "id": "introduction_to_ml" }

Expected: 200, progress.completedTopics contains "introduction_to_ml"
```

#### T-PROGRESS-03 — Mark module complete
```
POST /api/progress/update
Body: { "courseName": "Machine Learning", "type": "module", "id": "module_1" }

Expected: 200, progress.completedModules contains "module_1"
```

#### T-PROGRESS-04 — Persistence across sessions (core test)
```
Step 1: POST /api/progress/update — mark "supervised_learning" subtopic complete
Step 2: Create a new session: POST /api/chat/history
Step 3: GET /api/progress/Machine%20Learning

Expected: "supervised_learning" still in completedSubtopics — progress persists across sessions.
```

#### T-PROGRESS-05 — Quiz result persistence
```
POST /api/progress/quiz
Body: {
  "courseName": "Machine Learning",
  "quizResults": { "definition_of_ml_q1": "correct", "definition_of_ml_q2": "wrong" },
  "quizIndex": 2
}

Expected: 200, quizResults persisted.

Verify with GET /api/progress/Machine%20Learning
Expected: quizResults contains the above entries.
```

#### T-PROGRESS-06 — Full module clear and verify clean state
```
POST /api/progress/update
Body: {
  "courseName": "Machine Learning",
  "type": "sync",
  "completedTopics": [],
  "completedModules": [],
  "completedSubtopics": []
}
POST /api/progress/quiz
Body: { "courseName": "Machine Learning", "quizResults": {}, "quizIndex": 0 }

GET /api/progress/Machine%20Learning
Expected: All arrays empty, quizResults empty, quizIndex: 0
```

---

### 1.8 Study Questions & Skill Tree

#### T-STUDY-01 — Fetch questions for a subtopic
```
GET /api/study-mode/questions/Machine%20Learning/definition_of_ml

Expected: 200, { success: true, cached: true, data: { mcq: [...], short_answer: [...], flashcards: [...] } }
          MCQ array should have ~4-5 items, flashcards ~5 items.
```

#### T-STUDY-02 — Fetch questions for another subtopic
```
GET /api/study-mode/questions/Machine%20Learning/supervised_learning

Expected: Same structure as T-STUDY-01.
```

#### T-STUDY-03 — Fetch skill tree for course
```
GET /api/study-mode/skill-tree/Machine%20Learning

Expected: 200, { success: true, cached: true, data: [ array of 52 skill tree nodes ] }
          Each node has: subtopic_id, difficulty_score, skill_level, prerequisites, unlocks.
```

#### T-STUDY-04 — Skill tree node structure validation
```
Parse T-STUDY-03 response and verify:
- definition_of_ml: prerequisites = [], difficulty_score = 1-2, skill_level = "foundational"
- overfitting: prerequisites includes "hypothesis_space" or similar foundational node
- All 52 subtopics present in data array
```

---

### 1.9 Gamification

#### T-GAMIF-01 — Get gamification profile
```
GET /api/gamification/profile

Expected: 200, { xp, level, streak, badges, skillTree: {...}, streak: {...} }
```

#### T-GAMIF-02 — Get gamification skill tree (fog-of-war)
```
GET /api/gamification/skill-tree

Expected: 200, { skillTree: { nodes, unlockedNodes, ... } }
```

#### T-GAMIF-03 — XP award after chat (indirect test)
```
Step 1: GET /api/gamification/profile → note current XP
Step 2: POST /api/chat/message — send a substantive query
Step 3: GET /api/gamification/profile → verify XP increased
```

---

### 1.10 User Profile

#### T-USER-01 — Get user profile
```
GET /api/user/profile

Expected: 200, { email, username, profile: { name, college, branch, year }, preferredLlmProvider }
```

#### T-USER-02 — Knowledge state
```
GET /api/knowledge-state

Expected: 200, user's knowledge state with topic scores
```

---

## Part 2 — UI Automation Tests (Playwright)

**Stack:** Playwright (Node.js)
**Browser:** Chromium
**Base URL:** `http://localhost:5173`

### Setup

```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
    headless: false,        // set true for CI
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  timeout: 60000,
});

// tests/e2e/helpers/auth.js
export async function loginAs(page, email = 'ultra.boy7@gmail.com', password = '123456') {
  await page.goto('/');
  // Click login button on landing page
  await page.click('button:has-text("Login"), button:has-text("Sign In"), a:has-text("Login")');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]:has-text("Sign In"), button:has-text("Login")');
  await page.waitForURL(url => !url.includes('landing'), { timeout: 15000 });
}
```

---

### UI-AUTH — Authentication Flow

#### UI-AUTH-01 — Login and reach main chat
```
1. Navigate to http://localhost:5173
2. Assert landing page visible (LandingPage component)
3. Click Login button
4. Fill email: ultra.boy7@gmail.com
5. Fill password: 123456
6. Click Submit
7. Assert URL is "/" (not landing)
8. Assert TopNav visible
9. Assert chat input box present
```

#### UI-AUTH-02 — Login with wrong password shows error
```
1. Open login modal
2. Fill wrong password
3. Submit
4. Assert error toast or error message visible
```

---

### UI-CHAT — General Chat

#### UI-CHAT-01 — Send a basic message
```
1. Login
2. Click chat input
3. Type: "What is machine learning?"
4. Press Enter or click Send
5. Assert user message bubble appears
6. Assert bot response bubble appears (wait up to 30s)
7. Assert response is non-empty text
```

#### UI-CHAT-02 — Multi-turn conversation context
```
1. Send: "Explain overfitting in machine learning"
2. Wait for bot response
3. Send: "Give me an example of what you described"
4. Wait for bot response
5. Assert second response references previous context (contains "overfitting" or "example")
```

#### UI-CHAT-03 — New chat clears messages
```
1. Send a message and get response
2. Click "New Chat" button (TopNav)
3. Assert chat messages area is empty
4. Assert new session created (session ID changes)
```

---

### UI-TOOLS — Tool Toggles

#### UI-TOOL-01 — Web search toggle
```
1. Login, open chat
2. Find Web Search toggle in left panel or chat input toolbar
3. Click to enable it (assert toggle is ON / highlighted)
4. Type: "What are the latest AI research papers in 2025?"
5. Send message
6. Wait for response
7. Assert response includes source links or citations
8. Assert web search indicator visible in response bubble
```

#### UI-TOOL-02 — Academic search toggle
```
1. Enable Academic Search toggle
2. Type: "Theoretical analysis of gradient descent convergence"
3. Send
4. Assert response includes academic paper references
```

#### UI-TOOL-03 — Tree-of-Thought (Critical Thinking) toggle
```
1. Enable Critical Thinking / ToT toggle
2. Type: "Analyze bias-variance tradeoff in ensemble methods"
3. Send
4. Assert thinking/reasoning steps visible in the response (thinking panel or expandable section)
5. Assert confidence score shown
```

#### UI-TOOL-04 — Intent-based web search auto-trigger
```
1. Ensure all tool toggles are OFF
2. Type: "What are the recent trends in large language models?"
3. Send
4. Assert response is web-aware (auto-triggered by "recent trends" keyword)
```

#### UI-TOOL-05 — Knowledge base selection
```
1. Click Knowledge Base button (left panel or toolbar)
2. KnowledgeBaseModal opens
3. Select "Machine Learning" course
4. Close modal
5. Type: "Explain what the course covers about supervised learning"
6. Send
7. Assert response references course materials
8. Assert documentContextName indicator shown in chat input area
```

#### UI-TOOL-06 — Deep Research toggle
```
1. Enable Deep Research toggle (if available in chat toolbar)
   OR navigate to /tools/deep-research
2. Type: "Comprehensive analysis of neural architecture search"
3. Submit
4. Assert research progress steps shown in UI (streaming events)
5. Assert final report with sources visible
```

---

### UI-TUTOR — Study Mode (Machine Learning)

#### UI-TUTOR-SETUP — Clear all progress first
```
1. Login
2. Navigate to /tutor or Tutor Mode section
3. Select "Machine Learning" as course
4. Find "Reset Progress" / "Clear Progress" button (or call API: POST /api/progress/update with empty sync)
5. Confirm all modules show 0% progress
```

#### UI-TUTOR-01 — Enter tutor mode
```
1. Navigate to /tutor
2. Assert TutorModePage loaded
3. Assert course selector visible
4. Select "Machine Learning"
5. Assert curriculum/module list appears
```

#### UI-TUTOR-02 — Navigate modules
```
1. In tutor mode with ML course selected
2. Click on Module 1 (Introduction to ML)
3. Assert module expands showing topics and subtopics
4. Click on a subtopic (e.g., "Definition of ML")
5. Assert subtopic content/STN is shown or chat focuses on it
```

#### UI-TUTOR-03 — Chat within structured tutor mode
```
1. With ML course selected in tutor mode, subtopic "overfitting" active
2. Type: "I don't understand overfitting"
3. Send
4. Assert response uses tutor-style explanation (teaching context from STN)
5. Assert response ends with a follow-up question (Socratic mode)
```

#### UI-TUTOR-04 — Mark subtopic complete
```
1. In tutor mode, navigate to subtopic "definition_of_ml"
2. Click "Mark as Complete" or checkmark button
3. Assert subtopic shows completed state (checkmark, green, etc.)
4. Assert progress bar updates
```

#### UI-TUTOR-05 — Progress persists across session reload
```
1. Mark 3+ subtopics complete in ML course
2. Note which subtopics are marked
3. Click "New Chat" to start a new session
4. Navigate back to /tutor
5. Select Machine Learning course
6. Assert previously completed subtopics still show as complete
7. Assert progress bar shows same percentage
```

#### UI-TUTOR-06 — Complete a full module
```
1. Mark all subtopics and topics in one module as complete
2. Assert module shows 100% or "Completed" state
3. Reload page (F5)
4. Assert module still shows completed state (persistence verified)
```

#### UI-TUTOR-07 — Quiz flow
```
1. Navigate to a subtopic with quiz available
2. Click "Take Quiz" or "Study Questions"
3. Assert MCQ questions displayed
4. Answer questions (correct and incorrect)
5. Assert score/feedback shown
6. Assert quiz results persisted (check via GET /api/progress/Machine%20Learning)
```

---

### UI-SKILL-TREE — Skill Tree

#### UI-SKILL-01 — Navigate to skill tree
```
1. Navigate to /gamification/skill-tree
2. Assert SkillTreeGames page loaded
3. Assert skill tree nodes visible
```

#### UI-SKILL-02 — Skill tree classic view
```
1. Navigate to /gamification/skill-tree/classic
2. Assert graph/map of skills rendered (vis-network or similar)
3. Assert foundational nodes (definition_of_ml) visible
4. Hover over a node — assert tooltip shows subtopic info
```

#### UI-SKILL-03 — Skill tree progress reflection
```
1. Mark "definition_of_ml" and "history_of_ml" complete via API
2. Navigate to /gamification/skill-tree/classic
3. Assert those nodes show completed/unlocked state (different color)
4. Assert their "unlocks" children show as available
```

#### UI-SKILL-04 — Skill tree game map
```
1. Navigate to /gamification/skill-tree/map
2. Assert SkillTreeGameMap rendered
3. Assert nodes are interactive (click on one)
4. Assert node detail panel or modal shows up
```

---

### UI-GAMIF — Gamification Features

#### UI-GAMIF-01 — XP and level display
```
1. Login
2. Assert TopNav or RightPanel shows XP / level
3. Send a chat message
4. Assert XP increases (or badge notification appears)
```

#### UI-GAMIF-02 — Badges showcase
```
1. Navigate to /gamification/badges
2. Assert BadgesShowcase page loaded
3. Assert badge grid visible
4. Assert earned vs. locked badges distinguishable
```

#### UI-GAMIF-03 — Boss Battles
```
1. Navigate to /gamification/boss-battles
2. Assert BossBattles page loaded
3. Assert boss battle card(s) visible
4. Click on an active battle
5. Assert battle interface shown
```

#### UI-GAMIF-04 — Bounties & Credits
```
1. Navigate to /gamification/bounties
2. Assert BountyCreditsPage loaded
3. Assert active bounties listed
```

---

### UI-TOOLS-EXTRA — Other Tool Pages

#### UI-TOOLS-01 — Code Executor
```
1. Navigate to /tools/code-executor
2. Assert CodeExecutorPage (Monaco editor) loaded
3. Type a simple Python snippet: print("hello world")
4. Click Run
5. Assert output shows "hello world"
```

#### UI-TOOLS-02 — Quiz Generator
```
1. Navigate to /tools/quiz-generator
2. Assert QuizGeneratorPage loaded
3. Enter topic: "machine learning"
4. Click Generate
5. Assert quiz questions generated
```

#### UI-TOOLS-03 — Academic Integrity Checker
```
1. Navigate to /tools/integrity-checker
2. Assert AcademicIntegrityPage loaded
3. Paste sample text
4. Click Check
5. Assert integrity analysis results shown
```

#### UI-TOOLS-04 — Deep Research page
```
1. Navigate to /tools/deep-research
2. Assert DeepResearchPage loaded
3. Enter query: "quantum computing applications in ML"
4. Click Research / Submit
5. Assert progress indicators stream
6. Assert final report rendered with sections and sources
```

#### UI-TOOLS-05 — Deep Research history
```
1. Navigate to /tools/deep-research/history
2. Assert ResearchHistory page loaded
3. Assert previous research items from T-DR-01 / T-DR-02 visible
4. Click one item
5. Assert ResearchDetailView renders the cached report
```

---

### UI-LEARNING — Learning Profile & Study Plan

#### UI-LEARNING-01 — Learning profile
```
1. Navigate to /learning-profile
2. Assert LearningProfile page loaded
3. Assert user stats/metrics shown
4. Assert topic performance scores visible
```

#### UI-LEARNING-02 — Study plan
```
1. Navigate to /study-plan
2. Assert StudyPlanPage loaded
3. Enter a goal: "Master gradient descent"
4. Click Create Plan
5. Assert study plan generated with steps
```

---

### UI-NAV — Navigation & Panel Controls

#### UI-NAV-01 — Left panel toggle
```
1. Click left panel collapse/expand button
2. Assert LeftPanel shows/hides
3. Assert LeftCollapsedNav shows icon-only nav when collapsed
```

#### UI-NAV-02 — Right panel toggle
```
1. Click right panel collapse/expand button
2. Assert RightPanel shows/hides
```

#### UI-NAV-03 — Chat history sidebar
```
1. Click History button in TopNav
2. Assert ChatHistorySidebar slides in
3. Assert previous sessions listed
4. Click a session
5. Assert messages from that session load in chat
```

#### UI-NAV-04 — Theme switching
```
1. Find theme toggle in TopNav or settings
2. Toggle dark/light mode
3. Assert CSS class on <html> changes (dark/light)
4. Assert UI colors change accordingly
```

---

## Part 3 — Test Execution Script Outline

```bash
# 1. Install dependencies
cd /path/to/chatbot
npm install --save-dev @playwright/test
npx playwright install chromium

# 2. Run API tests (Python)
pip install requests pytest
pytest server/scripts/backend_test_suite.py -v

# 3. Run Playwright E2E tests
npx playwright test tests/e2e/ --reporter=html

# 4. View report
npx playwright show-report
```

---

## Part 4 — Test Files to Create

```
tests/
├── api/
│   ├── auth.test.js            # T-AUTH-*
│   ├── session.test.js         # T-SESSION-*
│   ├── general_chat.test.js    # T-CHAT-*
│   ├── tool_websearch.test.js  # T-TOOL-WEB-*
│   ├── tool_academic.test.js   # T-TOOL-ACAD-*
│   ├── tool_tot.test.js        # T-TOOL-TOT-*, T-TOOL-REACT-*
│   ├── tool_rag.test.js        # T-TOOL-KG-*
│   ├── tool_deep_research.test.js # T-TOOL-DEEP-*, T-DR-*
│   ├── tutor.test.js           # T-TUTOR-*
│   ├── progress.test.js        # T-PROGRESS-*
│   ├── study_questions.test.js # T-STUDY-*
│   └── gamification.test.js    # T-GAMIF-*
└── e2e/
    ├── helpers/
    │   └── auth.js
    ├── auth.spec.js             # UI-AUTH-*
    ├── general_chat.spec.js     # UI-CHAT-*
    ├── tools.spec.js            # UI-TOOL-*
    ├── tutor_mode.spec.js       # UI-TUTOR-*
    ├── skill_tree.spec.js       # UI-SKILL-*
    ├── gamification.spec.js     # UI-GAMIF-*
    ├── tool_pages.spec.js       # UI-TOOLS-*
    └── navigation.spec.js      # UI-NAV-*
```

---

## Part 5 — Critical Assertions Checklist

| Feature | API Verified | UI Verified | Notes |
|---------|-------------|-------------|-------|
| Login / Auth | T-AUTH-01..03 | UI-AUTH-01..02 | |
| General Chat | T-CHAT-01..03 | UI-CHAT-01..03 | |
| Web Search (manual) | T-TOOL-WEB-01 | UI-TOOL-01 | |
| Web Search (auto-intent) | T-TOOL-WEB-02 | UI-TOOL-04 | "recent trends" keyword |
| Academic Search | T-TOOL-ACAD-01..02 | UI-TOOL-02 | |
| Tree-of-Thought | T-TOOL-TOT-01..02 | UI-TOOL-03 | |
| ReAct | T-TOOL-REACT-01 | — | |
| Knowledge Base (RAG) | T-TOOL-KG-01..02 | UI-TOOL-05 | |
| Deep Research (chat) | T-TOOL-DEEP-01 | UI-TOOL-06 | |
| Deep Research (standalone) | T-DR-01..04 | UI-TOOLS-04..05 | |
| Tutor General Socratic | T-TUTOR-01 | UI-TUTOR-03 | |
| Tutor Structured | T-TUTOR-02 | UI-TUTOR-02..03 | |
| Academic filter | T-TUTOR-03 | — | |
| Progress clear | T-PROGRESS-SETUP | UI-TUTOR-SETUP | **Do before study mode tests** |
| Progress persistence | T-PROGRESS-04 | UI-TUTOR-05..06 | Cross-session critical test |
| Quiz results | T-PROGRESS-05 | UI-TUTOR-07 | |
| Study questions | T-STUDY-01..02 | — | 54 subtopic question sets |
| Skill tree fetch | T-STUDY-03..04 | UI-SKILL-01..04 | 52 nodes expected |
| Gamification | T-GAMIF-01..03 | UI-GAMIF-01..04 | |
| Code executor | — | UI-TOOLS-01 | |
| Quiz generator | — | UI-TOOLS-02 | |
| Integrity checker | — | UI-TOOLS-03 | |

---

## Part 6 — Known Behaviors & Edge Cases

1. **ToT + Tutor Mode conflict**: When both are enabled, server silently disables ToT and returns `disabledToggles: ["criticalThinking"]`. Test this expected behavior in T-TUTOR-04.

2. **Fast path bypass**: `simpleFastPath` is skipped when `documentContextName` is set. Verify RAG path taken in T-TOOL-KG-01.

3. **Semantic router fallback**: If Ollama embedding service is down, routing falls back to keyword-based detection. Tests should pass in both cases.

4. **Progress clear before study tests**: Always run T-PROGRESS-SETUP / UI-TUTOR-SETUP before any progress tests. Previous test data will cause false positives.

5. **Session isolation**: Create a fresh `SESSION_ID` for each test group to avoid context contamination from prior tests.

6. **Deep research rate limit**: `researchLimiter` middleware applies. Space research tests ≥5s apart or handle 429 responses.

7. **SSE consumption**: Chat endpoint streams SSE. Tests must read the full stream until `res.end()` before asserting final_answer content.
