const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    jobType: {
        type: String,
        enum: ['upload', 'knowledge_source'],
        required: true,
    },
    status: {
        type: String,
        enum: ['queued', 'processing', 'completed', 'failed'],
        default: 'queued',
        index: true,
    },
    sourceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KnowledgeSource',
    },
    error: {
        type: String,
    },
    completedAt: {
        type: Date,
    }
}, { timestamps: true });

const Job = mongoose.model('Job', JobSchema);

module.exports = Job;
