// server/models/UserFeedback.js
// Stores product-level feedback submitted by users (bugs, suggestions, general comments).
// Distinct from /api/feedback/:logId which handles thumbs-up/down on individual AI responses.

const mongoose = require('mongoose');

const UserFeedbackSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: ['bug', 'feature', 'general'],
            required: true,
            default: 'general'
        },
        category: {
            type: String,
            enum: ['UI', 'Performance', 'Content', 'AI Quality', 'Other'],
            required: true,
            default: 'Other'
        },
        message: {
            type: String,
            required: true,
            minlength: [10, 'Feedback must be at least 10 characters.'],
            maxlength: [1000, 'Feedback must be 1000 characters or fewer.'],
            trim: true
        },
        status: {
            type: String,
            enum: ['open', 'acknowledged', 'resolved', 'wont-fix'],
            default: 'open'
        },
        // Uploaded files (screenshots / attachments)
        attachments: [
            {
                filename:     { type: String },
                originalName: { type: String },
                mimetype:     { type: String },
                size:         { type: Number },
            }
        ],
        // Admin-facing fields
        adminNote: { type: String, default: '' },
        resolvedAt: { type: Date }
    },
    { timestamps: true }
);

// Index for admin listing (sorted by newest)
UserFeedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('UserFeedback', UserFeedbackSchema);
