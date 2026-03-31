// server/jobs/spacedRepetitionScheduler.js
const cron = require('node-cron');
const StudentKnowledgeState = require('../models/StudentKnowledgeState');
const log = require('../utils/logger');

/**
 * Spaced Repetition Scheduler
 * Runs every 2 hours — finds mastered topics whose nextReviewDate has passed
 * and marks them for review (shouldReview = true).
 * 
 * Uses SM-2 style intervals: after each successful review, the nextReviewDate
 * is doubled (1d → 2d → 4d → 8d → 16d → 32d cap).
 * 
 * The tutor system can read `shouldReview` topics and prioritize them in
 * study plans or inject review prompts at the start of sessions.
 */

const MAX_REVIEW_INTERVAL_DAYS = 32;
const INITIAL_REVIEW_INTERVAL_DAYS = 1;

let cronJob = null;

function startSpacedRepetitionScheduler() {
    if (cronJob) {
        log.warn('SYSTEM', 'Spaced repetition scheduler already running');
        return;
    }

    // Run every 2 hours
    cronJob = cron.schedule('0 */2 * * *', async () => {
        log.info('SYSTEM', '📖 Starting spaced repetition review scan...');

        try {
            const now = new Date();

            // Find all students with mastered topics that are due for review
            const dueStudents = await StudentKnowledgeState.find({
                'masteredTopics.nextReviewDate': { $lte: now },
                'masteredTopics.shouldReview': { $ne: true }
            }).select('userId masteredTopics').limit(200);

            let totalFlagged = 0;

            for (const student of dueStudents) {
                let modified = false;

                for (const topic of student.masteredTopics) {
                    if (topic.nextReviewDate && topic.nextReviewDate <= now && !topic.shouldReview) {
                        topic.shouldReview = true;
                        modified = true;
                        totalFlagged++;
                    }
                }

                if (modified) {
                    await student.save();
                }
            }

            // Emit socket notifications for users with due reviews
            if (totalFlagged > 0) {
                try {
                    const { getIO } = require('../services/socketService');
                    const io = getIO();
                    if (io) {
                        for (const student of dueStudents) {
                            const dueTopics = student.masteredTopics
                                .filter(t => t.shouldReview)
                                .map(t => t.topic);

                            if (dueTopics.length > 0) {
                                io.to(`user:${student.userId}`).emit('review_due', {
                                    topics: dueTopics,
                                    count: dueTopics.length,
                                    message: `📖 ${dueTopics.length} topic${dueTopics.length > 1 ? 's' : ''} ready for review: ${dueTopics.slice(0, 3).join(', ')}${dueTopics.length > 3 ? '...' : ''}`
                                });
                            }
                        }
                    }
                } catch (socketErr) {
                    // Non-critical — socket may not be initialized
                }
            }

            log.info('SYSTEM', `📖 Spaced repetition scan complete: ${totalFlagged} topics flagged for review across ${dueStudents.length} students`);
        } catch (error) {
            log.error('SYSTEM', 'Spaced repetition scheduler error', error);
        }
    }, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });

    log.info('SYSTEM', '📖 Spaced repetition scheduler started: Every 2 hours');
}

/**
 * Mark a topic as successfully reviewed, calculate next review date using SM-2 intervals.
 * Call this when the student demonstrates mastery during a review session.
 * @param {string} userId 
 * @param {string} topicName 
 */
async function markTopicReviewed(userId, topicName) {
    try {
        const state = await StudentKnowledgeState.findOne({ userId });
        if (!state) return;

        const topic = state.masteredTopics.find(t => t.topic === topicName);
        if (!topic) return;

        // Calculate next interval: double the previous interval, capped at MAX
        const lastReviewDate = topic.nextReviewDate || topic.masteredAt || new Date();
        const masteredAt = topic.masteredAt || new Date();
        const daysSinceMastery = Math.max(1, Math.floor((lastReviewDate - masteredAt) / (1000 * 60 * 60 * 24)));
        const nextIntervalDays = Math.min(daysSinceMastery * 2, MAX_REVIEW_INTERVAL_DAYS);

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + nextIntervalDays);

        topic.shouldReview = false;
        topic.nextReviewDate = nextReview;

        await state.save();

        log.info('SYSTEM', `📖 Topic "${topicName}" reviewed for user ${userId}. Next review in ${nextIntervalDays} days.`);
        return { nextReviewDate: nextReview, intervalDays: nextIntervalDays };
    } catch (error) {
        log.error('SYSTEM', `Failed to mark topic reviewed: ${error.message}`);
        throw error;
    }
}

/**
 * Get all topics due for review for a user
 * @param {string} userId 
 * @returns {Array<{topic: string, nextReviewDate: Date, masteredAt: Date}>}
 */
async function getDueReviewTopics(userId) {
    try {
        const state = await StudentKnowledgeState.findOne({ userId })
            .select('masteredTopics');
        if (!state) return [];

        return state.masteredTopics
            .filter(t => t.shouldReview === true)
            .map(t => ({
                topic: t.topic,
                nextReviewDate: t.nextReviewDate,
                masteredAt: t.masteredAt
            }));
    } catch (error) {
        log.error('SYSTEM', `Failed to get due review topics: ${error.message}`);
        return [];
    }
}

function stopSpacedRepetitionScheduler() {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
        log.info('SYSTEM', '📖 Spaced repetition scheduler stopped');
    }
}

module.exports = {
    startSpacedRepetitionScheduler,
    stopSpacedRepetitionScheduler,
    markTopicReviewed,
    getDueReviewTopics
};
