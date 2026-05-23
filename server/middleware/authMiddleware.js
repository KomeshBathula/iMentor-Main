// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const log = require('../utils/logger');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        log.warn('SYSTEM', `Auth failed: No token for ${req.originalUrl}`);
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        log.warn('SYSTEM', 'Auth failed: Invalid token format');
        return res.status(401).json({ message: 'Token format is invalid' });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            log.warn('SYSTEM', `Auth failed: User not found (${decoded.userId})`);
            return res.status(401).json({ message: 'User not found, token invalid' });
        }

        req.user = user;
        next();
    } catch (error) {
        log.warn('SYSTEM', `Auth failed: ${error.message}`);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token is not valid' });
        }
        return res.status(401).json({ message: 'Not authorized, token verification failed' });
    }
};

/**
 * softAuthMiddleware — identifies the caller but NEVER blocks.
 * - Valid JWT  → sets req.user (same as authMiddleware)
 * - No token   → sets req.user = null  (guest / anonymous)
 * - Bad token  → sets req.user = null  (treat as guest, don't 401)
 *
 * Use on routes that serve both authenticated users and guests,
 * paired with a rate-limiter keyed on req.user?.userId || req.ip.
 */
const softAuthMiddleware = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
        req.user = null;
        return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(parts[1], process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        req.user = user || null;
    } catch {
        req.user = null;
    }

    next();
};

module.exports = { authMiddleware, softAuthMiddleware };