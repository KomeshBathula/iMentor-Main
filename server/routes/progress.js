const log = require('../utils/logger');
const express = require('express');
const router = express.Router();
const User = require('../models/User');
// Note: authMiddleware is already applied at the mount point in server.js

// @desc    Get curriculum progress for a specific course
// @route   GET /api/progress/:courseName
// @access  Private
router.get('/:courseName', async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const courseName = req.params.courseName;
        const progress = user.curriculumProgress ? user.curriculumProgress.get(courseName) : null;

        // log.info('TUTOR', `Progress fetch: ${user.email} - ${courseName}`);

        res.status(200).json({
            success: true,
            progress: {
                completedTopics: progress?.completedTopics || [],
                completedModules: progress?.completedModules || [],
                completedSubtopics: progress?.completedSubtopics || [],
                quizResults: progress?.quizResults ? Object.fromEntries(progress.quizResults) : {},
                quizIndex: progress?.quizIndex || 0
            }
        });
    } catch (error) {
        log.error('TUTOR', `Progress fetch error: ${error.message}`);
        res.status(500).json({ success: false, message: 'Server error fetching progress' });
    }
});

// @desc    Update quiz results and index
// @route   POST /api/progress/quiz
// @access  Private
router.post('/quiz', async (req, res) => {
    try {
        const { courseName, quizResults, quizIndex } = req.body;

        if (!courseName) {
            return res.status(400).json({ success: false, message: 'Missing courseName' });
        }

        // log.info('TUTOR', `Quiz progress update: ${courseName}`);

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user.curriculumProgress) {
            user.curriculumProgress = new Map();
        }

        let courseProgress = user.curriculumProgress.get(courseName);
        if (!courseProgress) {
            courseProgress = {
                completedTopics: [],
                completedModules: [],
                completedSubtopics: [],
                quizResults: new Map(),
                quizIndex: 0
            };
        }

        if (quizResults !== undefined) {
            // Replace the results to allow for clearing/resetting
            courseProgress.quizResults = new Map(Object.entries(quizResults));
        }

        if (quizIndex !== undefined) {
            courseProgress.quizIndex = quizIndex;
        }

        user.curriculumProgress.set(courseName, courseProgress);
        user.markModified('curriculumProgress');
        await user.save();

        res.status(200).json({
            success: true,
            quizResults: Object.fromEntries(courseProgress.quizResults || new Map()),
            quizIndex: courseProgress.quizIndex
        });

    } catch (error) {
        log.error('TUTOR', `Quiz progress update failure: ${error.message}`);
        res.status(500).json({ success: false, message: 'Server error updating quiz progress' });
    }
});

// @desc    Update progress (mark items as completed)
// @route   POST /api/progress/update
// @access  Private
router.post('/update', async (req, res) => {
    try {
        const { courseName, type, id } = req.body; // type: 'module', 'topic', 'subtopic'

        if (!courseName || !type || (!id && type !== 'sync')) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Initialize map if it doesn't exist
        if (!user.curriculumProgress) {
            user.curriculumProgress = new Map();
        }

        // Get or create progress object for this course
        let courseProgress = user.curriculumProgress.get(courseName);
        if (!courseProgress) {
            courseProgress = {
                completedTopics: [],
                completedModules: [],
                completedSubtopics: []
            };
        }

        // Initialize arrays if they don't exist in the retrieved object (safety check)
        if (!courseProgress.completedTopics) courseProgress.completedTopics = [];
        if (!courseProgress.completedModules) courseProgress.completedModules = [];
        if (!courseProgress.completedSubtopics) courseProgress.completedSubtopics = [];

        let updated = false;

        // Add ID if not already present
        if (type === 'topic') {
            if (!courseProgress.completedTopics.includes(id)) {
                courseProgress.completedTopics.push(id);
                updated = true;
            }
        } else if (type === 'module') {
            if (!courseProgress.completedModules.includes(id)) {
                courseProgress.completedModules.push(id);
                updated = true;
            }
        } else if (type === 'subtopic') {
            if (!courseProgress.completedSubtopics.includes(id)) {
                courseProgress.completedSubtopics.push(id);
                updated = true;
            }
        } else if (type === 'sync') {
            // Replace (not merge) — allows clearing progress by passing empty arrays
            const { completedTopics, completedModules, completedSubtopics } = req.body;
            if (Array.isArray(completedTopics)) courseProgress.completedTopics = [...new Set(completedTopics)];
            if (Array.isArray(completedModules)) courseProgress.completedModules = [...new Set(completedModules)];
            if (Array.isArray(completedSubtopics)) courseProgress.completedSubtopics = [...new Set(completedSubtopics)];
            updated = true;
        }

        if (updated) {
            user.curriculumProgress.set(courseName, courseProgress);
            user.markModified('curriculumProgress');
            await user.save();
        }

        res.status(200).json({
            success: true,
            progress: courseProgress
        });

    } catch (error) {
        log.error('TUTOR', `Progress update failure: ${error.message}`);
        res.status(500).json({ success: false, message: 'Server error updating progress' });
    }
});

module.exports = router;
