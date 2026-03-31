// server/routes/chat/handlers/codeHandler.js
// Handles code-intent routing — redirects to code tools instead of chat reasoning.
const log = require('../../../utils/logger');
const { streamEvent } = require('../helpers');

/**
 * Returns true if this handler handled the request (and ended the response).
 * Returns false if the request should continue to the next handler.
 *
 * @param {object} res  - Express response
 * @param {object} ctx  - Request context built by index.js
 */
async function handle(res, ctx) {
    const { queryIntent, tutorMode, capturePerformance } = ctx;

    if (queryIntent !== 'code' || tutorMode) return false;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const codeRoutingReply = {
        sender: 'bot',
        role: 'model',
        text: 'This looks like a code-focused request. I have routed it to the code tooling path. Use the Code Executor tools for execution/analysis while I keep this response path optimized for chat reasoning.',
        parts: [{ text: 'This looks like a code-focused request. I have routed it to the code tooling path. Use the Code Executor tools for execution/analysis while I keep this response path optimized for chat reasoning.' }],
        timestamp: new Date(),
        source_pipeline: 'intent-code-tools-route',
        action: { type: 'NAVIGATE', payload: { path: '/tools/code-executor', api: '/api/tools/execute' } },
        reasoningMeta: { branchCount: 1, reasoningDepth: 1, llmCallCount: 0, toolCalls: 0 }
    };

    capturePerformance({
        intent: queryIntent,
        reasoningDepth: 1,
        llmCallCount: 0,
        tokenUsageEstimate: 0,
        branchCount: 1,
        toolCalls: 0,
    });
    streamEvent(res, { type: 'final_answer', content: codeRoutingReply });
    res.end();
    return true;
}

module.exports = { handle };
