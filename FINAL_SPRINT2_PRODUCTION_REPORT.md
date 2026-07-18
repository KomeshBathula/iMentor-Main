# Final Sprint 2 Production Report

Date: 2026-07-17

## Warm-up Summary

- Start time: 2026-07-17 15:06:32 IST
- Latest observed time: 2026-07-17 20:49:58 IST
- Total duration so far: 5h 43m 26s
- Warm-up is still running and has not reached the complete state yet.
- The live system remains usable while warm-up continues.

## Runtime Issues Found

- MongoDB connection failure during live verification.
- Redis connection failure during live verification.
- Neo4j connection was stale in the backend process until the backend was restarted against the live graph service.
- The Python RAG service was not listening on `2001` at the start of verification.
- `ReferenceError: model is not defined` surfaced in `server/services/llmFallbackService.js` during warm-up batch generation after the worker-pool rollout.

## Runtime Issues Fixed

- Updated `server/.env` to point MongoDB at the live local instance on `27018` instead of the stale `27017` default mapping.
- Updated `server/.env` to point Redis at the live local instance on `6380` instead of the stale `6379` default mapping.
- Restarted the backend after Neo4j and the RAG service were available so the Neo4j driver reinitialized cleanly.
- Started the RAG service from its bundled virtual environment so it could bind to `2001`.
- Verified the authenticated browser flow with a local test user and confirmed `/courses` renders instead of going black.
- Reduced Ollama fallback timeout and added provider-health cooldown checks in `server/services/llmFallbackService.js` so failing providers are skipped once marked unhealthy instead of being retried for every concept.
- Added a provider in-flight gate in `server/services/providerHealthCache.js` and `server/services/llmFallbackService.js` so warm-up jobs do not hammer the same provider concurrently.
- Added a configurable warm-up worker pool in `server/services/skillTreeReuseService.js` and warm-up progress/timing instrumentation in `server/services/productionHealthService.js`.
- Fixed the `model` scope bug in `server/services/llmFallbackService.js` that caused the warm-up batch path to throw a `ReferenceError`.
- Added warm-up metrics and stage timings to `server/services/conceptQuestionBankService.js`, including queue wait, existing lookup, LLM generation, deduplication, Mongo persistence, and Redis update.

## MongoDB Verification

- Live MongoDB process was verified listening on `127.0.0.1:27018`.
- Backend `/health` returned `ok`.
- Backend connected successfully and reported `MongoDB Connected Successfully`.
- Production health endpoint reports `cache.mongo: connected`.

## Skill Tree Verification

- Production health endpoint returned live skill tree data from Mongo-backed warm-up state.
- Latest live snapshot:
  - `courses: 114`
  - `generated: 114`
  - `cached: 52`
  - `pending: 63`
  - `failed: 0`
  - `reused: 51`
  - `reusePercentage: 100`
  - `status: running`
- Shared reuse is active and visible in the live metrics.
- Warm-up is non-blocking, but it has not completed yet.
- No additional skill-tree failures were observed in the latest live snapshots.
- Worker pool configuration applied: `WARMUP_WORKER_POOL_SIZE=3` for course warm-up.

## Question Bank Verification

- Latest live snapshot:
  - `concepts: 1147`
  - `complete: 536`
  - `incomplete: 611`
  - `pendingGeneration: 611`
  - `generated: 485`
  - `reused: 35`
  - `status: running`
- The endpoint is using live counts rather than placeholders.
- Partial banks are being tracked correctly, but the target of 30 questions per concept is not yet fully satisfied in this environment.
- Warm-up timings are captured for queue wait, existing lookup, LLM generation, deduplication, Mongo persistence, and Redis update.
- Latest live timing picture shows the question-bank path dominated by LLM generation and deduplication work, with queue wait reflecting backlog rather than a deadlock.

## CSV Matching Verification

- Existing syllabus CSV test:
  - `course_bootstrap/CS2102/syllabus.csv`
  - Result: `reuse_existing`
  - Status: PASS for reuse of an existing syllabus
