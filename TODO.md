# TODO — Development & Deployment Improvements

---

## Immediate Security Issue (Act Today)

**Your `server/.env.example` contains real API keys** — Gemini, Groq, and email credentials. Even though `.env` is gitignored, `.env.example` is not and is likely committed. Rotate those keys now:
- Gemini: Google AI Studio → revoke and regenerate
- Groq: console.groq.com → API Keys → revoke
- Email password: your Google App Password → revoke at myaccount.google.com

Also: `NEO4J_PASSWORD=password` in docker-compose.yml is a hardcoded weak default.

---

## Mistakes You're Making Right Now

### 1. No Quality Gates Before Code Lands
You're using Claude Code + Copilot which generates code fast — but there's nothing that checks the code before it runs or commits. No ESLint on the server side, no pre-commit hooks. Any AI-generated code that has bad patterns, missing awaits, or wrong variable names goes straight in unchallenged.

### 2. No Test Runner At All
You have 27 test files in the repo. None of them run through a proper test runner — `package.json` just calls them as raw Node scripts. There's no Jest or Vitest, no coverage, no way to know if a change broke something. This is the #1 reason autonomous coding "deprecates your original assumptions" — there's no automated referee.

### 3. Two Routing Services With the Same Function Name
`semanticRouter.js` and `semanticRouterService.js` both export `routeQuery()`. If an AI tool auto-imports the wrong one, it silently uses the wrong system. This has already happened — the routing spec analysis confirmed one of them may not be properly integrated.

### 4. Environment Variables Not Validated on Startup
Only three env vars are checked (`JWT_SECRET`, `ENCRYPTION_SECRET`, `MONGO_URI`). The server starts even if `GEMINI_API_KEY` is missing — you only discover this at runtime when a user's request fails. You already have `zod` installed and it's unused.

### 5. Startup Script Is Machine-Specific
`startup.sh` has your home directory hardcoded: `/home/sri/Downloads/iMentor_march/chatbot`. It uses `gnome-terminal` which breaks on any non-Linux machine. Anyone else (or a fresh machine) cannot start the project without editing the script.

### 6. Docker Container Runs as Root
No `USER nonroot` in the Dockerfile. If anything in the container is exploited, it has root access. Also no `.dockerignore`, so the build context includes `node_modules`, `.git`, test files — makes builds slow and images bloated.

### 7. `compression` Middleware Not Installed
Every API response is sent uncompressed. For AI responses which can be 2-5KB of text, gzip compression cuts that by 70%. One line to add, zero code changes.

---

## Tools You're Missing

### Non-Negotiable (Add This Week)

| Tool | Purpose | Install |
|---|---|---|
| **ESLint** on server | Catch bad patterns in Node.js code | `npm install -D eslint @eslint/js` |
| **Prettier** | Consistent formatting across AI-generated code | `npm install -D prettier` |
| **Husky** + **lint-staged** | Block commits that fail lint | `npm install -D husky lint-staged` |
| **Vitest** or **Jest** | Actual test runner for your existing tests | `npm install -D vitest` |
| **zod** env validation | Validate all env vars at startup (already installed, not used) | Already there |
| **.nvmrc** file | Tell IDEs and terminals which Node version to use | Just create the file: `echo "20" > .nvmrc` |

### High Value (Add This Sprint)

| Tool | Purpose | Install |
|---|---|---|
| **compression** | Gzip API responses | `npm install compression` |
| **@vite/resolve alias** | `@/components/X` instead of `../../../components/X` | Config change only |
| **.dockerignore** | Stop sending node_modules into Docker builds | Create file |
| **nodemon --watch** with reload rules | Already installed, but configure it to not restart on test file changes | Config change |

### Accelerators for VS Code (That Work With Your Stack)

**Extensions to install:**
- **ESLint** — real-time lint feedback as you type (critical when AI generates code)
- **Prettier - Code formatter** — auto-format on save
- **Error Lens** — shows errors inline in the editor, not just in the problems panel
- **GitLens** — shows who changed what line, when. Critical for tracking what AI tools modified
- **REST Client** — test your API endpoints from `.http` files without Postman
- **Docker** — manage containers from VS Code sidebar
- **MongoDB for VS Code** — query your DB without leaving the editor
- **Thunder Client** — lightweight API client built into VS Code

