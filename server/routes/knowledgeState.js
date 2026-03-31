// server/routes/knowledgeState.js
/**
 * Knowledge State Management Routes
 * Provides endpoints for viewing, managing, and controlling student memory/profile
 */

const express = require('express');
const router = express.Router();
const StudentKnowledgeState = require('../models/StudentKnowledgeState');
const knowledgeStateService = require('../services/knowledgeStateService');
const log = require('../utils/logger');
const { auditLog } = require('../utils/logger');

/**
 * GET /api/knowledge-state
 * Get the current user's knowledge state profile
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user._id;
        const knowledgeState = await knowledgeStateService.getOrCreateKnowledgeState(userId);

        // Generate a user-friendly summary
        const summary = knowledgeState.generateQuickSummary();

        res.status(200).json({
            profile: {
                learningStyle: knowledgeState.learningProfile.dominantLearningStyle,
                learningPace: knowledgeState.learningProfile.learningPace,
                preferredDepth: knowledgeState.learningProfile.preferredDepth,
                challengeResponse: knowledgeState.learningProfile.challengeResponse
            },
            summary,
            concepts: knowledgeState.concepts.map(c => ({
                name: c.conceptName,
                mastery: c.masteryScore,
                difficulty: c.difficulty,
                understandingLevel: c.understandingLevel,
                lastPracticed: c.lastInteractionDate,
                learningVelocity: c.learningVelocity
            })),
            sessionInsights: knowledgeState.sessionInsights || [],
            currentFocusAreas: knowledgeState.currentFocusAreas || [],
            recurringStruggles: knowledgeState.recurringStruggles || [],
            engagementMetrics: knowledgeState.engagementMetrics,
            lastUpdated: knowledgeState.lastUpdated
        });

        auditLog(req, 'KNOWLEDGE_STATE_VIEWED', { userId: userId.toString() });
    } catch (error) {
        log.error('DB', `Failed to fetch knowledge state: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve knowledge state' });
    }
});

/**
 * GET /api/knowledge-state/export
 * Export the user's complete knowledge state as JSON
 */
router.get('/export', async (req, res) => {
    try {
        const userId = req.user._id;
        const knowledgeState = await StudentKnowledgeState.findOne({ userId }).lean();

        if (!knowledgeState) {
            return res.status(404).json({ message: 'No knowledge state found' });
        }

        // Remove internal MongoDB fields
        delete knowledgeState._id;
        delete knowledgeState.__v;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="knowledge-state-${userId}-${Date.now()}.json"`);
        res.status(200).json(knowledgeState);

        auditLog(req, 'KNOWLEDGE_STATE_EXPORTED', { userId: userId.toString() });
    } catch (error) {
        log.error('DB', `Failed to export knowledge state: ${error.message}`);
        res.status(500).json({ message: 'Failed to export knowledge state' });
    }
});

/**
 * DELETE /api/knowledge-state/reset
 * Reset the user's knowledge state (privacy control)
 */
router.delete('/reset', async (req, res) => {
    try {
        const userId = req.user._id;
        const { confirmReset } = req.body;

        if (!confirmReset) {
            return res.status(400).json({
                message: 'Reset confirmation required. Send { "confirmReset": true } to proceed.'
            });
        }

        // Delete existing knowledge state
        await StudentKnowledgeState.deleteOne({ userId });

        // Create a fresh knowledge state
        const newKnowledgeState = await knowledgeStateService.getOrCreateKnowledgeState(userId);

        log.info('DB', `User ${userId} reset knowledge state`);
        auditLog(req, 'KNOWLEDGE_STATE_RESET', { userId: userId.toString() });

        res.status(200).json({
            message: 'Knowledge state reset successfully',
            newState: {
                totalConcepts: 0,
                totalSessions: 0,
                createdAt: newKnowledgeState.createdAt
            }
        });
    } catch (error) {
        log.error('DB', `Failed to reset knowledge state: ${error.message}`);
        res.status(500).json({ message: 'Failed to reset knowledge state' });
    }
});

/**
 * PATCH /api/knowledge-state/opt-out
 * Opt out of contextual memory (privacy control)
 */
router.patch('/opt-out', async (req, res) => {
    try {
        const userId = req.user._id;
        const { optOut } = req.body;

        const knowledgeState = await knowledgeStateService.getOrCreateKnowledgeState(userId);

        // Add opt-out flag to the schema
        knowledgeState.memoryOptOut = optOut === true;
        await knowledgeState.save();

        // Invalidate the Redis cache so the new preference takes effect immediately
        // (contextualMemoryMiddleware caches this key at TTL=3600s)
        try {
            const { redisClient } = require('../config/redisClient');
            if (redisClient?.isOpen) {
                await redisClient.del(`memory:optout:${userId}`).catch(() => {});
            }
        } catch (_) {}

        log.info('DB', `User ${userId} ${optOut ? 'opted out of' : 'opted into'} context memory`);
        auditLog(req, 'KNOWLEDGE_STATE_OPT_OUT_CHANGED', {
            userId: userId.toString(),
            optOut
        });

        res.status(200).json({
            message: optOut
                ? 'You have opted out of contextual memory. The tutor will not remember your learning history.'
                : 'You have opted into contextual memory. The tutor will remember your learning history.',
            optOut
        });
    } catch (error) {
        log.error('DB', `Failed to update opt-out preference: ${error.message}`);
        res.status(500).json({ message: 'Failed to update memory preference' });
    }
});

/**
 * GET /api/knowledge-state/struggling
 * Get concepts the user is currently struggling with
 */
router.get('/struggling', async (req, res) => {
    try {
        const userId = req.user._id;
        const strugglingTopics = await knowledgeStateService.getStrugglingTopics(userId);

        res.status(200).json({
            count: strugglingTopics.length,
            topics: strugglingTopics.map(c => ({
                name: c.conceptName,
                mastery: c.masteryScore,
                difficulty: c.difficulty,
                misconceptions: c.misconceptions.filter(m => m.stillPresent).map(m => m.description),
                weaknesses: c.weaknesses.map(w => w.aspect)
            }))
        });
    } catch (error) {
        log.error('DB', `Failed to fetch struggling topics: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve struggling topics' });
    }
});