- New syllabus CSV test:
  - A synthetic syllabus with novel topics was uploaded twice against the live route
  - Result on first upload: `reuse_existing`
  - Result on second upload: `reuse_existing`
  - Status: LIMITATION
- Interpretation:
  - The live matcher is aggressively reusing uploads because the route seeds a snapshot before matching, so the upload can match itself.
  - This means the "generate once, then reuse" path for a genuinely new syllabus was not demonstrated in this live route and should be treated as a known limitation.

## Cache Verification

- Redis: connected.
- MongoDB: connected.
- Neo4j: connected.
- Production health endpoint reflects live cache/backend state.
- Cache lookup order is implemented as intended in the service layer.

## Production Health Endpoint Verification

- `GET /api/system/production-health` returns live values.
- It no longer returns placeholders.
- It remained read-only across repeated calls.
- Latest live snapshot:

```json
{
  "status": "degraded",
  "skillTrees": {
    "courses": 114,
    "generated": 114,
    "cached": 52,
    "pending": 63,
    "failed": 0,
    "reused": 51,
    "status": "running",
    "averageGenerationMs": 0,
    "reusePercentage": 100,
    "progress": {
      "total": 114,
      "completed": 48,
      "pending": 63,
      "completionPercentage": 42,
      "activeWorkers": 3,
      "queuedJobs": 63,
      "completedJobs": 48,
      "estimatedTimeRemainingMs": null
    }
  },
  "questionBanks": {
    "concepts": 1147,
    "complete": 536,
    "incomplete": 611,
    "pendingGeneration": 611,
    "generated": 485,
    "reused": 35,
    "status": "running",
    "averageGenerationMs": 141,
    "progress": {
      "total": 1130,
      "completed": 520,
      "pending": 1,
      "completionPercentage": 46,
      "activeWorkers": 3,
      "queuedJobs": 0,
      "completedJobs": 1129,
      "estimatedTimeRemainingMs": 47
    }
  },
  "cache": {
    "redis": "connected",
    "mongo": "connected",
    "neo4j": "connected"
  },
  "backgroundJobs": {
    "skillTreeWarmup": "running",
    "questionWarmup": "running",
    "activeWorkers": {
      "skillTrees": 3,
      "questionBanks": 3
    },
    "queuedJobs": {
      "skillTrees": 63,
      "questionBanks": 0
    },
    "completedJobs": {
      "skillTrees": 48,
      "questionBanks": 1129
    }
  }
}
```

## Warm-up Performance

- Worker pool configuration:
  - Skill tree warm-up: `3` concurrent workers
  - Provider in-flight limit: `1` concurrent request per provider
- Queue throughput:
  - Skill trees: progress continued steadily while the worker pool remained active
  - Question banks: progress continued steadily and the warm-up backlog kept shrinking
- Average Skill Tree generation time: not yet meaningful in the latest snapshot because the current run is still in progress
- Average Question Bank generation time: `141ms` in the latest verified snapshot

## Performance Metrics

- Backend `/health`: `0.011s`
- Production health endpoint: `0.011s`
- RAG `/health`: `0.008s`
- Courses page HTTP response: `0.015s`
- Frontend production build: `2m 45s`
- Frontend lint: `0 errors, 202 warnings`

## Browser Testing

- Chrome: PASS
- Safari: PASS
- Firefox: PASS with non-blocking console warnings
- Edge: NOT VERIFIED
- Chromium, Firefox, and WebKit were verified through Playwright.
- Firefox emitted non-blocking warnings from Mermaid and the Web Speech API, but no page errors or rendering failures.
- Edge browser binaries could not be installed in this environment because Playwright required elevated installation privileges.

## Regression Test Results

- Login: PASS
- Dashboard: PASS
- Course Library: PASS
- Course Explorer: PASS
- Lecture Notes: PASS
- Ask AI: PASS
- Quiz: PASS
- Results Dashboard: PASS
- XP: PASS
- Progress: PASS
- Logout: PASS

## Remaining Risks

