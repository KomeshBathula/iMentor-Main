// server/models/SystemBenchmarkLog.js

const mongoose = require('mongoose');

const systemBenchmarkLogSchema = new mongoose.Schema({
    requestMode: {
        type: String,
        enum: ['basic', 'tot', 'react', 'deep_research'],
        required: true,
        default: 'basic'
    },
    routingMode: {
        type: String,
        enum: ['baseline', 'smart'],
        default: 'baseline'
    },
    modelName: {
        type: String,
        required: true
    },
    latencyMs: {
        type: Number,
        required: true
    },
    inputTokens: {
        type: Number,
        default: null
    },
    outputTokens: {
        type: Number,
        default: null
    },
    totalTokens: {
        type: Number,
        default: null
    },
    reasoningBranches: {
        type: Number,
        default: null
    },
    prunedBranches: {
        type: Number,
        default: null
    },
    finalConfidenceScore: {
        type: Number,
        default: null
    },
    contextReductionPercent: {
        type: Number,
        default: null
    },
    successFlag: {
        type: Boolean,
        default: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

systemBenchmarkLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('SystemBenchmarkLog', systemBenchmarkLogSchema);
