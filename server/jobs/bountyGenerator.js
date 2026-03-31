// server/jobs/bountyGenerator.js
const cron = require('node-cron');
const bountyService = require('../services/bountyService');
const log = require('../utils/logger');

/**
 * Cron job to automatically generate bounty questions
 * Runs daily at 9:00 AM
 */
function startBountyGenerator() {
    // Schedule: Every day at 9:00 AM
    // Format: minute hour day month weekday
    cron.schedule('0 9 * * *', async () => {
        log.info('SYSTEM', 'Starting daily bounty generation...');

        try {
            const count = await bountyService.generatePeriodicBounties();
            log.info('SYSTEM', `Generated ${count} bounty questions`);
        } catch (error) {
            log.error('SYSTEM', 'Bounty generation error', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // Set to your timezone
    });

    log.info('SYSTEM', 'Bounty generator scheduled: Daily at 9:00 AM IST');
}

/**
 * Manual trigger for testing or admin use
 */
async function manualTrigger() {
    log.info('SYSTEM', 'Manual bounty trigger initiated...');

    try {
        const count = await bountyService.generatePeriodicBounties();
        log.info('SYSTEM', `Generated ${count} bounties (manual)`);
        return count;
    } catch (error) {
        log.error('SYSTEM', 'Manual bounty trigger failed', error);
        throw error;
    }
}

module.exports = {
    startBountyGenerator,
    manualTrigger
};
