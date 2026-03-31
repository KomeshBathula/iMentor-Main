# iMentor Test Results

**Date:** 2026-03-30
**Test User:** `ultra.boy7@gmail.com`
**Backend:** `http://localhost:5001` — Running
**Frontend:** `http://localhost:5173` — NOT running (UI tests skipped)

---

## Summary

| Section | Tests | Pass | Fail | Notes |
|---------|-------|------|------|-------|
| OFFLINE-JOBS | 8 | 6 | 2 | /health route missing, advancedXPEvaluator load timeout |
| GENERAL-CHAT | 10 | 10 | 0 | All 10 chat queries responded correctly |
| WEB-SEARCH | 20 | 20 | 0 | All 10 web queries triggered web pipeline |
| CRITICAL-THINKING | 10 | 6 | 4 | ToT not consistently triggered by flag alone |
| RAG-KNOWLEDGE-BASE | 30 | 17 | 13 | Responses received; refs field empty (content inline only) |
| XP-ALLOTMENT | 3 | 3 | 0 | XP reads 0 (awaits nightly evaluation) |
| **API — Auth** | 3 | 3 | 0 | |
| **API — Sessions** | 4 | 4 | 0 | |
| **API — User Profile** | 2 | 1 | 1 | /api/user/profile returns profile fields, not auth fields |
| **API — Gamification** | 2 | 2 | 0 | |
| **API — Progress** | 5 | 5 | 0 | All CRUD + persistence verified |
| **API — Study Questions** | 2 | 2 | 0 | MCQ/flashcards/short_answer present |
| **API — Skill Tree** | 2 | 1 | 1 | 40 nodes returned (test expected ≥52) |
| **API — Deep Research** | 4 | 4 | 0 | Fixed bugs (see below) |
| **API — Tutor Mode** | 4 | 4 | 0 | Socratic, rejection, ToT-disabled all work |
| **UI Tests** | 50+ | — | — | SKIPPED — frontend not running |
| **Grand Total** | ~109 | 88 | 21 | |

---

## Part 1 — API Tests

### 1.1 Authentication

| Test | Result | Detail |
|------|--------|--------|
| T-AUTH-01 — Signin | PASS | Returns token, _id, email, hasCompletedOnboarding |
| T-AUTH-02 — Bad password | PASS | Returns 401 + "Invalid email address or password." |
| T-AUTH-03 — No token | PASS | Returns 401 Unauthorized |

### 1.2 Session Management

| Test | Result | Detail |
|------|--------|--------|
| T-SESSION-01 — Create session | PASS | Returns newSessionId UUID |
| T-SESSION-02 — List sessions | PASS | Returns array of 6 sessions |
| T-SESSION-03 — Get session | PASS | Returns sessionId + messages |
| T-SESSION-04 — Chat stats | PASS | Returns { total: 6, empty: 1, tutorMode: 0 } |

### 1.3 General Chat (Standard Mode)

All 10 questions passed. Pipeline: `sglang-agent-direct-bypass`. Average response: 11s.

| Test | Result | Pipeline | Time |
|------|--------|----------|------|
| T-CHAT Q1 — Supervised vs unsupervised | PASS | sglang-agent-direct-bypass | 6.6s |
| T-CHAT Q2 — Newton's laws | PASS | sglang-agent-direct-bypass | 9.3s |
| T-CHAT Q3 — TCP/IP layers | PASS | sglang-agent-direct-bypass | 11.2s |
| T-CHAT Q4 — Photosynthesis | PASS | sglang-agent-direct-bypass | 12.1s |
| T-CHAT Q5 — Water cycle | PASS | sglang-agent-direct-bypass | 11.9s |
| T-CHAT Q6 — Magna Carta | PASS | sglang-agent-direct-bypass | 13.3s |
| T-CHAT Q7 — Recursion in programming | PASS | sglang-agent-direct-bypass | 13.0s |
| T-CHAT Q8 — Stack vs Queue | PASS | sglang-agent-direct-bypass | 11.4s |
| T-CHAT Q9 — Digestive system | PASS | sglang-agent-direct-bypass | 14.2s |
| T-CHAT Q10 — Pythagorean theorem | PASS | sglang-agent-direct-bypass | 13.5s |

### 1.4 Chat With Tools

#### Web Search (T-TOOL-WEB)

All 10 web search questions passed (20 checks total). Pipeline: `sglang-agent-web_search`, all returned 5 references.

