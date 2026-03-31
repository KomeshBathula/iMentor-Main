// server/models/PendingRegistration.js
// Ephemeral pre-signup document — replaces ghost User creation during OTP flow.
// TTL-indexed: auto-deleted after 15 minutes if OTP is never verified.
const mongoose = require('mongoose');

const PendingRegistrationSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    hashedPassword: {
        type: String,
        required: true
    },
    hashedOtp: {
        type: String,
        required: true
    },
    otpExpires: {
        type: Date,
        required: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 900 // TTL index: auto-delete after 15 minutes
    }
});

module.exports = mongoose.model('PendingRegistration', PendingRegistrationSchema);
