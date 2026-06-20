const log = require('../utils/logger');
// server/routes/generationRoutes.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const AdminDocument = require('../models/AdminDocument');
const KnowledgeSource = require('../models/KnowledgeSource');
const { decrypt } = require('../utils/crypto');
const { auditLog } = require('../utils/logger');

router.post('/document', async (req, res) => {
    const { markdownContent, docType, sourceDocumentName } = req.body;
    const userId = req.user._id;

    auditLog(req, 'CONTENT_GENERATION_FROM_SOURCE_SUCCESS', {
        docType: docType,
        sourceDocumentName: sourceDocumentName
    });

    if (!markdownContent || !docType || !sourceDocumentName) {
        return res.status(400).json({ message: 'markdownContent, docType, and sourceDocumentName are required.' });
    }

    try {
        let sourceDocumentText = null;
        let apiKeyForRequest = null;

        const user = await User.findById(userId).select('+encryptedApiKey');
        const userSource = await KnowledgeSource.findOne({ userId, title: sourceDocumentName }).select('textContent').lean();
        
        if (userSource?.textContent) {
            sourceDocumentText = userSource.textContent;
            if (user?.encryptedApiKey) {
                apiKeyForRequest = decrypt(user.encryptedApiKey);
            }
        } else {
            const adminDoc = await AdminDocument.findOne({ originalName: sourceDocumentName }).select('text').lean();
            if (adminDoc?.text) {
                sourceDocumentText = adminDoc.text;
                apiKeyForRequest = process.env.GEMINI_API_KEY;
            }
        }
        
        if (!sourceDocumentText) {
            return res.status(404).json({ message: `Source document '${sourceDocumentName}' not found.` });
        }
        if (!apiKeyForRequest) {
            return res.status(400).json({ message: "API Key for document generation is missing." });
        }

        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) {
            return res.status(500).json({ message: "Document generation service is not configured." });
        }
        
        const generationUrl = `${pythonServiceUrl}/generate_document`;
        
        const pythonResponse = await axios.post(generationUrl, {
            markdownContent, docType, sourceDocumentText, api_key: apiKeyForRequest
        }, { 
            responseType: 'stream',
            timeout: 600000 
        });

        res.setHeader('Content-Disposition', pythonResponse.headers['content-disposition']);
        res.setHeader('Content-Type', pythonResponse.headers['content-type']);
        
        // Add error handling to the stream
        pythonResponse.data.on('error', (err) => {
            log.error('SYSTEM', `Generation stream error [${sourceDocumentName}]: ${err.message}`);
            if (!res.headersSent) {
                res.status(502).json({ message: `Error connecting to the document generation service: ${err.message}` });
            }
        });

        pythonResponse.data.pipe(res);

    } catch (error) {
        auditLog(req, 'CONTENT_GENERATION_FROM_SOURCE_FAILURE', {
            docType: docType,
            sourceDocumentName: sourceDocumentName,
            error: error.message
        });

        const errorMsg = error.response?.data?.error || error.message || "Failed to generate document.";
        log.error('SYSTEM', `Generation error: ${errorMsg}`);
        if (!res.headersSent) {
            res.status(error.response?.status || 500).json({ message: errorMsg });
        }
    }
});

router.post('/document/from-topic', async (req, res) => {
    const { topic, docType } = req.body;
    const userId = req.user._id;

    auditLog(req, 'CONTENT_GENERATION_FROM_TOPIC_SUCCESS', {
        docType: docType,
        topic: topic
    });


    if (!topic || !docType) {
        return res.status(400).json({ message: 'Topic and docType are required.' });
    }

    try {
        const user = await User.findById(userId).select('+encryptedApiKey');
        const apiKeyForRequest = user?.encryptedApiKey ? decrypt(user.encryptedApiKey) : process.env.GEMINI_API_KEY;

        if (!apiKeyForRequest) {
            return res.status(400).json({ message: "API Key for document generation is missing." });
        }

        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) {
            return res.status(500).json({ message: "Document generation service is not configured." });
        }
        
        const generationUrl = `${pythonServiceUrl}/generate_document_from_topic`;
        // log.info('SYSTEM', `Proxying topic request for '${topic}'`);

        const pythonResponse = await axios.post(generationUrl, {
            topic,
            docType,
            api_key: apiKeyForRequest
        }, { 
            responseType: 'stream',
            timeout: 600000 
        });

        res.setHeader('Content-Disposition', pythonResponse.headers['content-disposition']);
        res.setHeader('Content-Type', pythonResponse.headers['content-type']);
        
        // --- THIS IS THE FIX ---
        // We attach an error handler directly to the stream from Python.
        // This will catch connection errors (like ECONNREFUSED) that the try/catch block misses.
        pythonResponse.data.on('error', (err) => {
            log.error('SYSTEM', `Topic generation stream error [${topic}]: ${err.message}`);
            if (!res.headersSent) {
                res.status(502).json({ message: `Error connecting to the generation service: ${err.message}` });
            }
        });
        
        // Pipe the data to the client response
        pythonResponse.data.pipe(res);
        // --- END OF FIX ---

    } catch (error) {
        auditLog(req, 'CONTENT_GENERATION_FROM_TOPIC_FAILURE', {
            docType: docType,
            topic: topic,
            error: error.message
        });

        const errorMsg = error.response?.data?.error || error.message || "Failed to generate document from topic.";
        log.error('SYSTEM', `Topic generation failure: ${errorMsg}`);
        if (!res.headersSent) {
            res.status(error.response?.status || 500).json({ message: errorMsg });
        }
    }
});

// [Team2] 4-agent RAG report generation — Planner → Writer → Critic → Expander
// Generates structured, hallucination-proof course reports grounded in STN teaching notes
router.post('/report', async (req, res) => {
    const { courseName, userIntent, llmConfig } = req.body;
    const userId = req.user._id;

    if (!courseName || !userIntent) {
        return res.status(400).json({ message: 'courseName and userIntent are required.' });
    }

    try {
        const user = await User.findById(userId).select('+encryptedApiKey');
        let config = llmConfig || {};
        if (!config.apiKey && !config.llmProvider) {
            const userGroqKey = user?.encryptedApiKey ? decrypt(user.encryptedApiKey) : null;
            config = {
                llmProvider: 'groq',
                groqModel: 'llama-3.1-8b-instant',
                apiKey: userGroqKey || process.env.GROQ_API_KEY
            };
        }

        log.info('REPORT', `User ${userId} requesting report for course "${courseName}" — intent: "${userIntent.substring(0, 80)}"`);
        const { generateReport } = require('../services/reportOrchestrator');

        const report = await generateReport(
            userIntent,
            courseName,
            config,
            (progressMsg) => {
                log.info('REPORT', `[Progress]: ${progressMsg}`);
            }
        );

        res.json({ success: true, report });
    } catch (error) {
        log.error('REPORT', `Report generation failed: ${error.message}`);
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
});

module.exports = router;