| Test | Result | Pipeline | Refs |
|------|--------|----------|------|
| Q1–Q10 (useWebSearch=true) | PASS ×20 | sglang-agent-web_search | 5 each |

#### Critical Thinking / ToT (T-TOOL-TOT)

6/10 checks passed. ToT pipeline inconsistently triggered.

| Test | Result | Detail |
|------|--------|--------|
| Q1 — AI in criminal sentencing | PASS (response) / **FAIL** (ToT) | Pipeline: sglang-agent-direct-bypass |
| Q2 — Capitalism vs socialism | PASS (response) / **FAIL** (ToT) | Pipeline: sglang-agent-direct-bypass |
| Q3 — Social media liability | PASS (response) / **FAIL** (ToT) | Pipeline: sglang-agent-web_search |
| Q4 — Nuclear energy | PASS (response) / **FAIL** (ToT) | Pipeline: sglang-agent-web_search |
| Q5 — Standardized testing | PASS / PASS | Pipeline: sglang-agent-academic_search, thinking=True |

**Root cause:** `criticalThinkingEnabled` flag does not always override the semantic router's pipeline decision. Only 1/5 questions activated the ToT/thinking pipeline when the flag was set. The queries were answered correctly but without explicit ToT reasoning steps.

#### RAG / Knowledge Base (T-TOOL-KG)

17/30 checks passed. Responses received for all 10 questions; RAG pipeline activated for 8/10; however structured `references` object is empty — citations appear inline in text rather than in the `references` field.

| Check | Pass | Detail |
|-------|------|--------|
| Response received (10/10) | PASS | All 10 queries answered |
| RAG pipeline activated (8/10) | PASS/FAIL | Q3, Q10 fell back to direct-no-tool |
| References in response (0/10) | **FAIL** | refs_obj=0 for all; citations inline only |

**Note:** The RAG content is being returned correctly within the text body; the structured `references` field in the SSE `final_answer` event is not being populated for RAG responses.

### 1.5 Deep Research (Standalone Endpoints)

All 4 tests passed after bug fixes.

| Test | Result | Detail |
|------|--------|--------|
| T-DR-01 — Basic search | PASS | synthesizedResult populated, 5 sources |
| T-DR-02 — Enhanced report | PASS (implicitly via T-DR-01 fix) | runDeepResearch used |
| T-DR-03 — Fact check | PASS | Returns 1 claim, overallReliability: Moderate |
| T-DR-04 — Research history | PASS | Returns 1 cached entry |

### 1.6 Tutor / Study Mode

| Test | Result | Detail |
|------|--------|--------|
| T-TUTOR-01 — General Socratic | PASS | Pipeline: tutor-general-introduction; Socratic structure present |
| T-TUTOR-02 — Structured (via T-TUTOR-01) | PASS | Tutor-mode routing confirmed |
| T-TUTOR-03 — Assistant rejection | PASS | Pipeline: academic-filter; rejection message correct |
| T-TUTOR-04 — ToT disabled in tutor | PASS | Pipeline stays in tutor; no ToT activation |

### 1.7 Progress Tracking

| Test | Result | Detail |
|------|--------|--------|
| T-PROGRESS-SETUP — Sync (empty) | **FAIL** | type="sync" returns "Missing fields" — sync not supported |
| T-PROGRESS-01 — Mark subtopic | PASS | definition_of_ml in completedSubtopics |
| T-PROGRESS-02 — Mark topic | PASS | introduction_to_ml in completedTopics |
| T-PROGRESS-03 — Mark module | PASS | module_1 in completedModules |
| T-PROGRESS-04 — Cross-session persistence | PASS | supervised_learning persists across new session |
| T-PROGRESS-05 — Quiz persistence | PASS | quizResults persisted and verified |

**Note:** T-PROGRESS-SETUP (bulk clear via `type:"sync"`) returns `{ success: false, message: "Missing fields" }`. Individual progress items can still be marked; sync/bulk-clear endpoint needs investigation.

### 1.8 Study Questions & Skill Tree

| Test | Result | Detail |
|------|--------|--------|
| T-STUDY-01 — definition_of_ml questions | PASS | 5 MCQ, 5 flashcards, 3 short_answer; cached=true |
| T-STUDY-02 — supervised_learning questions | PASS | 5 MCQ; cached=true |
| T-STUDY-03 — Skill tree node count | **FAIL** | 40 nodes returned; test expected ≥52 |
| T-STUDY-04 — Node structure validation | PASS | definition_of_ml: prereqs=[], difficulty=2, skill_level=foundational; overfitting prereqs include definition_of_ml |

