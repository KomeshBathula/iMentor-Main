// server/routes/deepResearch.js
// Express route for the deep research orchestrator.
// Exposes research functionality via REST API.
// Protected by authMiddleware (mounted in server.js).

const express = require('express');
const router = express.Router();
const deepResearchOrchestrator = require('../services/deepResearchOrchestrator');
const factCheckingService = require('../services/factCheckingService');
const ResearchCache = require('../models/ResearchCache');

/**
 * POST /api/deep-research/search
 * Basic deep research endpoint (Task 1.3.1).
 * Body: { query, depthLevel?, conversationHistory? }
 */
router.post('/search', async (req, res) => {
    const { query, depthLevel, conversationHistory } = req.body;
    const userId = req.user?._id || req.user?.userId;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
        return res.status(400).json({
            success: false,
            message: 'A research query of at least 3 characters is required.',
        });
    }

    try {
        console.log(`[DeepResearch Route] Research request from user ${userId}: "${query.substring(0, 80)}..."`);

        const result = await deepResearchOrchestrator.runDeepResearch(query.trim(), {
            userId,
            depthOverride: depthLevel,
            conversationHistory,
        });

        const bundle = result.researchBundle || {};
        const report = result.researchReport || {};
        return res.status(200).json({
            success: true,
            data: {
                synthesizedResult: report.executiveSummary?.analyticalOverview || report.title || 'Research complete.',
                sources: bundle.sources || [],
                sourceBreakdown: {
                    total: bundle.sources?.length || 0,
                    local: bundle.localSourceCount || 0,
                    online: bundle.onlineSourceCount || 0,
                },
                metadata: {
                    query: bundle.query,
                    mode: bundle.mode,
                    confidenceScore: bundle.overallConfidenceScore,
                },
            },
        });
    } catch (error) {
        console.error('[DeepResearch Route] Research failed:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Deep research encountered an error.',
            error: error.message,
        });
    }
});

/**
 * POST /api/deep-research/report
 * Enhanced research with full report generation (Task 1.3.2).
 * Returns: synthesis, citation graph, contradictions, fact-check, markdown report.
 * Body: { query, depthLevel?, reportStyle?, includeFactCheck?, conversationHistory? }
 */
router.post('/report', async (req, res) => {
    const { query, depthLevel, reportStyle, includeFactCheck, conversationHistory } = req.body;
    const userId = req.user?._id || req.user?.userId;

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
        return res.status(400).json({
            success: false,
            message: 'A research query of at least 3 characters is required.',
        });
    }

    try {
        console.log(`[DeepResearch Route] Enhanced report request from user ${userId}: "${query.substring(0, 80)}..."`);

        const result = await deepResearchOrchestrator.runDeepResearch(query.trim(), {
            userId,
            depthOverride: depthLevel || 'deep',
            reportStyle: reportStyle || 'academic',
            includeFactCheck: includeFactCheck !== false,
            conversationHistory,
        });

        const bundle = result.researchBundle || {};
        const report = result.researchReport || {};
        return res.status(200).json({
            success: true,
            data: {
                synthesizedResult: report.executiveSummary?.analyticalOverview || report.title || 'Research complete.',
                report,
                factCheck: bundle.verifiedClaimsData || [],
                sources: bundle.sources || [],
                sourceBreakdown: {
                    total: bundle.sources?.length || 0,
                    local: bundle.localSourceCount || 0,
                    online: bundle.onlineSourceCount || 0,
                },
                metadata: {
                    query: bundle.query,
                    mode: bundle.mode,
                    confidenceScore: bundle.overallConfidenceScore,
                    depthLevel: options?.depthOverride || 'deep',
                },
            },
        });
    } catch (error) {
        console.error('[DeepResearch Route] Enhanced report failed:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Enhanced research report encountered an error.',
            error: error.message,
        });
    }
});

/**
 * POST /api/deep-research/fact-check
 * Standalone fact-check endpoint for any text against sources.
 * Body: { text, sources?, query? }
 */
router.post('/fact-check', async (req, res) => {
    const { text, sources, query } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
        return res.status(400).json({
            success: false,
            message: 'Text of at least 10 characters is required for fact-checking.',
        });
    }

    try {
        const start = Date.now();
        const sourcesInput = (sources && sources.length > 0)
            ? sources
            : [{ id: 1, citationIndex: 1, abstract: text.trim(), evidenceCategory: 'user-provided', sourceType: 'text' }];
        const userId = req.user?._id || req.user?.userId;
        const claims = await factCheckingService.verifyCorpusClaims(sourcesInput, query || 'General fact check', userId);
        const verifiedCount = claims.filter(c => c.strength_of_evidence === 'Strong').length;
        const flaggedCount = claims.filter(c => c.uncertainty_level === 'High').length;

        return res.status(200).json({
            success: true,
            data: {
                overallReliability: verifiedCount > flaggedCount ? 'High' : 'Moderate',
                summary: `Verified ${claims.length} claims from provided text.`,
                totalClaims: claims.length,
                verifiedCount,
                flaggedCount,
                claims,
                flaggedClaims: claims.filter(c => c.uncertainty_level === 'High'),
                checkDurationMs: Date.now() - start,
            },
        });
    } catch (error) {
        console.error('[DeepResearch Route] Fact-check failed:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Fact-checking encountered an error.',
            error: error.message,
        });
    }
});

/**
 * GET /api/deep-research/history
 * Get user's recent research history.
 */
router.get('/history', async (req, res) => {
    const userId = req.user?._id || req.user?.userId;

    try {
        const history = await ResearchCache.find({ userId })
            .select('query sourceBreakdown metadata createdAt')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        return res.status(200).json({
            success: true,
            data: history.map(h => ({
                query: h.query,
                sourceBreakdown: h.sourceBreakdown,
                depthLevel: h.metadata?.depthLevel || 'standard',
                createdAt: h.createdAt,
            })),
        });
    } catch (error) {
        console.error('[DeepResearch Route] History fetch failed:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to fetch research history.' });
    }
});

/**
 * GET /api/deep-research/cache/:queryHash
 * Retrieve a specific cached research result.
 */
router.get('/cache/:queryHash', async (req, res) => {
    const userId = req.user?._id || req.user?.userId;
    const { queryHash } = req.params;

    try {
        const cached = await ResearchCache.findOne({ queryHash, userId }).lean();
        if (!cached) {
            return res.status(404).json({ success: false, message: 'Research result not found in cache.' });
        }

        return res.status(200).json({
            success: true,
            data: {
                query: cached.query,
                synthesizedResult: cached.synthesizedResult,
                sources: cached.sources,
                sourceBreakdown: cached.sourceBreakdown,
                metadata: { ...cached.metadata, fromCache: true },
            },
        });
    } catch (error) {
        console.error('[DeepResearch Route] Cache retrieval failed:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to retrieve cached result.' });
    }
});

module.exports = router;
