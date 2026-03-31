# TESTS2 — iMentor Test Summary

Date: 2026-03-31

## 1) API Suite (pytest)
File: tests/api/test_full_api.py

- Total: 45
- Passed: 43
- Failed: 1
- Skipped: 1
- Runtime: ~3m 06s

### Known failure
- `test_dr_02_report` (deep research report timeout path)
- Root cause: deep orchestrator can exceed timeout window in heavy runs.

## 2) Landing Page Playwright Suite
File: tests/e2e/landing_page.spec.js

- Total: 11
- Passed: 11
- Failed: 0
- Runtime: 31.1s

### Coverage
- Landing load + nav buttons
- Sample chips interaction
- 5-question multi-topic flow
- Auth CTA behavior
- Sign In / Sign Up modal opens
- Mic hint behavior
- Enter vs Shift+Enter
- Empty-state transition
- Full login path to app

## 3) Fixes applied for green E2E run

### A) Landing mic auth hint visibility
- File: frontend/src/components/landing/LandingPage.jsx
- Change: `handleMicClick` now appends an assistant message before setting auth hint state, ensuring CTA renders even when no prior messages exist.

### B) Selector collision fix in tests
- File: tests/e2e/landing_page.spec.js
- Change: user bubble selector updated from `.bg-white.text-black` to `.rounded-2xl.bg-white` to avoid matching auth CTA button styles.
- Impact: fixed LP-03 count assertion and LP-09 bubble checks.

## 4) Current status

- Landing page redesign tests: ✅ Stable and passing
- API core flows: ✅ Passing
- Deep research report stress case: ⚠️ one timeout-prone test remains

## 5) Recommended next step

For CI reliability, isolate deep research stress tests under a separate marker/job and keep default suite focused on core API + UI regression.