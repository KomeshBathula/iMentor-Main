// server/jobs/nightlySessionEvaluator.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Night-Shift Session Evaluator  (cron: 0 2 * * *  — runs at 2 AM)
// ─────────────────────────────────────────────────────────────────────────
// Performs ALL heavy post-session processing that was purged from live chat:
//   1. KG extraction   — extractAndStoreKgFromText() on recent AI messages
//   2. Cues generation — generateCues() on recent AI responses
//   3. Session analysis— triggerPeriodicAnalysis() for each session
//   4. XP re-evaluation— advancedXPEvaluator on the last message of each session
//
// This offloads ~4 LLM calls per chat turn onto the 2AM window, keeping
// live-chat latency sub-second for day-shift students.
//
// Design:
//   - Processes sessions with activity in the last 24 hours
//   - Batches in groups of 10 (configurable via NIGHTLY_BATCH_SIZE)
//   - Catches errors per-session — one failure never aborts the batch
//   - Logs [NIGHTLY] prefix for easy filtering in dashboards
//   - Respects NIGHTLY_EVALUATOR_ENABLED=false to disable without code change
// ═══════════════════════════════════════════════════════════════════════════

const cron     = require('node-cron');
const ChatHistory = require('../models/ChatHistory');
const log      = require('../utils/logger');
const { nightlyJobCounter } = require('../utils/metrics');

// Lazy-require heavy services (only loaded when job fires)
const getKgService    = () => require('../services/kgExtractionService');
const getCuesService  = () => require('../services/criticalThinkingService');
const getMemory       = () => require('../middleware/contextualMemoryMiddleware');
const getXpEval       = () => require('../services/advancedXPEvaluator');

const ENABLED      = process.env.NIGHTLY_EVALUATOR_ENABLED !== 'false'; // default ON
const BATCH_SIZE   = parseInt(process.env.NIGHTLY_BATCH_SIZE  || '10', 10);
const LOOKBACK_HRS = parseInt(process.env.NIGHTLY_LOOKBACK_HRS || '24', 10);

let _cronJob = null;

// ─── Per-session processor ────────────────────────────────────────────────

async function _processSession(session, llmConfig) {
    const { sessionId, userId, messages = [] } = session;
    const sessionTag = `[NIGHTLY] session=${sessionId} user=${userId}`;
    let kgCount = 0, cueCount = 0;

    try {
        // Grab only AI messages from this session
        const aiMessages = messages.filter(m =>
            (m.role === 'model' || m.sender === 'bot') && m.parts?.[0]?.text
        );

        if (!aiMessages.length) return;

        const { extractAndStoreKgFromText } = getKgService();
        const { generateCues }              = getCuesService();
        const { triggerPeriodicAnalysis }   = getMemory();

        // ── 1. KG extraction for each AI message ────────────────────────────
        for (const msg of aiMessages) {
            const text = msg.parts[0].text;
            try {
                await extractAndStoreKgFromText(text, sessionId, userId, llmConfig, null);
                kgCount++;
            } catch (e) {
                log.warn('NIGHTLY', `${sessionTag} KG extraction failed: ${e.message}`);
            }
        }

        // ── 2. Critical-thinking cues for the LAST AI message ───────────────
        const lastAiText = aiMessages[aiMessages.length - 1]?.parts?.[0]?.text;
        if (lastAiText) {
            try {
                await generateCues(lastAiText, llmConfig);
                cueCount++;
            } catch (e) {
                log.warn('NIGHTLY', `${sessionTag} generateCues failed: ${e.message}`);
            }
        }

        // ── 3. Session analysis (contextual memory update) ──────────────────
        try {
            const msgCount = messages.length;
            await triggerPeriodicAnalysis(sessionId, userId, msgCount, llmConfig);
        } catch (e) {
            log.warn('NIGHTLY', `${sessionTag} triggerPeriodicAnalysis failed: ${e.message}`);
        }

        // ── 4. Advanced XP evaluation for the last turn ─────────────────────
        if (aiMessages.length) {
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            const lastAiMsg   = aiMessages[aiMessages.length - 1];
            if (lastUserMsg && lastAiMsg) {
                try {
                    const advancedXPEvaluator = getXpEval();
                    await advancedXPEvaluator.evaluateMessageQuality(
                        lastUserMsg.parts?.[0]?.text || '',
                        lastAiMsg.parts[0].text,
                        { userId, topic: 'nightly_eval', userLevel: 1 }
                    );
                } catch (e) {
                    log.warn('NIGHTLY', `${sessionTag} XP eval failed: ${e.message}`);
                }
            }
        }

        log.info('NIGHTLY', `${sessionTag} — kg=${kgCount} cues=${cueCount} ✓`);

    } catch (err) {
        log.error('NIGHTLY', `${sessionTag} processing error: ${err.message}`);
    }
}

