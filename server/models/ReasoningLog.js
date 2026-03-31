// server/models/ReasoningLog.js
const mongoose = require('mongoose');

const ReasoningStepSchema = new mongoose.Schema({
    stepId: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    content: { type: String },
    thought: { type: String, default: null },
    action: { type: String, default: null },
    observation: { type: String, default: null },
    stepConfidence: { type: Number, min: 0, max: 100, default: null },
    reasoningScore: { type: Number, min: 0, max: 100, default: null },
    uncertaintyFactors: { type: [String], default: [] },
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ReasoningLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    query: {
        type: String,
        required: true
    },
    steps: [ReasoningStepSchema],
    confidenceScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    correctionsTriggered: {
        type: Number,
        default: 0
    },
    sourcePipeline: {
        type: String
    },
    telemetry: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });

// Auto-delete after 90 days to prevent unbounded growth
ReasoningLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
// Compound index for userId+createdAt queries (used by ToT orchestrator)
ReasoningLogSchema.index({ userId: 1, createdAt: -1 });

const ReasoningLog = mongoose.model('ReasoningLog', ReasoningLogSchema);

module.exports = ReasoningLog;
