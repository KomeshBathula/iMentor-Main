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
    sources: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },
    summary: {
        type: String
    },
    researchReport: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    evidenceProfile: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    providerBreakdown: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    citationGraphData: {
        type: mongoose.Schema.Types.Mixed,
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
