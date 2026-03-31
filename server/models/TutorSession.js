const mongoose = require('mongoose');

const TutorSessionSchema = new mongoose.Schema(
    {
        sessionId: { type: String, required: true, unique: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        topic: { type: String, default: null },
        cognitiveLevel: { type: String, default: 'L1_CONCEPT' },
        masteryScore: { type: Number, default: 0 },
        attemptHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
        state: { type: mongoose.Schema.Types.Mixed, required: true }
    },
    { timestamps: true }
);

module.exports = mongoose.models.TutorSession || mongoose.model('TutorSession', TutorSessionSchema);