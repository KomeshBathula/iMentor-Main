// server/models/CourseAdapterMapping.js
const mongoose = require('mongoose');

/**
 * 2.1.3 Multi-Model Management
 * Maps courses to fine-tuned model adapters for dynamic inference routing.
 */
const CourseAdapterMappingSchema = new mongoose.Schema(
    {
        courseId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
            description: 'Unique course identifier, e.g. machine_learning, physics_101',
        },
        adapterName: {
            type: String,
            required: true,
            trim: true,
            description: 'Name of the fine-tuned adapter, e.g. physics-adapter-v2',
        },
        baseModel: {
            type: String,
            required: true,
            trim: true,
            description: 'Base model the adapter was built on, e.g. llama-3.1-8b-instant',
        },
        provider: {
            type: String,
            required: true,
            enum: ['gemini', 'ollama', 'openai', 'groq', 'fine-tuned', 'anthropic', 'mistral'],
            default: 'fine-tuned',
        },
        version: {
            type: String,
            default: 'v1.0',
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            description: 'Whether this mapping is active and should be used during inference.',
        },
        description: {
            type: String,
            default: '',
            description: 'Optional admin notes about this adapter mapping.',
        },
        // Version history: tracks every assignment change
        history: [
            {
                adapterName: String,
                baseModel: String,
                version: String,
                changedAt: { type: Date, default: Date.now },
                changedBy: { type: String, default: 'admin' },
            },
        ],
    },
    {
        timestamps: true, // provides createdAt and updatedAt automatically
    }
);

module.exports = mongoose.model('CourseAdapterMapping', CourseAdapterMappingSchema);
