// server/models/Dataset.js
const mongoose = require('mongoose');

const DatasetSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true,
    trim: true,
  },
  s3Key: { // The unique key for the object in the S3 bucket
    type: String,
    required: true,
    unique: true,
  },
  category: {
    type: String,
    required: [true, "Dataset category is required."],
    trim: true,
  },
  version: {
    type: String,
    required: [true, "Dataset version is required."],
    trim: true,
  },
  fileType: { // e.g., 'application/pdf'
    type: String,
    required: true,
  },
  size: { // Size in bytes
    type: Number,
    required: true,
  },
  uploadedBy: {
    type: String,
    required: true,
    default: 'admin',
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },

  // --- Training Data Metadata (populated by qa_generator pipeline) ---
  trainingMeta: {
    totalPairs: { type: Number, default: 0 },
    sourceDocument: { type: String, trim: true }, // Original file that generated this dataset

    // Difficulty distribution (Bloom's Taxonomy levels)
    difficultyDistribution: {
      beginner:     { count: { type: Number, default: 0 }, percentage: { type: Number, default: 0 } },
      intermediate: { count: { type: Number, default: 0 }, percentage: { type: Number, default: 0 } },
      advanced:     { count: { type: Number, default: 0 }, percentage: { type: Number, default: 0 } },
    },

    // Subject taxonomy coverage
    subjectCoverage: {
      type: Map,
      of: new mongoose.Schema({
        count: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
      }, { _id: false }),
      default: {},
    },

    // Topic-level granularity
    uniqueTopicCount: { type: Number, default: 0 },
    topics: [{ type: String, trim: true }],

    generatedAt: { type: Date },
  },
}, { timestamps: true });

DatasetSchema.index({ category: 1, version: 1 });
DatasetSchema.index({ 'trainingMeta.totalPairs': -1 });

const Dataset = mongoose.model('Dataset', DatasetSchema);

module.exports = Dataset;