const log = require('../utils/logger');
// server/routes/analysis.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const KnowledgeSource = require('../models/KnowledgeSource');
const AdminDocument = require('../models/AdminDocument');

// @route   GET /api/analysis/:documentFilename
// @desc    Get analysis data for a user's knowledge source or an admin subject
// @access  Private
router.get('/:documentFilename', authMiddleware, async (req, res) => {
    const userId = req.user._id;
    const { documentFilename } = req.params;

    if (!documentFilename) {
        return res.status(400).json({ message: 'Document filename parameter is required.' });
    }

    try {
        let sourceDocument = null;

        // 1. Check user-specific KnowledgeSource by its title
        sourceDocument = await KnowledgeSource.findOne({ userId, title: documentFilename }).select('analysis').lean();
        
        // 2. If not found, fallback to AdminDocument (Subjects) by its originalName
        if (!sourceDocument) {
            sourceDocument = await AdminDocument.findOne({ originalName: documentFilename }).select('analysis').lean();
        }

        if (!sourceDocument) {
            return res.status(404).json({ message: `Document or Subject '${documentFilename}' not found.` });
        }
        
        // Send the analysis sub-document, ensuring it's an object even if empty
        res.status(200).json(sourceDocument.analysis || { faq: "", topics: "", mindmap: "" });

    } catch (error) {
        log.error('DB', `Failed to fetch analysis for '${documentFilename}': ${error.message}`);
        res.status(500).json({ message: 'Server error while retrieving document analysis.' });
    }
});

const groqService = require('../services/groqService');
const { ANALYSIS_PROMPTS } = require('../config/promptTemplates');

// @route   POST /api/analysis/generate
// @desc    On-the-fly generation for analysis (e.g. for Neo4j subjects without docs)
// @access  Private
router.post('/generate', authMiddleware, async (req, res) => {
    const { filename, analysis_type } = req.body;
    
    if (!filename || !analysis_type || !ANALYSIS_PROMPTS[analysis_type]) {
        return res.status(400).json({ message: 'Invalid filename or analysis type.' });
    }

    try {
        log.info('AI', `On-the-fly generating ${analysis_type} for: ${filename} using Groq`);
        
        // As a fallback for subjects without underlying text uploaded, we generate based on the topic itself.
        const mockText = `Detailed educational concepts, topics, and definitions regarding the subject: "${filename}".`;
        const prompt = ANALYSIS_PROMPTS[analysis_type].getPrompt(mockText);
        
        let generatedContent = "Error: AI generation failed.";
        try {
            // groqService returns a string directly, unlike geminiService which returned an object
            generatedContent = await groqService.generateContentWithHistory([], prompt);
        } catch (genError) {
             throw new Error(`LLM generation error: ${genError.message}`);
        }

        const resultObj = {};
        resultObj[analysis_type] = generatedContent;
        
        res.status(200).json(resultObj);
        
    } catch (error) {
        log.error('DB', `Failed to generate on-the-fly analysis for '${filename}': ${error.message}`);
        res.status(500).json({ message: 'Server error while generating analysis.' });
    }
});

module.exports = router;