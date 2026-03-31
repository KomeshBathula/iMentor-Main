# iMentor — Comprehensive Playwright E2E Test Strategy

**Date:** 31 March 2026  
**Scope:** End-to-end Playwright tests covering all user-facing features  
**Credentials:** `ultra.boy7@gmail.com` / `123456`  
**Course:** Machine Learning (primary), available courses: ML, DL, DS, Algorithms, Python, Databases

---

## Phase 0 — Infrastructure & File Cleanup

### 0A. Files to Remove (51 items — no production imports)

**Old test scripts in `server/scripts/`** (24 files, ~5500 LOC):
```
testCompareModels.js, testConversationMemory.js, testDocAnalysis.js,
testDocUpload.js, testElasticsearch.js, testEmbeddings.js,
testGemini.js, testKGExtraction.js, testLLM.js, testModels.js,
testNeo4j.js, testNeo4jDirectConnection.js, testPromptCoach.js,
testQdrant.js, testQdrantTutor.js, testQueryClassifier.js,
testRouting.js, testSearchComparison.js, testSGLang.js,
testStreamingSSE.js, test_gemini.js (root), fixGeminiModel.js,
removeGeminiFlash.js, fixModelNames.js
```

**Temp/output files:**
```
temp.txt, code.txt, graph.txt, server/chat.js (empty),
server/models_list.json (orphaned)
```

**Stale reports/artifacts:**
```
playwright-report/, server/test-results/, frontend/lint-report.json,
frontend/lint-report.txt, RESULTS.md, TESTS2.md, session2.md
```

**Pycache dirs:** All `__pycache__/` (8 dirs)

**Server backup_assets/:** `server/backup_assets/` (350+ dated folders)

