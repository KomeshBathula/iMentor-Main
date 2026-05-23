/**
 * server/config/routingConfig.js
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║         iMentor COMPLETE ROUTING CONFIGURATION & DECISION MATRIX        ║
 * ║                    Day Shift vs. Night Shift Architecture                ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * This file is the SINGLE SOURCE OF TRUTH for all routing logic.
 * It defines:
 *  1. ROUTE TYPES — what orchestration path a query takes
 *  2. DECISION METHODS — how the route is decided (latency comparison)
 *  3. PROVIDER MATRIX — which LLM provider/model handles each route
 *  4. FULL COMBINATION TABLE — every possible route×method×provider combination
 *  5. THRESHOLDS — confidence cutoffs that govern the decision waterfall
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: ROUTE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All possible orchestration routes.
 * Each route maps to a different execution path in the chat handler chain.
 *
 * ┌─────────────────┬────────────────────────────────────────────────────────┐
 * │ Route           │ Description                                            │
 * ├─────────────────┼────────────────────────────────────────────────────────┤
 * │ direct_answer   │ Simple greetings/factual → single LLM pass, NO agent  │
 * │ standard        │ Normal questions → agentService (RAG + context)        │
 * │ tot             │ Deep reasoning → Tree of Thoughts (score > 85 REQUIRED)│
 * │ react           │ Tool-use tasks → ReAct orchestrator (user-explicit)    │
 * │ web_search      │ Web search tool → DuckDuckGo/Serper (semantic trigger) │
 * │ tutor           │ Socratic mode → SocraticTutorService (session flag)    │
 * │ quiz            │ Assessment → QuizEvaluator (session flag)              │
 * │ code            │ Programming → CodeExecutor (intent flag)               │
 * │ research        │ Deep literature → DeepResearch (intent flag)           │
 * │ night_stn       │ OFFLINE ONLY — STN generation (35B, cron/admin CLI)    │
 * │ night_kg        │ OFFLINE ONLY — KG extraction + session eval (35B, cron)│
 * └─────────────────┴────────────────────────────────────────────────────────┘
 *
 * NOTE: Tutor mode (TUTOR) bypasses semantic routing entirely via session_flag
 *       check at step 0. Semantic router only runs for non-flagged sessions.
 */
