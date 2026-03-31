    // server/jobs/bossBattleGenerator.js
const cron = require('node-cron');
const GamificationProfile = require('../models/GamificationProfile');
const bossBattleService = require('../services/bossBattleService');
const log = require('../utils/logger');

/**
 * Cron job to generate boss battles for active users
 * Runs every 4 hours
 * Analyzes weak topics and creates personalized battles
 */

let cronJob = null;

const startBossBattleGenerator = () => {
    if (cronJob) {
        log.warn('SYSTEM', 'Boss battle cron already running');
        return;
    }

    // Run every 4 hours
    cronJob = cron.schedule('0 */4 * * *', async () => {
        log.info('SYSTEM', 'Starting boss battle generation...');

        try {
            // Get all active users (have logged in within last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const activeProfiles = await GamificationProfile.find({
                updatedAt: { $gte: sevenDaysAgo }
            }).limit(100); // Limit to prevent overload

            log.info('SYSTEM', `Found ${activeProfiles.length} active users for boss battles`);

            let generated = 0;
            let failed = 0;

            for (const profile of activeProfiles) {
                try {
                    // Check if user already has an active battle
                    const activeBattles = await bossBattleService.getActiveBattles(profile.userId);

                    // Only create if they have 0 or 1 active battles
                    if (activeBattles.length < 2) {
                        await bossBattleService.createBossBattle(profile.userId);
                        generated++;
                        log.info('SYSTEM', `Created battle for user ${profile.userId}`);
                    }

                } catch (error) {
                    failed++;
                    log.error('SYSTEM', `Battle generation failed for ${profile.userId}: ${error.message}`);
                }
            }

            log.info('SYSTEM', `Battle generation complete. Success: ${generated}, Fail: ${failed}`);

        } catch (error) {
            log.error('SYSTEM', 'Boss battle cron job error', error);
        }
    });

    log.info('SYSTEM', 'Boss battle generator started (every 4 hours)');
};

const stopBossBattleGenerator = () => {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
        log.info('SYSTEM', 'Boss battle generator stopped');
    }
};

module.exports = {
    startBossBattleGenerator,
    stopBossBattleGenerator
};
