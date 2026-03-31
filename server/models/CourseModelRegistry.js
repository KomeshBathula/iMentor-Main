/**
 * Course Model Registry Schema
 * Implements Task 2.1.3: Course-to-model registry tracking
 */

const mongoose = require('mongoose');

const courseModelRegistrySchema = new mongoose.Schema({
    courseId: {
        type: String,
        required: true,
        index: true
    },
    courseName: {
        type: String,
        required: true
    },
    baseModel: {
        type: String, // e.g., 'qwen2.5-1.5b-instruct'
        required: true
    },
    activeVersion: {
        type: String, // e.g., 'v1.2.0'
        default: 'v1.0.0'
    },
    modelStatus: {
        type: String,
        enum: ['training', 'active', 'archived', 'failed'],
        default: 'training'
    },
    ollamaTag: {
        type: String, // e.g., 'imentor-math-101:latest'
        required: true
    },
    metrics: {
        accuracy: { type: Number, default: 0 },
        latencyMs: { type: Number, default: 0 },
        userSatisfactionScore: { type: Number, default: 0 }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastTrainedAt: {
        type: Date
    }
});

module.exports = mongoose.model('CourseModelRegistry', courseModelRegistrySchema);
