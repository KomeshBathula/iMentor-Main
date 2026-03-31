// server/jobs/bossBattleCleanup.js
const cron = require('node-cron');
const BossBattle = require('../models/BossBattle');
const log = require('../utils/logger');

/**
 * Cron job to automatically expire and remove old boss battles
 * Runs every 2 hours
 */
function startBossBattleCleanup() {
    // Schedule: Every 2 hours
    // Format: minute hour day month weekday
    cron.schedule('0 */2 * * *', async () => {
        log.info('SYSTEM', 'Starting boss battle cleanup job...');

        try {
            // Mark expired battles as expired
            const expiredCount = await BossBattle.expireOldBattles();
            log.info('SYSTEM', `Marked ${expiredCount} boss battles as expired`);

            // Optional: Delete expired battles after they've been expired for more than 24 hours
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const deleteResult = await BossBattle.deleteMany({
                status: 'expired',
                expiresAt: { $lt: oneDayAgo }
            });
            log.info('SYSTEM', `Deleted ${deleteResult.deletedCount} old expired boss battles`);

        } catch (error) {
            log.error('SYSTEM', 'Boss battle cleanup error', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // Set to your timezone
    });

    log.info('SYSTEM', 'Boss battle cleanup scheduled: Every 2 hours');
}

/**
 * Manual trigger for testing or admin use
 */
async function manualCleanup() {
    log.info('SYSTEM', 'Manual boss battle cleanup initiated...');

    try {
        // Mark expired battles
        const expiredCount = await BossBattle.expireOldBattles();
        
        // Delete old expired battles
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deleteResult = await BossBattle.deleteMany({
            status: 'expired',
            expiresAt: { $lt: oneDayAgo }
        });

        const result = {
            markedExpired: expiredCount,
            deleted: deleteResult.deletedCount
        };

        log.info('SYSTEM', `Manual cleanup completed: ${result.markedExpired} marked, ${result.deleted} deleted`);
        return result;
    } catch (error) {
        log.error('SYSTEM', 'Manual boss battle cleanup failed', error);
        throw error;
    }
}

module.exports = {
    startBossBattleCleanup,
    manualCleanup
};