// ─── Main batch runner ────────────────────────────────────────────────────

async function runNightlyEvaluator() {
    if (!ENABLED) {
        log.info('NIGHTLY', 'NIGHTLY_EVALUATOR_ENABLED=false — skipping');
        return;
    }

    const jobStart = Date.now();
    log.info('NIGHTLY', `═══ Night-Shift Session Evaluator starting (lookback=${LOOKBACK_HRS}h, batch=${BATCH_SIZE}) ═══`);

    // Build default LLM config (heavy SGLang model when available, else Ollama fallback)
    const nightLlmConfig = {
        provider:    process.env.SGLANG_ENABLED === 'true' ? 'sglang' : (process.env.OLLAMA_DEFAULT_PROVIDER || 'ollama'),
        model:       process.env.SGLANG_ENABLED === 'true'
                         ? (process.env.SGLANG_HEAVY_MODEL || 'Qwen/Qwen2.5-32B-Instruct-AWQ')
                         : (process.env.OLLAMA_DEFAULT_MODEL || 'qwen3.5:9b'),
        temperature: 0.3,
        maxTokens:   2048,
        ollamaUrl:   process.env.OLLAMA_API_BASE_URL,
    };

    const since = new Date(Date.now() - LOOKBACK_HRS * 60 * 60 * 1000);

    let totalSessions = 0, processed = 0, errors = 0;

    try {
        // Stream sessions in batches to avoid loading all into memory
        const cursor = ChatHistory.find({ updatedAt: { $gte: since } })
            .select('sessionId userId messages')
            .lean()
            .cursor();

        let batch = [];

        for await (const session of cursor) {
            batch.push(session);
            totalSessions++;

            if (batch.length >= BATCH_SIZE) {
                const results = await Promise.allSettled(
                    batch.map(s => _processSession(s, nightLlmConfig))
                );
                results.forEach(r => {
                    if (r.status === 'fulfilled') { processed++; nightlyJobCounter.inc({ result: 'processed' }); }
                    else { errors++; nightlyJobCounter.inc({ result: 'error' }); }
                });
                batch = [];
            }
        }

        // Process leftover partial batch
        if (batch.length) {
            const results = await Promise.allSettled(
                batch.map(s => _processSession(s, nightLlmConfig))
            );
            results.forEach(r => {
                if (r.status === 'fulfilled') { processed++; nightlyJobCounter.inc({ result: 'processed' }); }
                else { errors++; nightlyJobCounter.inc({ result: 'error' }); }
            });
        }

    } catch (err) {
        log.error('NIGHTLY', `Batch cursor error: ${err.message}`);
    }

    const elapsed = Math.round((Date.now() - jobStart) / 1000);
    log.info('NIGHTLY',
        `═══ Night-Shift COMPLETE in ${elapsed}s — ` +
        `sessions=${totalSessions} processed=${processed} errors=${errors} ═══`
    );
}

// ─── Scheduler ────────────────────────────────────────────────────────────

function startNightlySessionEvaluator() {
    if (_cronJob) {
        log.warn('NIGHTLY', 'Nightly session evaluator already running');
        return;
    }

    // Run at 2:00 AM every day
    _cronJob = cron.schedule('0 2 * * *', () => {
        runNightlyEvaluator().catch(err =>
            log.error('NIGHTLY', `Unhandled error in nightly evaluator: ${err.message}`)
        );
    }, { timezone: process.env.CRON_TIMEZONE || 'Asia/Kolkata' });

    log.info('NIGHTLY', `Nightly session evaluator scheduled (cron: 0 2 * * *  — timezone: ${process.env.CRON_TIMEZONE || 'Asia/Kolkata'})`);
}

function stopNightlySessionEvaluator() {
    if (_cronJob) {
        _cronJob.stop();
        _cronJob = null;
        log.info('NIGHTLY', 'Nightly session evaluator stopped');
    }
}

module.exports = {
    startNightlySessionEvaluator,
    stopNightlySessionEvaluator,
    runNightlyEvaluator,   // exported for manual trigger / testing
};