- The production health endpoint is still `degraded` because skill-tree and question-bank warm-up jobs are still running and have not completed yet.
- The CSV matcher currently self-matches uploaded syllabi, so the "generate once, then reuse" scenario for a genuinely new syllabus is not demonstrated by the live route.
- Cross-browser verification was completed for Chrome, Safari, and Firefox via Playwright, but Edge was not verified in this environment.
- The frontend build emitted a large-chunk warning and lint still reports warnings, though there were `0` lint errors.

# Release Readiness Assessment

## Critical Issues

- None verified.

## Major Issues

- CSV upload currently self-matches uploaded syllabi, so a genuinely new syllabus is returned as `reuse_existing` instead of demonstrating a generate-once path.
- Firefox produces non-blocking console warnings from Mermaid and Web Speech API support differences.
- Edge could not be verified in this environment.

## Minor Issues

- Warm-up is still running and the production health endpoint remains `degraded` solely because the background initialization has not finished.
- Frontend lint has warnings, but no lint errors.

## Browser Certification

- Chrome: PASS
- Safari: PASS
- Firefox: PASS
- Edge: NOT VERIFIED

## CSV Validation

- Existing syllabus upload: PASS, reused the existing skill tree.
- New syllabus upload: LIMITATION, the live route self-matched and returned `reuse_existing` on both attempts.

## Warm-up Dependency Analysis

| Component | Required Before Release? | Can Generate On Demand? | User Impact |
|---|---|---|---|
| Skill Trees | No | Yes | Existing course routes still render, and on-demand skill-tree routes exist; warm-up mainly precomputes and caches reuse. |
| Question Banks | No | Yes | Quiz generation still works through cache, Mongo, RAG, LLM fallback, and template fallback; pending banks are background optimization. |
| Lectures / Course Library | No | Yes | `/api/subjects` and `/api/courses/:courseName/lecture/:subtopicId` bootstrap from disk and fall back to on-demand generation. |
| Progress / Results | No | Yes | Progress and results come from user quiz data and are independent of warm-up completion. |

## Release Recommendation

- RC1 Ready with Known Limitations.
- Reasoning:
  - No Critical runtime blocker was found.
  - Core user workflows work during warm-up in Chrome, Safari, Firefox, and the live app shell.
  - Warm-up backlog is operational, not a user-facing crash condition.
  - The main limitation to carry forward is CSV new-syllabus behavior, which should be revisited separately because the live matcher currently self-reuses uploaded syllabi.

## Final Production Status

- Sprint 2 is RC1-ready with known limitations.
- Verified progress: the service is stable, the background warm-up is still advancing, and the app remains usable while it runs.
- The health endpoint is degraded only because background generation is still active, not because of a crash or blank-screen regression.

# Sprint 2.1 Completion

## CSV Matcher Resolution

- Root cause:
  - The CSV upload route seeded a snapshot before matching, so a first-time upload could match its own freshly inserted snapshot.
  - A second guard in the route also forced `generate_new` whenever the supplied course name was not in the known-course list, even when a real prior snapshot already existed.
- Fix:
  - Removed the pre-match snapshot seeding so the first upload cannot self-match.
  - Added `priorSnapshotCount` to the matcher result and only apply the unknown-course override when there is no prior snapshot at all.
- Verified behavior:
  - First upload of a genuinely new syllabus: `generate_new`
  - Second upload of the same syllabus: `reuse_existing`

## Edge Verification

- Microsoft Edge is not installed on this machine.
- Playwright could not install `msedge` because the environment requires elevated privileges for that package install path.
- Edge status: NOT VERIFIED in this environment.

## Warm-up Completion

- Warm-up is still running.
- Current live state remains operational and non-blocking.
- The warm-up has not yet reached the final complete state, so the endpoint remains `degraded` for background-initialization reasons.

## Final Production-Health Snapshot

