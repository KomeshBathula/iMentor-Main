const mongoose = require('mongoose');

const evaluationResultSchema = new mongoose.Schema({
    modelId: {
        type: String,
        required: true,
        index: true
    },
    courseId: {
        type: String,
        index: true
    },
    modelType: {
        type: String,
        enum: ['fine-tuned', 'base', 'adapter'],
        default: 'base'
    },
    testSetVersion: {
        type: String,
        required: true
    },
    metrics: {
        accuracy: {
            type: Number,
            min: 0,
            max: 1
        },
        relevance: {
            type: Number,
            min: 0,
            max: 1
        },
        helpfulness: {
            type: Number,
            min: 0,
            max: 1
        },
        latency: {
            type: Number, // in milliseconds
            min: 0
        },
        bleuScore: Number, // Optional: for text similarity
        rougeScores: {
            rouge1: Number,
            rouge2: Number,
            rougeL: Number
        }
    },
    sampleResults: [{
        question: String,
        expectedAnswer: String,
        actualAnswer: String,
        correct: Boolean,
        score: Number
    }],
    aggregateStats: {
        totalQuestions: Number,
        correctAnswers: Number,
        avgConfidence: Number,
        avgResponseTime: Number
    },
    comparison: {
        baselineModelId: String,
        improvementPercent: Number
    },
    evaluatedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Index for efficient querying
evaluationResultSchema.index({ modelId: 1, evaluatedAt: -1 });
evaluationResultSchema.index({ courseId: 1, evaluatedAt: -1 });

module.exports = mongoose.model('EvaluationResult', evaluationResultSchema);
