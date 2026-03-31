const log = require('../utils/logger');
// server/routes/admin/datasetRoutes.js
const express = require('express');
const router = express.Router();
const Dataset = require('./../models/Dataset');
const { getSignedUploadUrl, getSignedDownloadUrl, deleteObjectFromS3 } = require('./../services/s3Service');

// @route   POST /api/admin/datasets/presigned-url
// @desc    Get a secure, pre-signed URL for uploading a dataset to S3
// @access  Admin
router.post('/presigned-url', async (req, res) => {
    const { fileName, fileType } = req.body;
    if (!fileName || !fileType) {
        return res.status(400).json({ message: 'fileName and fileType are required.' });
    }

    try {
        const { url, key } = await getSignedUploadUrl(fileName, fileType);
        res.json({ url, key });
    } catch (error) {
        log.error('DB', `Failed to generate upload URL: ${error.message}`);
        res.status(500).json({ message: 'Could not generate upload URL.' });
    }
});

// @route   POST /api/admin/datasets/finalize-upload
// @desc    Create the dataset metadata record in MongoDB after successful S3 upload
// @access  Admin
router.post('/finalize-upload', async (req, res) => {
    const { originalName, s3Key, category, version, fileType, size } = req.body;
    if (!originalName || !s3Key || !category || !version || !fileType || !size) {
        return res.status(400).json({ message: 'Missing required fields to finalize upload.' });
    }

    try {
        const newDataset = new Dataset({
            originalName, s3Key, category, version, fileType, size
        });
        await newDataset.save();
        res.status(201).json({ message: 'Dataset metadata saved successfully.', dataset: newDataset });
    } catch (error) {
        log.error('DB', `Failed to finalize upload: ${error.message}`);
        res.status(500).json({ message: 'Server error while saving dataset metadata.' });
    }
});

// @route   GET /api/admin/datasets
// @desc    Get a list of all uploaded datasets
// @access  Admin
router.get('/', async (req, res) => {
    try {
        const datasets = await Dataset.find().sort({ createdAt: -1 });
        res.json(datasets);
    } catch (error) {
        log.error('DB', `Failed to fetch datasets: ${error.message}`);
        res.status(500).json({ message: 'Server error while fetching datasets.' });
    }
});

// @route   GET /api/admin/datasets/:id/download-url
// @desc    Get a secure, pre-signed URL for downloading a dataset from S3
// @access  Admin
router.get('/:id/download-url', async (req, res) => {
    try {
        const dataset = await Dataset.findById(req.params.id);
        if (!dataset) {
            return res.status(404).json({ message: 'Dataset not found.' });
        }
        const url = await getSignedDownloadUrl(dataset.s3Key, dataset.originalName);
        res.json({ url });
    } catch (error) {
        log.error('DB', `Failed to generate download URL: ${error.message}`);
        res.status(500).json({ message: 'Could not generate download URL.' });
    }
});

// <<< THIS IS THE MODIFIED ROUTE >>>
// @route   DELETE /api/admin/datasets/:id
// @desc    Delete a dataset from S3 and MongoDB
// @access  Admin
router.delete('/:id', async (req, res) => {
    try {
        // 1. Find the dataset metadata in MongoDB
        const dataset = await Dataset.findById(req.params.id);
        if (!dataset) {
            return res.status(404).json({ message: 'Dataset not found.' });
        }

        // 2. *** NEW VALIDATION STEP ***
        // Check if there is an S3 key before attempting to delete from S3.
        if (dataset.s3Key) {
            log.info('DB', `Deleting from S3: ${dataset.s3Key}`);
            await deleteObjectFromS3(dataset.s3Key);
        } else {
            log.warn('DB', `S3 key missing for dataset: ${dataset._id}`);
        }

        // 3. If S3 deletion was successful (or skipped), delete the metadata from MongoDB
        await Dataset.findByIdAndDelete(req.params.id);

        res.json({ message: `Dataset '${dataset.originalName}' and its metadata were deleted successfully.` });
    } catch (error) {
        log.error('DB', `Failed to delete dataset: ${error.message}`);
        res.status(500).json({ message: 'Server error while deleting dataset.' });
    }
});

module.exports = router;