// server/routes/analytics.js
// ──────────────────────────────────────────────────────────────────────────────
// All analytics routes now use MongoDB as the PRIMARY data source.
// Elasticsearch (via filebeat) is attempted first where it adds value;
// if unavailable or empty, the route falls back to MongoDB aggregations
// so the dashboard always shows meaningful data.
// ──────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const log     = require('../utils/logger');

const esClient          = require('../config/elasticsearchClient');
const User              = require('../models/User');
const ChatHistory       = require('../models/ChatHistory');
const KnowledgeSource   = require('../models/KnowledgeSource');
const LLMPerformanceLog = require('../models/LLMPerformanceLog');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Quick check: does ES have any filebeat data at all? Cached per-process. */
let _esHasData = null;
async function esHasData() {
    if (_esHasData !== null) return _esHasData;
    if (!esClient) { _esHasData = false; return false; }
    try {
        const resp = await esClient.count({ index: 'filebeat-*' });
        _esHasData = resp.count > 0;
    } catch {
        _esHasData = false;
    }
    // Re-check every 5 minutes
    setTimeout(() => { _esHasData = null; }, 5 * 60 * 1000);
    return _esHasData;
}

// ── KPI Routes ───────────────────────────────────────────────────────────────

// Total user queries (messages with role 'user')
router.get('/total-queries', async (req, res) => {
    try {
        // Try ES first
        if (await esHasData()) {
            try {
                const esResp = await esClient.count({
                    index: 'filebeat-*',
                    body: { query: { match_phrase: { message: 'User Event: CHAT_MESSAGE_SENT' } } }
                });
                if (esResp.count > 0) return res.json({ count: esResp.count });
            } catch { /* fall through to MongoDB */ }
        }

        // MongoDB fallback: count all user messages
        const result = await ChatHistory.aggregate([
            { $match: { 'messages.0': { $exists: true } } },
            { $project: { userMsgCount: {
                $size: { $filter: { input: '$messages', as: 'm', cond: { $eq: ['$$m.role', 'user'] } } }
            }}},
            { $group: { _id: null, total: { $sum: '$userMsgCount' } } }
        ]);
        res.json({ count: result[0]?.total || 0 });
    } catch (error) {
        log.error('SYSTEM', `Total queries analytics failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve total query analytics.' });
    }
});

// Active users in the last 24 hours
router.get('/active-users-today', async (req, res) => {
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeUserIds = await ChatHistory.distinct('userId', { updatedAt: { $gte: yesterday } });
        res.json({ title: 'Active Users (Today)', count: activeUserIds.length });
    } catch (error) {
        log.error('SYSTEM', `Active users analytics failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve active users analytics.' });
    }
});

// Total knowledge sources ingested
router.get('/total-sources', async (req, res) => {
    try {
        const count = await KnowledgeSource.countDocuments();
        res.json({ count });
    } catch (error) {
        log.error('SYSTEM', `Total sources query failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve total sources.' });
    }
});

// ── User Engagement (MongoDB) ────────────────────────────────────────────────

router.get('/user-engagement', async (req, res) => {
    try {
        const sevenDaysAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [totalUsers, newSignupsLast7Days, dailySignupsResponse] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
            User.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { date: '$_id', count: 1, _id: 0 } }
            ])
        ]);
        res.json({ totalUsers, newSignupsLast7Days, dailySignupsLast30Days: dailySignupsResponse });
    } catch (error) {
        log.error('SYSTEM', `User engagement fetch failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve user engagement.' });
    }
});

// ── Feature Usage (MongoDB-primary) ──────────────────────────────────────────

router.get('/feature-usage', async (req, res) => {
    try {
        // Aggregate feature usage from ChatHistory source_pipeline field
        const [pipelineCounts, tutorSessionCount] = await Promise.all([
            ChatHistory.aggregate([
                { $unwind: '$messages' },
                { $match: { 'messages.role': 'model', 'messages.source_pipeline': { $ne: '' } } },
                { $group: { _id: '$messages.source_pipeline', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            ChatHistory.countDocuments({ isTutorMode: true })
        ]);

        // Categorise source_pipelines into user-friendly feature names
        const featureMap = {};
        for (const entry of pipelineCounts) {
            const p = entry._id || '';
            let feature = null;

            if (p.startsWith('tutor-'))                         feature = 'Tutor Mode (Socratic)';
            else if (p.includes('rag_search'))                  feature = 'RAG Search';
            else if (p.includes('web_search'))                  feature = 'Web Search';
            else if (p.includes('academic_search'))             feature = 'Academic Search';
            else if (p.includes('code'))                        feature = 'Code Executor';
            else if (p.includes('direct-bypass'))               feature = 'Direct LLM Response';
            else if (p.includes('error'))                       feature = 'Error Recovery';
            else                                                feature = p.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            featureMap[feature] = (featureMap[feature] || 0) + entry.count;
        }

        // Ensure Tutor Mode always appears (from isTutorMode flag, which is more accurate)
        if (tutorSessionCount > 0) {
            featureMap['Tutor Mode (Socratic)'] = Math.max(featureMap['Tutor Mode (Socratic)'] || 0, tutorSessionCount);
        }

        const finalData = Object.entries(featureMap)
            .map(([feature, count]) => ({ feature, count }))
            .sort((a, b) => b.count - a.count);

        res.json(finalData);
    } catch (error) {
        log.error('SYSTEM', `Feature usage analytics failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve feature usage analytics.' });
    }
});

// ── Content / Document Insights (MongoDB) ────────────────────────────────────

router.get('/content-insights', async (req, res) => {
    try {
        // Group chats by courseName to show which courses get the most engagement
        const courseDistribution = await ChatHistory.aggregate([
            { $match: { courseName: { $ne: null }, 'messages.0': { $exists: true } } },
            { $group: {
                _id: '$courseName',
                count: { $sum: 1 },
                totalMessages: { $sum: { $size: '$messages' } }
            }},
            { $sort: { totalMessages: -1 } },
            { $limit: 20 },
            { $project: { documentName: '$_id', count: '$totalMessages', sessions: '$count', _id: 0 } }
        ]);

        // Also include reference/source breakdown from model messages
        const sourcePipelineInsights = await ChatHistory.aggregate([
            { $unwind: '$messages' },
            { $match: { 'messages.role': 'model', 'messages.references.0': { $exists: true } } },
            { $unwind: '$messages.references' },
            { $group: { _id: '$messages.references.source', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { documentName: '$_id', count: 1, _id: 0 } }
        ]);

        // Combine: course distribution first, then referenced sources
        const combined = [...courseDistribution];
        for (const src of sourcePipelineInsights) {
            if (src.documentName && !combined.find(c => c.documentName === src.documentName)) {
                combined.push(src);
            }
        }

        res.json(combined);
    } catch (error) {
        log.error('SYSTEM', `Content insights analytics failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve content insights.' });
    }
});

// ── LLM Usage (MongoDB from LLMPerformanceLog + ChatHistory) ─────────────────

router.get('/llm-usage', async (req, res) => {
    try {
        const modelDistribution = await LLMPerformanceLog.aggregate([
            { $group: { _id: '$chosenModelId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $project: { provider: '$_id', count: 1, _id: 0 } }
        ]);

        // If LLMPerformanceLog is empty, fall back to source_pipeline from ChatHistory
        if (modelDistribution.length === 0) {
            const pipelineFallback = await ChatHistory.aggregate([
                { $unwind: '$messages' },
                { $match: { 'messages.role': 'model', 'messages.source_pipeline': { $ne: '' } } },
                { $group: {
                    _id: {
                        $switch: {
                            branches: [
                                { case: { $regexMatch: { input: '$messages.source_pipeline', regex: /^sglang/ } }, then: 'SGLang' },
                                { case: { $regexMatch: { input: '$messages.source_pipeline', regex: /^tutor/ } },  then: 'SGLang (Tutor)' },
                                { case: { $regexMatch: { input: '$messages.source_pipeline', regex: /^gemini/ } }, then: 'Gemini' },
                                { case: { $regexMatch: { input: '$messages.source_pipeline', regex: /^groq/ } },   then: 'Groq' },
                            ],
                            default: '$messages.source_pipeline'
                        }
                    },
                    count: { $sum: 1 }
                }},
                { $sort: { count: -1 } },
                { $project: { provider: '$_id', count: 1, _id: 0 } }
            ]);
            return res.json(pipelineFallback);
        }

        res.json(modelDistribution);
    } catch (error) {
        log.error('SYSTEM', `LLM usage analytics failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve LLM usage analytics.' });
    }
});

// ── Generation Counts ────────────────────────────────────────────────────────
// Count PPTX/DOCX exports. Try ES first, fall back to Job model or 0.

const Job = (() => {
    try { return require('../models/Job'); } catch { return null; }
})();

router.get('/pptx-generated-count', async (req, res) => {
    try {
        if (await esHasData()) {
            try {
                const esResp = await esClient.count({
                    index: 'filebeat-*',
                    body: { query: { query_string: { query: 'message:*CONTENT_GENERATION* AND payload:*pptx*' } } }
                });
                if (esResp.count > 0) return res.json({ count: esResp.count });
            } catch { /* fall through */ }
        }
        const count = Job ? await Job.countDocuments({ type: /pptx/i, status: 'completed' }).catch(() => 0) : 0;
        res.json({ count });
    } catch (error) {
        log.error('SYSTEM', `PPTX count analytics failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve PPTX generation analytics.' });
    }
});

router.get('/docx-generated-count', async (req, res) => {
    try {
        if (await esHasData()) {
            try {
                const esResp = await esClient.count({
                    index: 'filebeat-*',
                    body: { query: { query_string: { query: 'message:*CONTENT_GENERATION* AND payload:*docx*' } } }
                });
                if (esResp.count > 0) return res.json({ count: esResp.count });
            } catch { /* fall through */ }
        }
        const count = Job ? await Job.countDocuments({ type: /docx/i, status: 'completed' }).catch(() => 0) : 0;
        res.json({ count });
    } catch (error) {
        log.error('SYSTEM', `DOCX count analytics failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve DOCX generation analytics.' });
    }
});

// ── Tutor Mode Analytics (MongoDB) ───────────────────────────────────────────

router.get('/tutor-mode-stats', async (req, res) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [totalTutorModeSessions, dailyUsageResponse] = await Promise.all([
            ChatHistory.countDocuments({ isTutorMode: true }),
            ChatHistory.aggregate([
                { $match: { isTutorMode: true, createdAt: { $gte: thirtyDaysAgo } } },
                { $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }},
                { $sort: { _id: 1 } },
                { $project: { date: '$_id', count: 1, _id: 0 } }
            ])
        ]);

        res.json({
            totalTutorModeSessions,
            dailyUsageLast30Days: dailyUsageResponse
        });
    } catch (error) {
        log.error('SYSTEM', `Tutor mode stats failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve tutor mode analytics.' });
    }
});

// ── Code Executor Usage (MongoDB) ────────────────────────────────────────────

router.get('/code-executor-usage', async (req, res) => {
    try {
        const result = await ChatHistory.aggregate([
            { $unwind: '$messages' },
            { $match: {
                'messages.role': 'model',
                'messages.source_pipeline': { $regex: /code/i }
            }},
            { $count: 'total' }
        ]);
        res.json({ count: result[0]?.total || 0 });
    } catch (error) {
        log.error('SYSTEM', `Code executor usage analytics failed: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve code executor usage analytics.' });
    }
});

module.exports = router;