**VS Code settings to add to `.vscode/settings.json`:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.workingDirectories": ["./server", "./frontend"]
}
```
This makes Prettier and ESLint fix issues automatically every time you save — catches AI-generated code issues before you even run anything.

---

## How to Stop Autonomous Coding From Breaking Your Logic

### Layer 1 — Write Assumption Comments (Highest ROI)
Before any AI touches a file, put a comment at the top of each critical service explaining the invariants:

```javascript
// INVARIANT: This service is the ONLY place that writes to useWebSearch.
// Semantic router can only ADD tools, never remove user-set ones.
// DO NOT merge userRequestedTools and systemSuggestedTools into the same variable.
// See docs/ROUTING_IMPROVEMENT_SPEC.md §Issue 2.5
```

AI tools respect these. They treat `INVARIANT:` comments as constraints.

### Layer 2 — Set Up Pre-Commit Hook (Automated Guard)
Install Husky so that before any commit, your tests and lint run:

```bash
# One-time setup
npx husky init
echo "npm test && npm run lint" > .husky/pre-commit
```

Now even if Claude Code makes a change that breaks a test, the commit is blocked. You see it before it's in git history.

### Layer 3 — Write Tests for Your Routing Assumptions
Your routing logic has specific expected behaviors. Write tests for them once, and every future change must pass them. Example test assertions that would catch routing regressions:

```javascript
// test: tutor mode must disable ToT
// test: deepResearchMode must intercept before all other routes
// test: web search toggle must block direct_answer fast path
// test: semantic routing must not run when deepResearchMode=true
```

These are not hard to write — they're just function calls with expected outputs. With Vitest you can run them in under 2 seconds.

### Layer 4 — Use Claude Code's `/review` Workflow
After any autonomous coding session, before committing:
1. Run `git diff` to see everything that changed
2. Ask Claude Code: *"Review this diff. Does it violate any of the invariants in [file]? Does it change any routing assumptions?"*
3. Only commit after the review passes

This is the equivalent of a code review with a senior developer who knows your codebase.

### Layer 5 — CLAUDE.md File (Persistent Rules for Claude Code)
Claude Code reads a `CLAUDE.md` file in your project root and follows it in every session. Write your architectural rules there once:

```markdown
# CLAUDE.md

## Routing Rules — Never Violate
- semanticRouterService.js and semanticRouter.js are two separate systems. Do not merge.
- User toggle values (useWebSearch, criticalThinkingEnabled) must never be overwritten silently.
- deepResearchMode=true must always intercept before semantic routing runs.
- ToT requires BOTH user toggle AND complexity gate. Do not remove the gate.

## Never Add Without Asking
- New npm packages
- New environment variables
- New database collections
- Changes to routingConfig.js thresholds
```

Once this file exists, Claude Code will flag if it's about to violate one of those rules.

### Layer 6 — Commit Small, Review Often
The biggest mistake with AI coding tools: letting them make 10 file changes in one session and committing it all. If something breaks, you can't isolate it. Commit after each logical unit of change:
- One commit per file modified
- Or one commit per feature, maximum 3-4 files

---

## Summary Priorities

### This Week
- [ ] Rotate the exposed API keys in `.env.example`
- [ ] Add `.nvmrc` with `20`
- [ ] Add `CLAUDE.md` with your routing invariants
- [ ] Install ESLint on the server side and Prettier globally
- [ ] Add `compression` middleware (one import, one line in server.js)

### This Sprint
- [ ] Set up Husky pre-commit hooks
- [ ] Configure Vitest and wire your existing test files to it
- [ ] Add Zod env validation at startup
- [ ] Add `.dockerignore`
- [ ] Replace the hardcoded path in `startup.sh` with `$(dirname "$0")`

### Ongoing Habit
- [ ] Write `// INVARIANT:` comments on every critical design decision
- [ ] Review every AI-generated diff before committing
- [ ] One logical change per commit