const ROUTES = {
    DIRECT_ANSWER:  'direct_answer',
    STANDARD:       'standard',
    TOT:            'tot',
    REACT:          'react',
    WEB_SEARCH:     'web_search',
    TUTOR:          'tutor',
    QUIZ:           'quiz',
    CODE:           'code',
    RESEARCH:       'research',
    NIGHT_STN:      'night_stn',
    NIGHT_KG:       'night_kg',
    KNOWLEDGE_GRAPH: 'knowledge_graph',  // KG-augmented standard path (Issue 1.1)
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: DECISION METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How the route/model is decided. Methods are tried in PRIORITY ORDER.
 * When a method is confident enough it short-circuits — lower methods never run.
 *
 * ┌──────┬─────────────────────────────┬───────────┬───────────────────────────────────────────────┐
 * │ Prio │ Method                      │ Latency   │ When Used                                     │
 * ├──────┼─────────────────────────────┼───────────┼───────────────────────────────────────────────┤
 * │  0   │ session_flag                │ ~0ms      │ tutorMode/quizMode/codeMode flags on session  │
 * │  1   │ redis_cache_hit             │ ~1ms      │ Identical query within 5min TTL               │
 * │  2   │ manual_model_selection      │ ~0ms      │ User explicitly selected a model              │
 * │  3   │ semantic_embedding          │ ~10ms*    │ DEFAULT — embedding cosine similarity          │
 * │      │                             │           │ *5ms Python /embed + ~1ms JS cosine           │
 * │      │                             │           │ *Query embedding is FREE — already computed   │
 * │      │                             │           │  for Qdrant RAG; routing reuses it.            │
 * │  4   │ keyword_fallback            │ ~0.1ms    │ semantic confidence < SEMANTIC_THRESHOLD       │
 * │  5   │ llm_2b_router               │ 100-500ms │ keyword confidence < KEYWORD_THRESHOLD         │
 * │      │                             │           │ (LAST RESORT — avoid if possible)             │
 * │  6   │ smart_model_router          │ ~2ms      │ selectModel() from smartModelRouterService     │
 * │  7   │ course_adapter_mapping      │ ~5ms (DB) │ courseId present in context                   │
 * │  8   │ subject_finetuned           │ ~5ms (DB) │ subject match in LLMConfiguration DB          │
 * │  9   │ provider_default            │ ~1ms      │ Fall through — default model in provider       │
 * │ 10   │ hardcoded_env_default       │ ~0ms      │ Absolute last resort — env vars               │
 * └──────┴─────────────────────────────┴───────────┴───────────────────────────────────────────────┘
 */
const DECISION_METHODS = {
    SESSION_FLAG:          'session_flag',
    REDIS_CACHE:           'redis_cache_hit',
    MANUAL_MODEL:          'manual_model_selection',
    SEMANTIC_EMBEDDING:    'semantic_embedding',   // ← NEW: Phase 0
    KEYWORD_FALLBACK:      'keyword_fallback',
    LLM_2B_ROUTER:         'llm_2b_router',
    SMART_MODEL_ROUTER:    'smart_model_router',
    COURSE_ADAPTER:        'course_adapter_mapping',
    SUBJECT_FINETUNED:     'subject_finetuned',
    PROVIDER_DEFAULT:      'provider_default',
    HARDCODED_ENV:         'hardcoded_env_default',
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: PROVIDER + MODEL MATRIX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All possible provider × model combinations in our stack.
 *
 * ┌──────────────────┬───────────────────────────────────┬────────────┬─────────────────────────────────────┐
 * │ Provider         │ Model                             │ Status     │ Use Case (Day Shift)                 │
 * ├──────────────────┼───────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ ollama           │ mxbai-embed-large (EMBEDDINGS)    │ ✅ Active   │ Embeddings ONLY - CPU efficient     │
 * │ ollama           │ qwen2.5:3b (SEMANTIC ROUTER)      │ ✅ Active   │ Semantic similarity ONLY (fallback) │
 * │ gemini           │ gemini-2.0-flash                  │ ✅ Active   │ Fallback when SGLang unreachable    │
 * │ groq             │ llama-3.1-70b-versatile           │ ❌ No key  │ Planned fast fallback               │
 * │ openai           │ gpt-4o                            │ ❌ No key  │ Not configured                      │
 * ├──────────────────┼───────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ SGLang (PRIMARY)   │                                   │            │                                      │
 * ├──────────────────┼───────────────────────────────────┼────────────┼─────────────────────────────────────┤
 * │ sglang_chat        │ Qwen/Qwen2.5-7B-Instruct-AWQ      │ ✅ Active  │ ALL chat, direct_answer, standard   │
 * │ sglang_reason      │ Qwen/Qwen2.5-7B-Instruct-AWQ      │ ✅ Active  │ ToT/complex reasoning               │
 * │ sglang_heavy       │ Qwen/Qwen2.5-7B-Instruct-AWQ      │ ✅ Active  │ STN generation, offline jobs        │
 * │ sglang_tutor       │ Qwen/Qwen2.5-7B-Instruct-AWQ      │ ✅ Active  │ Tutor mode Socratic learning        │
 * └──────────────────┴───────────────────────────────────┴────────────┴─────────────────────────────────────┘
 *
 * SGLang startup commands (for reference):
 *   DAY:   sglang serve Qwen/Qwen2.5-14B-Instruct --port 8000 --max-model-len 8192
 *   NIGHT: sglang serve Qwen/Qwen2.5-35B-Instruct --port 8002 --tensor-parallel-size 2 --max-model-len 8192
 */
const PROVIDERS = {
    // ── Ollama: EMBEDDINGS + SEMANTIC ROUTER ONLY ──
    OLLAMA_EMBED:    { provider: 'ollama',     model: process.env.OLLAMA_EMBED_MODEL   || 'mxbai-embed-large', shift: 'day',   active: true, embeddingOnly: true },
    OLLAMA_ROUTER:   { provider: 'ollama',     model: process.env.OLLAMA_ROUTER_MODEL  || 'qwen2.5:3b',        shift: 'day',   active: true, routerOnly: true },
    // ── Primary: SGLang for ALL chat operations ──
    SGLANG_CHAT:     { provider: 'sglang_chat',  model: process.env.SGLANG_CHAT_MODEL    || 'Qwen/Qwen2.5-7B-Instruct-AWQ', shift: 'day',   active: process.env.SGLANG_ENABLED === 'true' },
    SGLANG_REASON:   { provider: 'sglang_reason',model: process.env.SGLANG_REASON_MODEL  || 'Qwen/Qwen2.5-7B-Instruct-AWQ', shift: 'day',   active: process.env.SGLANG_ENABLED === 'true' },
    SGLANG_HEAVY:    { provider: 'sglang_heavy', model: process.env.SGLANG_HEAVY_MODEL   || 'Qwen/Qwen2.5-7B-Instruct-AWQ', shift: 'both',  active: process.env.SGLANG_ENABLED === 'true' },
    SGLANG_TUTOR:    { provider: 'sglang_chat',  model: process.env.SGLANG_CHAT_MODEL    || 'Qwen/Qwen2.5-7B-Instruct-AWQ', shift: 'day',   active: process.env.SGLANG_ENABLED === 'true' },
    // ── Fallback: Gemini when SGLang unreachable ──
    GEMINI_FLASH:    { provider: 'gemini',     model: process.env.GEMINI_MODEL         || 'gemini-2.0-flash', shift: 'day', active: !!process.env.GEMINI_API_KEY },
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: FULL COMBINATION TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * COMPLETE ROUTING MATRIX — Every possible Route × Decision Method × Provider combination.
 *
 * ┌────────────────┬──────────────────────┬───────────────────────┬─────────────┬──────────────┬─────────────────────────────────────────────────┐
 * │ Route          │ Decision Method      │ Provider / Model      │ Shift       │ Status       │ Condition                                        │
 * ├────────────────┼──────────────────────┼───────────────────────┼─────────────┼──────────────┼─────────────────────────────────────────────────┤
 * │ direct_answer  │ redis_cache_hit      │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ Same query within 5min                           │
 * │ direct_answer  │ semantic_embedding   │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ cosine > 0.75 to direct_answer prototypes        │
 * │ direct_answer  │ semantic_embedding   │ gemini / gemini-flash  │ day         │ ✅ Fallback  │ cosine > 0.75 AND sglang unreachable             │
 * │ direct_answer  │ keyword_fallback     │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ greeting regex OR len <= 3 words                  │
 * ├────────────────┼──────────────────────┼───────────────────────┼─────────────┼──────────────┼─────────────────────────────────────────────────┤
 * │ standard       │ redis_cache_hit      │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ Cached routing decision                          │
 * │ standard       │ manual_model_sel.    │ user-chosen model     │ day         │ ✅ Active    │ user.modelRoutingMode !== 'auto'                  │
 * │ standard       │ semantic_embedding   │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ cosine > 0.65 (technical/reasoning/multilingual) │
 * │ standard       │ semantic_embedding   │ gemini / gemini-flash  │ day         │ ✅ Fallback  │ cosine > 0.65 AND sglang unreachable             │
 * │ standard       │ keyword_fallback     │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ semantic confidence < 0.65                       │
 * │ standard       │ llm_2b_router        │ ollama / qwen2.5:3b   │ day         │ ✅ Last res. │ keyword confidence < 0.65 (TABLE-BASED)          │
 * │ standard       │ course_adapter       │ fine-tuned adapter    │ day         │ ✅ if exists │ courseId in context + active adapter mapping     │
 * │ standard       │ subject_finetuned    │ fine-tuned model      │ day         │ ✅ if exists │ subject match in LLMConfiguration collection     │
 * │ standard       │ smart_model_router   │ best available        │ day         │ ✅ Active    │ auto routing mode, no cache                      │
 * ├────────────────┼──────────────────────┼───────────────────────┼─────────────┼──────────────┼─────────────────────────────────────────────────┤
 * │ tot            │ user_explicit_flag   │ sglang_reason / 7B-AWQ │ day         │ ✅ Active    │ Thinking icon activated (criticalThinkingEnabled)│
 * │ tot            │ user_explicit_flag   │ gemini / gemini-flash  │ day         │ ✅ Fallback  │ Thinking mode AND sglang unreachable             │
 * ├────────────────┼──────────────────────┼───────────────────────┼─────────────┼──────────────┼─────────────────────────────────────────────────┤
 * │ web_search     │ semantic_embedding   │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ cosine > 0.70 to web_search prototypes           │
 * │ web_search     │ intent_detection     │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ keyword: current, latest, news, today, 2026      │
 * ├────────────────┼──────────────────────┼───────────────────────┼─────────────┼──────────────┼─────────────────────────────────────────────────┤
 * │ react          │ user_explicit_flag   │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ ctx.useReAct === true (user toggled)             │
 * │ react          │ user_explicit_flag   │ gemini / gemini-flash  │ day         │ ✅ Fallback  │ useReAct AND sglang unreachable                  │
 * ├────────────────┼──────────────────────┼───────────────────────┼─────────────┼──────────────┼─────────────────────────────────────────────────┤
 * │ tutor          │ session_flag         │ sglang_tutor / 7B-AWQ │ day         │ ✅ Active    │ ctx.tutorMode === true (NO semantic routing!)    │
 * │ tutor          │ session_flag         │ gemini / gemini-flash  │ day         │ ✅ Fallback  │ tutorMode + sglang unreachable                   │
 * │                │                      │                       │             │              │ NOTE: Session flags checked BEFORE semantic      │
 * ├────────────────┼──────────────────────┼───────────────────────┼─────────────┼──────────────┼─────────────────────────────────────────────────┤
 * │ quiz           │ session_flag         │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ ctx.isQuizMode === true                          │
 * │ code           │ session_flag/intent  │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ code intent detected                             │
 * │ research       │ session_flag/intent  │ sglang_chat / 7B-AWQ  │ day         │ ✅ Active    │ deep research intent detected                    │
 * ├────────────────┼──────────────────────┼───────────────────────┼─────────────┼──────────────┼─────────────────────────────────────────────────┤
 * │ night_stn      │ cron_or_admin_cli    │ sglang_heavy / 7B-AWQ │ night       │ ✅ Active    │ offline_ingest.py --course or cron 2AM          │
 * │ night_stn      │ cron_or_admin_cli    │ gemini / gemini-flash  │ night       │ ✅ Fallback  │ sglang unreachable                               │
 * │ night_kg       │ cron_2am             │ sglang_heavy / 7B-AWQ │ night       │ ✅ Active    │ nightlySessionEvaluator.js cron                  │
 * │ night_kg       │ cron_2am             │ gemini / gemini-flash  │ night       │ ✅ Fallback  │ sglang unreachable                               │
 * └────────────────┴──────────────────────┴───────────────────────┴─────────────┴──────────────┴─────────────────────────────────────────────────┘
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: THRESHOLDS & CONFIGURATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ROUTING_THRESHOLDS = {
    // ── Semantic routing (cosine similarity) ──────────────────────────────────
    SEMANTIC_DIRECT_ANSWER:   0.75,  // > this → direct_answer (skip all orchestrators)
    SEMANTIC_TOT:             0.75,  // > this (AND score > TOT_COMPLEXITY) → ToT
    SEMANTIC_STANDARD:        0.65,  // > this → standard agentic path
    SEMANTIC_FALLBACK:        0.65,  // < this → fall through to keyword classifier

    // ── Keyword fallback ──────────────────────────────────────────────────────
    KEYWORD_CONFIDENT:        0.65,  // > this → skip 2B LLM router

    // ── Complexity score (calculateComplexityScore in smartModelRouterService) ─
    TOT_MIN_COMPLEXITY:           85,  // ToT auto-activation gate (system-decided)
    TOT_USER_EXPLICIT_MIN_COMPLEXITY: 40,  // When user explicitly enables ToT, lower gate (Issue 1.2)
    STANDARD_MIN_COMPLEXITY:  0,     // standard path always available

    // ── Cache TTLs (seconds) ──────────────────────────────────────────────────
    CLASSIFICATION_CACHE_TTL: 300,   // 5 minutes — intent cache (Redis)
    ROUTING_CACHE_TTL:        300,   // 5 minutes — model routing cache (Redis)
    EMBEDDING_CACHE_TTL:      600,   // 10 minutes — query embedding cache (Redis)

    // ── Direct answer max length ──────────────────────────────────────────────
    DIRECT_ANSWER_MAX_TOKENS: 512,   // Direct answers are short by definition

    // ── Python /embed timeout ─────────────────────────────────────────────────
    EMBED_REQUEST_TIMEOUT_MS: 5000,  // 5s max for embedding request

    // ── GraphRAG timeout (parallel with Qdrant) ──────────────────────────────
    GRAPHRAG_TIMEOUT_MS:      200,   // Graceful degrade if Neo4j takes > 200ms
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: DECISION WATERFALL (EXECUTABLE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ordered decision waterfall for live chat routing.
 * Each step returns null to pass to the next, or a result object to short-circuit.
 *
 * This is the definitive execution order. llmRouterService.js implements this.
 */
const DECISION_WATERFALL = [
    {
        step:        0,
        name:        DECISION_METHODS.SESSION_FLAG,
        description: 'Session-level mode flags (tutor/quiz/code/research) take absolute priority',
        runsInMs:    '~0ms',
        shortCircuit: true,
    },
    {
        step:        1,
        name:        DECISION_METHODS.REDIS_CACHE,
        description: 'Redis cache hit on query hash+userId+mode (5min TTL) — skip ALL classification',
        runsInMs:    '~1ms',
        shortCircuit: true,
    },
    {
        step:        2,
        name:        DECISION_METHODS.MANUAL_MODEL,
        description: 'User explicitly selected a model in UI — respect their choice',
        runsInMs:    '~0ms',
        shortCircuit: true,
    },
    {
        step:        3,
        name:        DECISION_METHODS.SEMANTIC_EMBEDDING,
        description: 'POST /embed to Python service → cosine similarity vs pre-embedded prototypes. ' +
                     'Reuses query embedding already computed for Qdrant — ~0ms extra embedding cost. ' +
                     'Returns {route, confidence}. Confidence > threshold → short-circuit.',
        runsInMs:    '~5-10ms (embed) + ~1ms (cosine)',
        shortCircuit: true,
        confidenceThreshold: ROUTING_THRESHOLDS.SEMANTIC_FALLBACK,
    },
    {
        step:        4,
        name:        DECISION_METHODS.KEYWORD_FALLBACK,
        description: 'Deterministic keyword matching. Fast, brittle on paraphrasing. ' +
                     'Only runs if semantic confidence < 0.65.',
        runsInMs:    '~0.1ms',
        shortCircuit: true,
        confidenceThreshold: ROUTING_THRESHOLDS.KEYWORD_CONFIDENT,
    },
    {
        step:        5,
        name:        DECISION_METHODS.LLM_2B_ROUTER,
        description: 'LAST RESORT: qwen3.5:2b LLM call for classification. ' +
                     '100-500ms penalty. Only fires when both semantic AND keyword confidence < 0.65. ' +
                     'Expected hit rate: < 5% of queries.',
        runsInMs:    '~100-500ms',
        shortCircuit: true,
        note: 'Minimize hit rate of this step — expand prototype library to avoid LLM routing.',
    },
    {
        step:        6,
        name:        DECISION_METHODS.SMART_MODEL_ROUTER,
        description: 'selectModel() from smartModelRouterService. Selects best model based on ' +
                     'complexity score, reasoning mode, VRAM, user preference.',
        runsInMs:    '~2ms',
        shortCircuit: false,
    },
    {
        step:        7,
        name:        DECISION_METHODS.COURSE_ADAPTER,
        description: 'Course-specific fine-tuned adapter from CourseAdapterMapping collection.',
        runsInMs:    '~5ms (DB)',
        shortCircuit: true,
    },
    {
        step:        8,
        name:        DECISION_METHODS.SUBJECT_FINETUNED,
        description: 'Subject-specific fine-tuned model from LLMConfiguration collection.',
        runsInMs:    '~5ms (DB)',
        shortCircuit: true,
    },
    {
        step:        9,
        name:        DECISION_METHODS.PROVIDER_DEFAULT,
        description: 'Default model in preferred provider → any model in provider → next provider.',
        runsInMs:    '~1ms',
        shortCircuit: true,
    },
    {
        step:        10,
        name:        DECISION_METHODS.HARDCODED_ENV,
        description: 'Absolute last resort: OLLAMA_DEFAULT_MODEL or GEMINI_MODEL from env vars.',
        runsInMs:    '~0ms',
        shortCircuit: true,
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: ROUTE → ORCHESTRATOR MAPPING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For each route, defines which orchestrator runs and what the execution constraints are.
 *
 * ┌────────────────┬─────────────────────────────────────────────┬──────────────────────────────────────────┐
 * │ Route          │ Orchestrator                                │ Constraints                              │
 * ├────────────────┼─────────────────────────────────────────────┼──────────────────────────────────────────┤
 * │ direct_answer  │ None — single LLM chat completion           │ maxTokens=512, no RAG, no tools          │
 * │ standard       │ agentService.processAgenticRequest()        │ RAG enabled, tools enabled               │
 * │ tot            │ totOrchestrator.processQueryWithToT_*()     │ score > 85 AND user-explicit REQUIRED     │
 * │ react          │ toolReactOrchestrator.processQueryWithReAct │ user-explicit REQUIRED                   │
 * │ tutor          │ socraticTutorService                        │ session state required                   │
 * │ quiz           │ quizHandler                                 │ session state required                   │
 * │ code           │ codeHandler                                 │ sandboxed execution                      │
 * │ research       │ deepResearch                                │ academic_search + multi-source           │
 * │ night_stn      │ subtopicNotesGenerator (offline)            │ NIGHT SHIFT ONLY — SGLang 35B              │
 * │ night_kg       │ kgExtractionService + sessionAnalysis       │ NIGHT SHIFT ONLY — SGLang 35B              │
 * └────────────────┴─────────────────────────────────────────────┴──────────────────────────────────────────┘
 */
const ROUTE_ORCHESTRATORS = {
    [ROUTES.DIRECT_ANSWER]: {
        handler:     null, // single-pass LLM call, no service
        maxTokens:   ROUTING_THRESHOLDS.DIRECT_ANSWER_MAX_TOKENS,
        ragEnabled:  false,
        toolsEnabled: false,
        streamingSSE: false,
        shift:       'day',
    },
    [ROUTES.STANDARD]: {
        handler:     'agentService.processAgenticRequest',
        maxTokens:   800,  // was 4096 — capped for 11 tok/s GPU (800 tok ≈ 70s)
        ragEnabled:  true,
        toolsEnabled: true,
        streamingSSE: false,
        shift:       'day',
    },
    [ROUTES.TOT]: {
        handler:     'totOrchestrator.processQueryWithToT_Streaming',
        maxTokens:   2048, // was 8192
        ragEnabled:  true,
        toolsEnabled: true,
        streamingSSE: true,
        complexityGate: ROUTING_THRESHOLDS.TOT_MIN_COMPLEXITY,
        requiresUserExplicit: true, // THINKING ICON must be activated by user
        shift:       'day',
        note:        'ToT only active when user explicitly enables Thinking mode in UI',
    },
    [ROUTES.REACT]: {
        handler:     'toolReactOrchestrator.processQueryWithReAct',
        maxTokens:   2048, // was 8192
        ragEnabled:  true,
        toolsEnabled: true,
        streamingSSE: true,
        requiresUserExplicit: true, // useReAct flag
        shift:       'day',
    },
    [ROUTES.WEB_SEARCH]: {
        handler:     'webSearchHandler',
        maxTokens:   800,  // was 4096
        ragEnabled:  false,
        toolsEnabled: true, // web_search tool
        streamingSSE: false,
        shift:       'day',
        semanticThreshold: 0.70, // slightly lower than standard for web search intent
    },
    [ROUTES.TUTOR]: {
        handler:     'tutorHandler',
        maxTokens:   600,  // was 4096 — Socratic responses should be concise
        ragEnabled:  true,
        toolsEnabled: false,
        streamingSSE: false,
        requiresSessionFlag: 'tutorMode',
        shift:       'day',
    },
    [ROUTES.QUIZ]: {
        handler:     'quizHandler',
        maxTokens:   800,  // was 4096
        ragEnabled:  false,
        toolsEnabled: false,
        streamingSSE: false,
        requiresSessionFlag: 'isQuizMode',
        shift:       'day',
    },
    [ROUTES.CODE]: {
        handler:     'codeHandler',
        maxTokens:   8192,
        ragEnabled:  false,
        toolsEnabled: true, // sandboxed exec
        streamingSSE: false,
        shift:       'day',
    },
    [ROUTES.RESEARCH]: {
        handler:     'researchHandler',
        maxTokens:   16384,
        ragEnabled:  true,
        toolsEnabled: true, // academic_search
        streamingSSE: false,
        shift:       'day',
    },
    [ROUTES.NIGHT_STN]: {
        handler:     'offline_ingest.py (CLI/cron)',
        maxTokens:   16384,
        ragEnabled:  true,
        toolsEnabled: false,
        streamingSSE: false,
        shift:       'night',
        allowedProviders: ['sglang_heavy', 'gemini'], // sglang_heavy preferred, gemini fallback
    },
    [ROUTES.NIGHT_KG]: {
        handler:     'nightlySessionEvaluator.js (cron 2AM)',
        maxTokens:   8192,
        ragEnabled:  false,
        toolsEnabled: false,
        streamingSSE: false,
        shift:       'night',
        allowedProviders: ['sglang_heavy', 'gemini'], // sglang_heavy preferred, gemini fallback
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: SEMANTIC ROUTING PROTOTYPE CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route categories used for embedding-based prototype matching.
 * Each prototype set is embedded once at startup and stored in memory.
 * Pre-embedded vectors are persisted to server/data/routing_prototypes.json.
 */
const SEMANTIC_ROUTE_CATEGORIES = [
    {
        route:       ROUTES.DIRECT_ANSWER,
        description: 'Simple greetings, short factual lookups, one-sentence definitions',
        minSentences: 15,
        maxWords:    10, // heuristic: very short queries are almost always direct
    },
    {
        route:       ROUTES.STANDARD,
        description: 'Explanations, how-things-work questions, technical concepts that need context',
        minSentences: 20,
    },
    {
        route:       ROUTES.WEB_SEARCH,
        description: 'Current events, latest news, real-time data, recent developments, today\'s information',
        minSentences: 15,
        keywords:    ['current', 'latest', 'news', 'today', 'recent', '2026', 'now', 'breaking'],
    },
    {
        route:       ROUTES.TOT,
        description: 'Deep multi-perspective analysis, design trade-offs, ethical reasoning, architecture decisions',
        minSentences: 15,
        requiresComplexityGate: true, // cosine alone is not enough — score > 85 also required
        requiresUserExplicit: true,    // Thinking icon must be activated
    },
];

module.exports = {
    ROUTES,
    DECISION_METHODS,
    PROVIDERS,
    ROUTING_THRESHOLDS,
    DECISION_WATERFALL,
    ROUTE_ORCHESTRATORS,
    SEMANTIC_ROUTE_CATEGORIES,
};