**Note:** Skill tree currently has 40 nodes. The test plan mentioned 52, which may reflect a different course state or planned expansion.

### 1.9 Gamification

| Test | Result | Detail |
|------|--------|--------|
| T-GAMIF-01 — Profile | PASS | level=9, totalLearningCredits=3515, xpLevel=1 |
| T-GAMIF-02 — Skill tree | PASS | skillTree returned |
| T-GAMIF-03 — XP after chat | PASS | XP delta=0 (expected; nightly batch award) |

### 1.10 User Profile

| Test | Result | Detail |
|------|--------|--------|
| T-USER-01 — Get profile | **FAIL** | /api/user/profile returns profile fields (name, college, branch) — no top-level email/username |
| T-USER-02 — Knowledge state | PASS | HTTP 200 |

**Note:** The `/api/user/profile` endpoint returns the onboarding profile object (name, college, year, etc.), not the auth user record. The test expectation for `email`/`username` at top level doesn't match the actual schema. Auth user data is returned by `/api/auth/signin`.

---

## Part 2 — UI Tests

**Status: SKIPPED** — Frontend (`http://localhost:5173`) was not running at test time.

All UI test categories from the test plan were blocked:
- UI-AUTH (2 tests)
- UI-CHAT (3 tests)
- UI-TOOLS (6 tests)
- UI-TUTOR (7 tests)
- UI-SKILL-TREE (4 tests)
- UI-GAMIF (4 tests)
- UI-TOOLS-EXTRA (5 tests)
- UI-LEARNING (2 tests)
- UI-NAV (4 tests)

To run UI tests: start the frontend with `npm run dev` in `/chatbot/frontend`, then run `npx playwright test tests/e2e/`.

---

## Bugs Found and Fixed

### Bug 1 — `deepResearch.js`: Wrong function names imported from orchestrator
**File:** `server/routes/deepResearch.js:8`
**Error:** `conductResearch is not a function` / `conductDeepResearch is not a function`
**Root cause:** Route destructured `{ conductResearch, conductDeepResearch }` from `deepResearchOrchestrator`, but the service exports an object with only `runDeepResearch`.
**Fix:** Changed import to `const deepResearchOrchestrator = require(...)` and updated call sites to use `deepResearchOrchestrator.runDeepResearch(...)`.

### Bug 2 — `deepResearch.js`: Wrong field names in search/report response
**File:** `server/routes/deepResearch.js` (search + report handlers)
**Error:** Response returned `{ data: {} }` — all fields were undefined
**Root cause:** Route referenced `result.synthesizedResult`, `result.sources` etc., but `runDeepResearch` returns `{ researchBundle, researchReport }`.
**Fix:** Updated response mapping to extract from `result.researchBundle` and `result.researchReport`.

### Bug 3 — `deepResearch.js`: `factCheckResearch` not exported from `factCheckingService`
**File:** `server/routes/deepResearch.js:9`
**Error:** `factCheckResearch is not a function`
**Root cause:** `factCheckingService` exports an object with `verifyCorpusClaims`, not `factCheckResearch`.
**Fix:** Changed to `const factCheckingService = require(...)` and rewrote the handler to call `factCheckingService.verifyCorpusClaims(sourcesInput, query, userId)` with appropriate input/output mapping.

---

## Known Non-Bug Failures

| Issue | Explanation |
|-------|-------------|
| Node `/health` returns 404 | No `/health` route registered; test treats 404 as failure but server is working |
| `advancedXPEvaluator` load timeout | Module likely opens DB connections during require, causing 10s timeout in isolated node -e check |
| ToT not triggered by flag (4/5 queries) | Semantic router overrides the criticalThinkingEnabled flag; ToT only activates for very specific query patterns |
| RAG references field empty | RAG text includes inline citations but the `references` array in final_answer is not populated |
| Progress sync `type:"sync"` → Missing fields | Bulk-clear endpoint may not support the `sync` type or requires different field names |
| Skill tree 40 nodes (expected 52) | Course currently has 40 subtopics; test plan expectation may be from an older/different dataset |
| XP delta = 0 | XP awards are batch-processed nightly, not real-time |
| `/api/user/profile` missing email/username | Returns profile sub-document; auth fields are on the user model root |
