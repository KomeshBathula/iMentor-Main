const log = require('../utils/logger');
// server/routes/subjects.js
const express = require('express');
const router = express.Router();
const AdminDocument = require('../models/AdminDocument');
const axios = require('axios');
const { redisClient } = require('../config/redisClient');

const PYTHON_RAG_URL = process.env.PYTHON_RAG_SERVICE_URL || 'http://127.0.0.1:2001';
const { runQuery: neo4jRun } = require('../config/neo4j');

let cachedSubjects = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 60 seconds

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function enrichWithCourseMetadata(courses) {
    try {
        const codes = courses.map(c => c.code).filter(Boolean);
        if (codes.length === 0) return courses;
        const result = await neo4jRun(
            `MATCH (c:Course) WHERE c.code IN $codes
             RETURN c.code AS code, c.name AS name,
                    c.semester AS semester, c.credits AS credits,
                    c.department AS dept, c.category AS category`,
            { codes }
        );
        const metaMap = {};
        for (const record of result.records) {
            const r = record.toObject();
            metaMap[r.code] = {
                name: r.name || r.code,
                semester: r.semester || null,
                credits: r.credits != null ? r.credits : null,
                dept: r.dept || null,
                category: r.category || null,
            };
        }
        return courses.map(c => {
            const meta = metaMap[c.code];
            return meta ? { ...c, ...meta } : c;
        });
    } catch (err) {
        log.warn('DB', `Neo4j course metadata enrichment failed: ${err.message}`);
        return courses;
    }
}

function normalizeCourse(item) {
    // Object format from enriched RAG response
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return {
            code: item.code || item.course || '',
            name: item.name || item.code || item.course || '',
            semester: item.semester || null,
            credits: item.credits != null ? item.credits : null,
            dept: item.dept || null,
            category: item.category || null,
        };
    }
    // String format (backward compat)
    const str = String(item || '');
    return { code: str, name: str, semester: null, credits: null, dept: null, category: null };
}

async function fetchCurriculumCoursesWithRetry({ attempts = 3, timeoutMs = 8000 } = {}) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const ragResponse = await axios.get(`${PYTHON_RAG_URL}/curriculum/courses`, { timeout: timeoutMs });
            if (ragResponse.data && ragResponse.data.success && Array.isArray(ragResponse.data.courses)) {
                const raw = ragResponse.data.courses;
                const courses = raw.map(normalizeCourse).filter(c => c.code);
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
// @desc    Get list of available courses with code, name, semester, credits
// @access  Private (Regular User Authenticated via JWT)
router.get('/', async (req, res) => {
    try {
        // 1. Check in-memory cache
        if (cachedSubjects && cachedSubjects.length > 0 && (Date.now() - lastFetchTime < CACHE_TTL)) {
            return res.json({ subjects: cachedSubjects });
        }

        // 2. Try to get courses from Neo4j curriculum graph via Python RAG service
        let courses = await fetchCurriculumCoursesWithRetry({ attempts: 3, timeoutMs: 8000 });

        // Enrich with Course node metadata (name, semester, credits) from Neo4j
        if (courses.length > 0) {
            courses = await enrichWithCourseMetadata(courses);
        }

        // 3. Fall back to Redis cache
        if (courses.length === 0 && redisClient && redisClient.isOpen) {
            try {
                const cachedFromRedis = await redisClient.get('curriculum:courses');
                if (cachedFromRedis) {
                    const parsed = JSON.parse(cachedFromRedis);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        courses = parsed.map(normalizeCourse).filter(c => c.code);
                        log.warn('DB', `Using cached curriculum courses from Redis (graph unavailable)`);
                    }
                }
            } catch (redisReadErr) {
                log.warn('DB', `Redis read failed for curriculum:courses: ${redisReadErr.message}`);
            }
        }

        // 4. Fall back to AdminDocument collection
        if (courses.length === 0) {
            const subjectObjects = await AdminDocument.find().sort({ originalName: 1 }).select('originalName').lean();
            courses = subjectObjects.map(doc => ({ code: doc.originalName, name: doc.originalName, semester: null, credits: null, dept: null, category: null }));
            if (courses.length > 0) {
                log.info('DB', `Got ${courses.length} subjects from AdminDocument (fallback)`);
            } else {
                log.warn('DB', 'No subjects found: neither Neo4j curriculum nor AdminDocument have data');
            }
        }

        // 5. Only cache NON-EMPTY results
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
