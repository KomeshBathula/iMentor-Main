// server/config/redisClient.js
const { createClient } = require('redis');
const log = require('../utils/logger');
const dotenv = require('dotenv');
dotenv.config();

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
    log.warn('REDIS', "REDIS_URL not found in .env, Redis caching will be disabled.");
}

const redisClient = redisUrl ? createClient({ 
    url: redisUrl,
    socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000)
    }
}) : null;

if (redisClient) {
    redisClient.on('error', (err) => {
        if (err.code !== 'ECONNREFUSED') {
            log.error('REDIS', 'Redis Client Error', err);
        }
    });
    redisClient.on('connect', () => log.success('REDIS', 'Redis client connected successfully.'));
    redisClient.on('reconnecting', () => log.info('REDIS', 'Redis client is reconnecting...'));
}

const connectRedis = async () => {
    if (redisClient && !redisClient.isOpen) {
        try {
            log.info('REDIS', 'Attempting to connect to Redis...');
            await redisClient.connect();
        } catch (err) {
            log.error('REDIS', 'Failed to connect to Redis', err);
        }
    }
};

module.exports = { redisClient, connectRedis };
