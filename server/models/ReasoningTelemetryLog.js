const mongoose = require('mongoose');

const ReasoningTelemetryLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        default: null
    },
    sessionId: {
        type: String,
        index: true,
        default: null
    },
    sourcePipeline: {
        type: String,
        default: ''
    },
    totalBranchesGenerated: {
        type: Number,
        default: 0
    },
    branchesPruned: {
        type: Number,
        default: 0
    },
    executionTime: {
        type: Number,
        default: 0
    },
    tokensUsed: {
        type: Number,
        default: 0
    },
    finalConfidence: {
        type: Number,
        default: 0
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });

ReasoningTelemetryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('ReasoningTelemetryLog', ReasoningTelemetryLogSchema);