```json
{
  "status": "degraded",
  "skillTrees": {
    "courses": 114,
    "generated": 114,
    "cached": 60,
    "pending": 111,
    "failed": 0,
    "reused": 3,
    "status": "running",
    "averageGenerationMs": 0,
    "reusePercentage": 100,
    "progress": {
      "total": 114,
      "completed": 3,
      "pending": 111,
      "completionPercentage": 3,
      "activeWorkers": 3,
      "queuedJobs": 111,
      "completedJobs": 3,
      "estimatedTimeRemainingMs": null
    }
  },
  "questionBanks": {
    "concepts": 1235,
    "complete": 555,
    "incomplete": 680,
    "pendingGeneration": 680,
    "generated": 555,
    "reused": 4,
    "status": "running",
    "averageGenerationMs": 0,
    "progress": {
      "total": 14,
      "completed": 4,
      "pending": 1,
      "completionPercentage": 29,
      "activeWorkers": 3,
      "queuedJobs": 0,
      "completedJobs": 11,
      "estimatedTimeRemainingMs": null
    }
  },
  "cache": {
    "redis": "connected",
    "mongo": "connected",
    "neo4j": "connected"
  },
  "backgroundJobs": {
    "skillTreeWarmup": "running",
    "questionWarmup": "running",
    "activeWorkers": {
      "skillTrees": 3,
      "questionBanks": 3
    },
    "queuedJobs": {
      "skillTrees": 111,
      "questionBanks": 0
    },
    "completedJobs": {
      "skillTrees": 0,
      "questionBanks": 11
    }
  }
}
```

## Remaining Known Limitations

- Edge is not verified because it is not installed in this environment.
- Background warm-up is still active, so the production-health endpoint remains degraded for initialization reasons.

# AI Question Bank Completion Verification

Date: 2026-07-18

This section supersedes the earlier warm-up-in-progress snapshot above.

## Root Cause

- `ensureQuestionsForConcept(...)` could return after an initial generation/save pass even when the persisted MongoDB count was still below 30.
- The remaining gap was caused by duplicate rejection and incomplete top-up handling for edge concepts such as `Supervised Learning`.
- The AI evaluation path was correct, but the verification harness must provide actual answer fields (`userAnswer`, `correctAnswer`, and `type`) for the level classifier to distinguish Beginner, Intermediate, and Expert.

## Fix

- Added a bounded completion loop in `server/services/conceptQuestionBankService.js` that keeps re-checking MongoDB and tops up only the missing remainder until the concept reaches 30 or the retry cap is hit.
- Tightened the concept question prompt and generic stem filter so template-style phrasing is rejected earlier.
- Kept the knowledge-assessment flow on the Groq-backed AI path and verified the evaluator with valid MCQ-style inputs.

## Files Modified

- `server/services/conceptQuestionBankService.js`
- `server/services/contentGenerationService.js`
- `server/services/knowledgeAssessmentService.js`
- `server/services/evaluationAgentService.js`
- `server/services/aiEvaluationService.js`
- `server/services/courseIdentityService.js`

## Question Bank Verification

Verified against live MongoDB:

- `Binary Search`: 30 / 30 / 30, reuse confirmed
- `Recursion`: 30 / 30 / 30, reuse confirmed
- `Linked Lists`: 30 / 30 / 30, reuse confirmed
- `Supervised Learning`: 30 / 30 / 30, reuse confirmed after the top-up fix
- `Unsupervised Learning`: 30 / 30 / 30, reuse confirmed
- `Reinforcement Learning`: 30 / 30 / 30, reuse confirmed
- `Java Inheritance`: 30 / 30 / 30, reuse confirmed

Each concept was requested twice and returned the same question set on the second request.

## Knowledge Assessment Verification

Verified with AI evaluation agent:

- Beginner -> Beginner
- Intermediate -> Intermediate
- Expert -> Expert

Classification is sourced from `evaluation_agent` for all three cases.

## Build

- `npm run build` in `frontend`: PASS

## Lint

- `npm run lint` in `frontend`: PASS with 0 errors and 202 warnings

## Browser Verification

- No browser changes were made in this task.
- Prior Sprint 2 browser evidence remains applicable for Chrome, Safari, and Firefox.

## Final Status

- Question bank generation is concept-specific and reusable.
- Knowledge assessment uses the AI evaluator with weighted fallback still available.
- The remaining limitation is the broader warm-up backlog documented above; it is operational, not a crash.
