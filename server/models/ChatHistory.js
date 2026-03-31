// server/models/ChatHistory.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const MessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'model'], required: true },
    parts: [{ text: { type: String, required: true } }],
    timestamp: { type: Date, default: Date.now },
    thinking: { type: String, default: '' },
    references: { type: Array, default: [] },
    source_pipeline: { type: String, default: '' },
    confidenceScore: { type: Number, default: null },
    reasoningMeta: { type: mongoose.Schema.Types.Mixed, default: null },
    logId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LLMPerformanceLog',
        default: null
    }
}, { _id: true });

const ChatHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    messages: [MessageSchema],
    summary: {
        type: String,
        default: ''
    },
    // Tutor Mode persistence
    isTutorMode: {
        type: Boolean,
        default: false,
        index: true
    },
    // 'structured' = Course roadmap, 'general_socratic' = no-course Socratic, 'assistant' = quiz evaluator
    tutorModeType: {
        type: String,
        enum: ['structured', 'general_socratic', 'assistant', null],
        default: null
    },
    courseName: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
}, { _id: true });

ChatHistorySchema.pre('save', function (next) {
    if (this.isModified()) {
        this.updatedAt = Date.now();
    }
    next();
});

ChatHistorySchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

// ============================================================================
// STATIC METHODS - Chat Cleanup Utilities
// ============================================================================

/**
 * Delete all empty chat histories (0 messages) for a user
 * @param {ObjectId} userId - User ID
 * @returns {Promise<{deletedCount: number}>}
 */
ChatHistorySchema.statics.deleteEmptyChats = async function (userId) {
    const result = await this.deleteMany({
        userId: userId,
        $or: [
            { messages: { $size: 0 } },
            { messages: { $exists: false } }
        ]
    });
    console.log(`[ChatHistory] Deleted ${result.deletedCount} empty chats for user ${userId}`);
    return { deletedCount: result.deletedCount };
};

/**
 * Clean all empty chat histories across all users (admin/cron job)
 * @param {number} olderThanDays - Only delete if older than X days (default: 1)
 * @returns {Promise<{deletedCount: number}>}
 */
ChatHistorySchema.statics.cleanAllEmptyChats = async function (olderThanDays = 1) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.deleteMany({
        $or: [
            { messages: { $size: 0 } },
            { messages: { $exists: false } }
        ],
        createdAt: { $lt: cutoffDate }
    });
    console.log(`[ChatHistory] Cleaned ${result.deletedCount} empty chats older than ${olderThanDays} day(s)`);
    return { deletedCount: result.deletedCount };
};

/**
 * Get chat count statistics for a user
 * @param {ObjectId} userId - User ID
 * @returns {Promise<{total: number, empty: number, tutorMode: number}>}
 */
ChatHistorySchema.statics.getChatStats = async function (userId) {
    const [total, empty, tutorMode] = await Promise.all([
        this.countDocuments({ userId }),
        this.countDocuments({ userId, $or: [{ messages: { $size: 0 } }, { messages: { $exists: false } }] }),
        this.countDocuments({ userId, isTutorMode: true })
    ]);
    return { total, empty, tutorMode };
};

const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);
module.exports = ChatHistory;