// server/jobs/bountyCleanup.js
const cron = require('node-cron');
const BountyQuestion = require('../models/BountyQuestion');
const log = require('../utils/logger');

/**
 * Cron job to automatically expire and remove old bounty questions
 * Runs every 2 hours
 */
function startBountyCleanup() {
    // Schedule: Every 2 hours
    // Format: minute hour day month weekday
    cron.schedule('0 */2 * * *', async () => {
        log.info('SYSTEM', 'Starting bounty cleanup job...');

        try {
            // Mark expired bounties as expired
            const expiredCount = await BountyQuestion.expireOldBounties();
            log.info('SYSTEM', `Marked ${expiredCount} bounties as expired`);

            // Optional: Delete expired bounties after they've been expired for more than 24 hours
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const deleteResult = await BountyQuestion.deleteMany({
                status: 'expired',
                expiresAt: { $lt: oneDayAgo }
            });
            log.info('SYSTEM', `Deleted ${deleteResult.deletedCount} old expired bounties`);

        } catch (error) {
            log.error('SYSTEM', 'Bounty cleanup error', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // Set to your timezone
    });

    log.info('SYSTEM', 'Bounty cleanup scheduled: Every 2 hours');
}

/**
 * Manual trigger for testing or admin use
 */
async function manualCleanup() {
    log.info('SYSTEM', 'Manual bounty cleanup initiated...');

    try {
        // Mark expired bounties
        const expiredCount = await BountyQuestion.expireOldBounties();
        
        // Delete old expired bounties
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deleteResult = await BountyQuestion.deleteMany({
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
        log.error('SYSTEM', 'Manual bounty cleanup failed', error);
        throw error;
    }
}

module.exports = {
    startBountyCleanup,
    manualCleanup
};