/**
 * GET /api/knowledge-state/mastered
 * Get concepts the user has mastered
 */
router.get('/mastered', async (req, res) => {
    try {
        const userId = req.user._id;
        const knowledgeState = await StudentKnowledgeState.findOne({ userId });

        if (!knowledgeState) {
            return res.status(200).json({ count: 0, topics: [] });
        }

        const masteredConcepts = knowledgeState.getMasteredConcepts();

        res.status(200).json({
            count: masteredConcepts.length,
            topics: masteredConcepts.map(c => ({
                name: c.conceptName,
                mastery: c.masteryScore,
                masteredAt: c.lastInteractionDate,
                strengths: c.strengths.map(s => s.aspect)
            }))
        });
    } catch (error) {
        log.error('DB', `Failed to fetch mastered topics: ${error.message}`);
        res.status(500).json({ message: 'Failed to retrieve mastered topics' });
    }
});

/**
 * GET /api/knowledge-state/health-check
 * Validate knowledge state integrity
 */
router.get('/health-check', async (req, res) => {
    try {
        const userId = req.user._id;
        const knowledgeState = await StudentKnowledgeState.findOne({ userId });

        if (!knowledgeState) {
            return res.status(200).json({
                status: 'healthy',
                message: 'No knowledge state yet (new user)'
            });
        }

        const issues = [];

        // Check for contradictory states
        knowledgeState.concepts.forEach(c => {
            if (c.understandingLevel === 'mastered' && c.difficulty === 'high') {
                issues.push(`Contradiction: ${c.conceptName} is mastered but has high difficulty`);
            }
            if (c.masteryScore > 80 && c.difficulty === 'high') {
                issues.push(`Contradiction: ${c.conceptName} has high mastery (${c.masteryScore}) but high difficulty`);
            }
            if (c.masteryScore < 0 || c.masteryScore > 100) {
                issues.push(`Invalid mastery score: ${c.conceptName} has mastery ${c.masteryScore}`);
            }
        });

        res.status(200).json({
            status: issues.length === 0 ? 'healthy' : 'issues_detected',
            totalConcepts: knowledgeState.concepts.length,
            issues,
            lastUpdated: knowledgeState.lastUpdated
        });
    } catch (error) {
        log.error('DB', `Failed to check knowledge state health: ${error.message}`);
        res.status(500).json({ message: 'Failed to check knowledge state health' });
    }
});

module.exports = router;