**Ghost npm scripts:** Remove these from `server/package.json`:
```json
"test", "test:audit-mocks", "test:rate-limit-smoke", "test:job-tracking-smoke"
```
(all reference missing files under `server/tests/` which doesn't exist)

### 0B. `.gitignore` Additions
```
__pycache__/
*.pyc
playwright-report/
server/test-results/
server/backup_assets/
server/logs/
code.txt
graph.txt
temp.txt
```

---

## Phase 1 — New Test File Structure

All tests go under `tests/e2e/`. Each file is a standalone Playwright spec.  
Shared helpers in `tests/e2e/helpers/`.

```
tests/e2e/
├── helpers/
│   ├── auth.js                    # existing — loginAs(), sendMessage()
│   ├── chat-helpers.js            # NEW — assertBotResponse(), waitForStream(), assertRouting()
│   └── tutor-helpers.js           # NEW — selectCourse(), clearProgress(), progressThrough()
├── 01_landing.spec.js             # existing (landing_page.spec.js, 11 tests)
├── 02_auth.spec.js                # existing (auth.spec.js, 2 tests)
├── 03_general_chat.spec.js        # existing (3) + NEW (5 semantic routing tests)
├── 04_chat_options.spec.js        # NEW — web search, ToT, academic, deep research toggles
├── 05_rag_course.spec.js          # NEW — course RAG, KG, combined tool tests
├── 06_deep_research.spec.js       # NEW — 5 research questions
├── 07_tutor_persistence.spec.js   # NEW — progress clear/persist
├── 08_tutor_weak_student.spec.js  # NEW — module 1→4 weak student profile
├── 09_tutor_avg_student.spec.js   # NEW — module 1→4 average student profile
├── 10_tutor_expert_student.spec.js # NEW — module 1→4 expert student profile
├── 11_skill_tree.spec.js          # NEW — full skill tree progression
├── 12_admin_verification.spec.js  # NEW — admin panel reflection checks
├── gamification.spec.js           # existing (6 tests)
├── navigation.spec.js             # existing (4 tests)
├── tools_pages.spec.js            # existing (5 tests)
└── tools.spec.js                  # existing (4 tests)
```

---

## Phase 2 — Test Specs (Detailed)

### Spec 03: General Chat — Semantic Routing (8 tests)

> **Goal:** Verify different intent types get routed to the correct pipeline

| ID | Test | Input | Assert |
|----|------|-------|--------|
| GC-01 | Factual query (existing) | "What is machine learning?" | Bot responds >20 chars, no thinking dropdown |
| GC-02 | Multi-turn context (existing) | 2 sequential messages | ≥2 bot responses, 2nd references 1st |
| GC-03 | New chat clears (existing) | Send → New Chat | Messages cleared |
| GC-04 | Greeting/simple intent | "Hello, how are you?" | Fast response (<5s), short answer, no RAG references |
| GC-05 | Code-related intent | "Write a Python function to reverse a linked list" | Response contains code block (```) |
| GC-06 | Comparison/reasoning intent | "Compare gradient descent vs Adam optimizer" | Response >100 chars, structured (bullets or headers) |
| GC-07 | Math/formula intent | "Derive the backpropagation formula for a 2-layer neural network" | Response contains math notation or step-by-step |
| GC-08 | Recall from context | Send fact → follow-up referencing it | 2nd response references 1st message context |

**Key assertions:** Response arrives via SSE stream, `.streaming-cursor` disappears, no error modals.

---

### Spec 04: Chat Options — Tool Routing (7 tests)

> **Goal:** Verify each toggle routes to the correct tool/pipeline

| ID | Test | Setup | Input | Assert |
|----|------|-------|-------|--------|
| OPT-01 | Web Search toggle | Enable Web Search via + menu | "Latest AI breakthroughs March 2026" | Response contains URLs or source citations, references section visible |
| OPT-02 | Academic Search toggle | Enable Academic Search via + menu | "Recent papers on transformer efficiency" | Response references papers/journals, publication dates within 2024-2026 |
| OPT-03 | ToT toggle | Enable Tree of Thought (Brain icon) | "Analyze the trade-offs between CNNs and Vision Transformers" | Thinking dropdown appears with reasoning steps, response is structured analysis |
| OPT-04 | Web Search + ToT combined | Enable both | "What are the latest criticisms of RLHF in 2026?" | Both thinking steps AND web citations present |
| OPT-05 | Deep Research mode via + menu | Toggle deep research | "Comprehensive analysis of federated learning" | Redirects to research pipeline, shows planning→discovery→synthesis stages |
| OPT-06 | RAG button without course | Click RAG, no course selected | "What is overfitting?" | Normal response (no RAG references, no document citations) |
| OPT-07 | Prompt Coach | Type query, click Sparkles icon | "explain ml" | Coach modal appears with improved prompt suggestion |

**Timeout notes:** OPT-03/04 need 120s timeout (ToT is slow). OPT-05 needs 300s+ (deep research).

---

### Spec 05: RAG + Course + KG Tests (6 tests)

> **Goal:** Verify course selection activates RAG, KG augments when ToT is on, no cross-course leakage

| ID | Test | Setup | Input | Assert |
|----|------|-------|-------|--------|
| RAG-01 | Course selected, general chat | Select "Machine Learning" via left panel or RAG dropdown | "Explain supervised learning" | Response contains course-specific content, RAG status bar shows active |
| RAG-02 | Course + quality comparison | Send same query WITH and WITHOUT course | "Explain gradient descent" | Course response is more detailed/structured, contains curriculum terminology |
| RAG-03 | Course + ToT (KG check) | Select ML + enable ToT | "How does regularization relate to overfitting?" | Response has thinking steps AND course-grounded content |
| RAG-04 | Course + Web Search + ToT | All three enabled | "Compare dropout vs batch normalization with recent research" | Response combines course material + web sources + structured reasoning |
| RAG-05 | Cross-course isolation | Select ML, ask about ML → switch to "Data Structures", ask about DS | ML response mentions ML concepts only; DS response mentions DS concepts only |
| RAG-06 | Deselect course | Select ML → send query → deselect → send same query | 2nd response has no RAG references, is more generic |

---

### Spec 06: Deep Research Mode (5 tests)

> **Goal:** Submit 5 different deep research queries, validate pipeline stages, source quality

| ID | Test | Query | Assert |
|----|------|-------|--------|
| DR-01 | AI Safety research | "Comprehensive analysis of AI alignment approaches in 2025-2026: constitutional AI vs RLHF vs debate" | Pipeline shows plan→discovery→synthesis; final report >500 words; cites ≥3 sources; sources dated 2024+ |
| DR-02 | Federated Learning | "How is federated learning being applied in healthcare data privacy? Focus on 2025 papers" | Report references medical/healthcare journals; dates 2024+; structured sections |
| DR-03 | Quantum ML | "Survey the intersection of quantum computing and machine learning — practical applications as of 2026" | Report has ≥3 distinct source types; academic sources not older than 2023 |
| DR-04 | Education AI | "How are AI tutoring systems being evaluated for effectiveness? Meta-analysis of 2024-2026 studies" | Report references education journals; mentions evaluation metrics; recent publications |
| DR-05 | LLM Efficiency | "Latest techniques for LLM inference optimization: quantization, speculative decoding, and MoE architectures" | Technical depth; code/architecture references; sources from 2025-2026 |

**Timeout:** 600s per test. Assert: no timeout errors, report rendered, sources present.

**Academic freshness check:** For each test, parse source dates and assert ≥50% are from 2024 or later.

---

### Spec 07: Tutor Mode Persistence (4 tests)

> **Goal:** Verify progress saves and clears properly

| ID | Test | Steps | Assert |
|----|------|-------|--------|
| TP-01 | Fresh start | Navigate to `/tutor`, select ML | Tutor page loads, Module 1 visible, no progress marked |
| TP-02 | Progress persists across navigation | In tutor: complete a subtopic → navigate to `/` → return to `/tutor` | Previously completed subtopic still marked ✓ |
| TP-03 | Progress persists across login | Complete subtopic → logout → login → navigate to `/tutor` select ML | Progress still there |
| TP-04 | Clear progress | Call API: `POST /api/progress/update` with `type: 'sync'`, empty arrays → reload `/tutor` | All progress reset to zero, Module 1 shows as starting point |

---

### Spec 08: Tutor Mode — Weak Student (Module 1→4)

> **Goal:** Simulate a struggling student progressing through entire ML curriculum

**Setup:** Clear progress via API before test.

**Student pattern per subtopic:**
1. Send a confused/wrong answer: "I think [wrong concept]?"
2. Assert: Socratic agent asks a simpler guiding question (not just corrects)
3. Send a partially correct follow-up
4. Assert: Agent scaffolds toward understanding
5. Send the correct answer
6. Assert: Agent confirms and advances to next subtopic
7. Verify: progress bar/UI updates

**Key assertions per interaction:**
- Agent never gives direct answers first (Socratic style)
- Agent provides hints when student struggles
- Language is encouraging, not condescending
- Bloom's level stays at L1-L2 (Knowledge/Comprehension)
- Module completion is registered

**Estimated interactions:** ~4 subtopics × 4 modules × 3 turns = ~48 message pairs  
**Timeout:** 120s per message (Socratic responses are heavier than standard chat)

---

### Spec 09: Tutor Mode — Average Student (Module 1→4)

> **Goal:** Simulate a competent student who understands basics but needs depth

**Setup:** Clear progress.

**Student pattern per subtopic:**
1. Give a correct basic answer: e.g. "Gradient descent minimizes the loss function by iterating"
2. Assert: Agent pushes deeper (Bloom's L2→L3, Application/Analysis)
3. Give a reasonable application answer
4. Assert: Agent confirms mastery or asks one more challenge question
5. Progress advances

**Key assertions:**
- Agent pushes to higher Bloom's levels than weak student
- Fewer total interactions per subtopic (2-3 vs 3-5)
- Agent uses "Can you apply this to..." or "What would happen if..." style questions
- Module transitions are smooth

---

### Spec 10: Tutor Mode — Expert Student (Module 1→4)

> **Goal:** Simulate an advanced student who gives detailed, accurate answers

**Setup:** Clear progress.

**Student pattern per subtopic:**
1. Give expert-level answer with mathematical notation or code
2. Assert: Agent recognizes expertise — either confirms quickly or challenges at L4
3. If challenged, give a design-level response
4. Progress advances rapidly

**Key assertions:**
- Fewest interactions per subtopic (1-2 turns)
- Agent reaches L3-L4 Bloom's levels
- Agent may skip scaffolding entirely
- "Mastery achieved" signals appear faster
- Total time per module significantly less than weak student

---

### Spec 11: Skill Tree Progression (5 tests)

> **Goal:** Progress through skill tree and verify completion

| ID | Test | Steps | Assert |
|----|------|-------|--------|
| ST-01 | Access skill tree | Navigate to `/gamification/skill-tree` | Page loads, games list or "create new" visible |
| ST-02 | Create new game | Click "New Game", select ML, complete diagnostic | Game created, level assigned |
| ST-03 | Play through levels | Open game map, answer questions for Level 1 through completion | Progress bar advances, levels unlock |
| ST-04 | Complete all levels | Continue through all generated levels | "Complete" status, credits awarded, game marked finished |
| ST-05 | Classic view reflects | Navigate to `/gamification/skill-tree/classic` | Mastered nodes visible |

**Timeout:** 120s per level (LLM generates questions).

---

### Spec 12: Admin Panel Verification (6 tests)

> **Goal:** Verify all student activity is reflected in admin dashboard

| ID | Test | Steps | Assert |
|----|------|-------|--------|
| ADM-01 | Student in analytics | Login as admin → `/admin/analytics` | ultra.boy7 user visible in student list |
| ADM-02 | Session count matches | Check student detail | Session count ≥ number of test sessions created |
| ADM-03 | Tutor progress reflected | Check student learning profile | Course progress for ML shows completed modules/subtopics |
| ADM-04 | Gamification stats present | Check student detail | XP > 0, learning credits > 0, level > 0 |
| ADM-05 | Latency logs exist | Check admin dashboard or LLM config | Response time metrics visible |
| ADM-06 | Skill tree progress | Check student gamification profile | Skill tree stats reflect completed levels |

---

## Phase 3 — Execution Strategy

### Run Order (sequential — each phase depends on prior state)

```
Round 1: Foundation (parallel-safe)
  01_landing.spec.js          ~30s
  02_auth.spec.js             ~20s

Round 2: Chat Features (sequential — shares session state)
  03_general_chat.spec.js     ~3min
  04_chat_options.spec.js     ~8min (ToT is slow)
  05_rag_course.spec.js       ~5min

Round 3: Deep Research (isolated — very slow)
  06_deep_research.spec.js    ~50min (5 queries × 10min avg)

Round 4: Tutor Mode (sequential — progress-dependent)
  07_tutor_persistence.spec.js  ~3min
  08_tutor_weak_student.spec.js ~40min (48 interactions)
  09_tutor_avg_student.spec.js  ~25min (32 interactions)
  10_tutor_expert_student.spec.js ~15min (16 interactions)

Round 5: Gamification (after tutor generates XP)
  11_skill_tree.spec.js       ~20min

Round 6: Verification (after all activity)
  12_admin_verification.spec.js ~5min
```

**Total estimated runtime:** ~3 hours

### Playwright Config Adjustments Needed

```js
// For deep research and tutor specs, override timeout per-test:
test.setTimeout(600_000); // 10 min per test for DR
test.setTimeout(180_000); // 3 min per test for tutor interactions
```

---

## Phase 4 — Helper Functions

### `tests/e2e/helpers/chat-helpers.js`
- `assertBotResponse(page, minLength)` — wait for stream end, check length
- `assertHasReferences(page)` — check for citation/reference section
- `assertHasThinking(page)` — check for thinking dropdown
- `assertNoError(page)` — no error modal visible
- `getResponseText(page)` — extract last bot message text
- `getResponseLength(page)` — character count of last response
- `toggleWebSearch(page)` — open + menu, click web search
- `toggleToT(page)` — click Brain icon
- `toggleAcademicSearch(page)` — open + menu, click academic search
- `toggleDeepResearch(page)` — open + menu, click deep research
- `selectCourseViaRAG(page, courseName)` — click RAG button → select course
- `deselectCourse(page)` — click × on course chip
- `waitForStreamComplete(page)` — wait for streaming cursor to disappear
- `countBotMessages(page)` — count bot message elements

### `tests/e2e/helpers/tutor-helpers.js`
- `clearTutorProgress(page, courseName)` — API call to POST /api/progress/update
- `navigateToTutor(page)` — go to `/tutor`
- `selectTutorCourse(page, courseName)` — select from dropdown
- `sendTutorMessage(page, text)` — send + wait for Socratic response
- `assertSocraticResponse(page)` — verify response has question-like structure
- `getCurrentModule(page)` — read current module/subtopic from sidebar
- `getProgressPercentage(page)` — read progress from UI
- `waitForSubtopicAdvance(page)` — wait for mastery/advance event
- `getCurriculumStructure(courseName)` — fetch curriculum via API for loop bounds

---

## Phase 5 — Summary Report Template

After all tests run, generate `TEST_REPORT.md` with:

```markdown
## Test Execution Summary

### Results by Spec
| Spec | Total | Pass | Fail | Skip | Duration |
|------|-------|------|------|------|----------|
| ... |

### Semantic Routing Analysis
- Factual queries routed to: [provider]
- Reasoning queries routed to: [provider]
- Code queries routed to: [provider]

### RAG/KG Quality Analysis
- Course-grounded responses quality: [1-5]
- Cross-course isolation: [PASS/FAIL]
- KG augmentation visible: [YES/NO]

### Deep Research Findings
| Query | Sources Found | Freshness (% ≥2024) | Report Length | Duration |
|-------|---------------|----------------------|---------------|----------|

### Tutor Mode Analysis
| Profile | Avg Turns/Subtopic | Bloom's Range | Total Time | Mastery Rate |
|---------|-------------------|---------------|------------|--------------|
| Weak    | ? | L1-L2 | ? | ? |
| Average | ? | L2-L3 | ? | ? |
| Expert  | ? | L3-L4 | ? | ? |

### Admin Panel Verification
- Student data reflected: [YES/NO]
- Latency metrics present: [YES/NO]
- Progress accurate: [YES/NO]

### Bugs Found
1. [description, spec, severity]

### Code Changes Needed
1. [description, file, priority]
```

---

## Phase 6 — Files Removal Manifest

### Immediate Removal (no production dependencies)

**Category 1: Dead test scripts (24 files)**
```
server/scripts/testCompareModels.js
server/scripts/testConversationMemory.js
server/scripts/testDocAnalysis.js
server/scripts/testDocUpload.js
server/scripts/testElasticsearch.js
server/scripts/testEmbeddings.js
server/scripts/testGemini.js
server/scripts/testKGExtraction.js
server/scripts/testLLM.js
server/scripts/testModels.js
server/scripts/testNeo4j.js
server/scripts/testNeo4jDirectConnection.js
server/scripts/testPromptCoach.js
server/scripts/testQdrant.js
server/scripts/testQdrantTutor.js
server/scripts/testQueryClassifier.js
server/scripts/testRouting.js
server/scripts/testSearchComparison.js
server/scripts/testSGLang.js
server/scripts/testStreamingSSE.js
server/scripts/fixGeminiModel.js
server/scripts/removeGeminiFlash.js
server/scripts/fixModelNames.js
server/test_gemini.js
```

**Category 2: Temp/output files (5 files)**
```
temp.txt
code.txt
graph.txt
server/chat.js
server/models_list.json
```

**Category 3: Stale reports (5 items)**
```
playwright-report/
server/test-results/
frontend/lint-report.json
frontend/lint-report.txt
RESULTS.md
```

**Category 4: Session logs & snapshots (2 files)**
```
session2.md
TESTS2.md
```

**Category 5: Pycache (8 directories)**
```
__pycache__/
graph_analyzer/__pycache__/
graph_analyzer/builders/__pycache__/
graph_analyzer/parsers/__pycache__/
lecture_generator/__pycache__/
monitor/__pycache__/
server/rag_service/__pycache__/
.pytest_cache/
```

**Category 6: Backup assets**
```
server/backup_assets/     # 350+ dated folders
```

**Category 7: Ghost npm scripts to remove from `server/package.json`**
```json
Remove: "test", "test:audit-mocks", "test:rate-limit-smoke", "test:job-tracking-smoke"
```

### Review Before Removal (need confirmation)
```
NEXT.md, NEXT_gemini.md, NEXT_Mixed.md   # migration planning docs
Overview_27.md                             # may overlap with GUIDE.md
START-INSTRUCTIONS.md                      # references missing cleanup-all.sh
subjects.js (root)                         # orphaned, server/subjects.js is the real one
server/scripts/testTutorMode.js            # has unit test structure, migrate?
server/scripts/testSemanticRouter.js       # has routing validation, migrate?
```

---

## Decision Points

1. **Admin credentials:** Is `ultra.boy7@gmail.com` an admin? If not, what admin creds for Spec 12?
2. **Curriculum depth:** Need to fetch `GET /api/tutor/curriculum/Machine%20Learning` to know exact module/subtopic count before writing tutor loop bounds.
3. **Deep research timeout:** 600s plan; could need 900s matching `DEEP_RESEARCH_TIMEOUT` env var.
4. **Tutor student simulation:** Vary answer quality only (no system prompt injection).
5. **Parallel execution:** Specs 08-10 (tutor profiles) clear progress between runs — must be strictly sequential.
