const mongoose = require('mongoose');

const researchCacheSchema = new mongoose.Schema({
    query: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    normalizedQuery: {
        type: String,
        required: true,
        index: true
    },
    mode: {
        type: String,
        enum: ['HYBRID', 'ONLINE_ONLY', 'LOCAL_ONLY', 'Default', 'Adaptive', 'Fallback'],
        default: 'Default'
    },
    sources: [{
        title: String,
        content: String,
        url: String,
        sourceType: {
            type: String,
            enum: ['local', 'academic', 'web']
        },
        credibilityScore: Number,
        publishedDate: Date
    }],
    summary: {
        type: String
    },
    researchReport: {
        type: mongoose.Schema.Types.Mixed, // Stores the full JSON structure (sections, executiveSummary, etc.)
        default: {}
    },
    localSourceCount: {
        type: Number,
        default: 0
    },
    onlineSourceCount: {
        type: Number,
        default: 0
    },
    overallConfidenceScore: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true // Changed from TTL to persistent index
    },
    title: {
        type: String, // Auto-generated or user-provided title
        index: true
    }
});

module.exports = mongoose.model('ResearchCache', researchCacheSchema);
