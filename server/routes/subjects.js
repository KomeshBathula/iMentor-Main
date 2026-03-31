const log = require('../utils/logger');
// server/routes/subjects.js
const express = require('express');
const router = express.Router();
const AdminDocument = require('../models/AdminDocument');
const axios = require('axios');
const { redisClient } = require('../config/redisClient');

const PYTHON_RAG_URL = process.env.PYTHON_RAG_SERVICE_URL || 'http://127.0.0.1:2001';

let cachedSubjects = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 60 seconds

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCurriculumCoursesWithRetry({ attempts = 3, timeoutMs = 8000 } = {}) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const ragResponse = await axios.get(`${PYTHON_RAG_URL}/curriculum/courses`, { timeout: timeoutMs });
            if (ragResponse.data && ragResponse.data.success && Array.isArray(ragResponse.data.courses)) {
                const courses = ragResponse.data.courses;
                if (courses.length > 0) {
                    log.info('DB', `Got ${courses.length} courses from Neo4j curriculum graph (attempt ${attempt}/${attempts})`);
                }
                return courses;
            }
        } catch (ragError) {
            log.warn('DB', `Neo4j curriculum fetch failed (attempt ${attempt}/${attempts}): ${ragError.message}`);
            if (attempt < attempts) {
                await sleep(250 * attempt);
            }
        }
    }

    return [];
}

// @route   GET /api/subjects
// @desc    Get a list of available subject/course names (from Neo4j curriculum first, fallback to AdminDocument)
// @access  Private (Regular User Authenticated via JWT)
router.get('/', async (req, res) => {
    try {
        // 1. Check in-memory cache — but ONLY if it has actual courses
        if (cachedSubjects && cachedSubjects.length > 0 && (Date.now() - lastFetchTime < CACHE_TTL)) {
            return res.json({ subjects: cachedSubjects });
        }

        // 2. Try to get courses from Neo4j curriculum graph via Python RAG service
        // Always prefer live graph data over Redis to avoid stale subject lists.
        let courses = await fetchCurriculumCoursesWithRetry({ attempts: 3, timeoutMs: 8000 });

        // 3. Fall back to Redis cache ONLY if graph lookup returned no courses
        if (courses.length === 0 && redisClient && redisClient.isOpen) {
            try {
                const cachedFromRedis = await redisClient.get('curriculum:courses');
                if (cachedFromRedis) {
                    const parsed = JSON.parse(cachedFromRedis);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        courses = parsed;
                        log.warn('DB', `Using cached curriculum courses from Redis (graph unavailable)`);
                    }
                }
            } catch (redisReadErr) {
                log.warn('DB', `Redis read failed for curriculum:courses: ${redisReadErr.message}`);
            }
        }

        // 4. If no courses from Neo4j/Redis, fall back to AdminDocument collection
        if (courses.length === 0) {
            const subjectObjects = await AdminDocument.find().sort({ originalName: 1 }).select('originalName').lean();
            courses = subjectObjects.map(doc => doc.originalName);
            if (courses.length > 0) {
                log.info('DB', `Got ${courses.length} subjects from AdminDocument (fallback)`);
            } else {
                log.warn('DB', 'No subjects found: neither Neo4j curriculum nor AdminDocument have data');
            }
        }

        // 5. Only cache NON-EMPTY results — never cache empty arrays
        if (courses.length > 0) {
            cachedSubjects = courses;
            lastFetchTime = Date.now();
            if (redisClient && redisClient.isOpen) {
                try {
                    await redisClient.setEx('curriculum:courses', 60, JSON.stringify(courses));
                } catch (redisWriteErr) {
                    log.warn('DB', `Redis write failed for curriculum:courses: ${redisWriteErr.message}`);
                }
            }
        }

        res.json({ subjects: courses });
    } catch (error) {
        log.error('DB', `Failed to fetch subjects: ${error.message}`);
        res.status(500).json({ message: "Server error while fetching available subjects." });
    }
});

module.exports = router;