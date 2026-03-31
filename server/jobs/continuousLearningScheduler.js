/**
 * Continuous Learning Scheduler
 * Automated weekly/monthly retraining for self-improving models
 * Implements incremental learning and model versioning
 */

const cron = require('node-cron');
const LLMPerformanceLog = require('../models/LLMPerformanceLog');
const FineTuningEvent = require('../models/FineTuningEvent');
const { evaluateModel, compareModels } = require('../services/modelEvaluator');
const { monitorModel } = require('../services/modelMonitoringService');

const RETRAINING_SCHEDULE = '0 2 * * 0'; // Every Sunday at 2 AM
const MIN_NEW_SAMPLES = 100; // Minimum new training samples to trigger retraining
const MIN_QUALITY_THRESHOLD = 0.7; // Minimum avg feedback score

/**
 * Initializes the continuous learning scheduler
 */
function initializeScheduler() {
    console.log('[ContinuousLearning] Initializing scheduler...');
    console.log(`[ContinuousLearning] Schedule: ${RETRAINING_SCHEDULE} (Every Sunday at 2 AM)`);

    // Schedule weekly retraining check
    cron.schedule(RETRAINING_SCHEDULE, async () => {
        console.log('[ContinuousLearning] Running scheduled retraining check');
        await checkAndRetrainModels();
    });

    console.log('[ContinuousLearning] Scheduler initialized successfully');
}

/**
 * Checks all course-specific models and triggers retraining if needed
 */
async function checkAndRetrainModels() {
    try {
        // Get all unique course-specific models
        const activeModels = await getCourseModels();

        console.log(`[ContinuousLearning] Found ${activeModels.length} active course models`);

        for (const model of activeModels) {
            await processModelRetraining(model);
        }

        console.log('[ContinuousLearning] Retraining check complete');
    } catch (error) {
        console.error('[ContinuousLearning] Error in retraining check:', error);
    }
}

/**
 * Checks if a specific model should be retrained
 */
async function processModelRetraining(model) {
    const { modelName, course } = model;

    console.log(`[ContinuousLearning] Checking model: ${modelName} (${course})`);

    // Step 1: Check if there's enough new data
    const newData = await getNewTrainingData(modelName, course);

    if (newData.length < MIN_NEW_SAMPLES) {
        console.log(`[ContinuousLearning] Not enough new data for ${modelName} (${newData.length}/${MIN_NEW_SAMPLES})`);
        return;
    }

    // Step 2: Check if data quality is sufficient
    const dataQuality = calculateDataQuality(newData);

    if (dataQuality.avgScore < MIN_QUALITY_THRESHOLD) {
        console.log(`[ContinuousLearning] Data quality too low for ${modelName} (${dataQuality.avgScore}/${MIN_QUALITY_THRESHOLD})`);
        return;
    }

    // Step 3: Check current model performance
    const currentPerformance = await monitorModel(modelName, course);

    if (currentPerformance.status === 'warning') {
        console.log(`[ContinuousLearning] ⚠️  Model ${modelName} showing performance degradation - prioritizing retraining`);
    }

    // Step 4: Trigger retraining
    console.log(`[ContinuousLearning] ✅ Triggering retraining for ${modelName}`);
    console.log(`[ContinuousLearning] New samples: ${newData.length}, Quality: ${dataQuality.avgScore.toFixed(2)}`);

    await triggerFineTuning(modelName, course, newData);
}

/**
 * Gets new training data since last fine-tuning
 */
async function getNewTrainingData(modelName, course) {
    // Find last fine-tuning event
    const lastFineTuning = await FineTuningEvent.findOne({
        modelName,
        course,
        status: 'completed'
    }).sort({ completedAt: -1 });

    const cutoffDate = lastFineTuning?.completedAt || new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)); // Default: last 30 days

    // Get new positive feedback data
    const newLogs = await LLMPerformanceLog.find({
        'documentContext.course': course,
        userFeedback: 'positive',
        timestamp: { $gte: cutoffDate }
    }).select('userQuery aiResponse userFeedback feedbackScore');

    return newLogs;
}

/**
 * Calculates quality metrics for training data
 */
function calculateDataQuality(dataPoints) {
    if (dataPoints.length === 0) {
        return { avgScore: 0, distribution: {} };
    }

    const scores = dataPoints.map(d => d.feedbackScore || 1.0);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    return {
        avgScore,
        totalSamples: dataPoints.length,
        distribution: {
            excellent: scores.filter(s => s >= 0.9).length,
            good: scores.filter(s => s >= 0.7 && s < 0.9).length,
            fair: scores.filter(s => s < 0.7).length
        }
    };
}

/**
 * Triggers fine-tuning job
 */
async function triggerFineTuning(modelName, course, trainingData) {
    try {
        // Create fine-tuning event
        const fineTuningEvent = new FineTuningEvent({
            modelName: `${modelName}-v${Date.now()}`, // Version with timestamp
            baseModel: modelName,
            course,
            status: 'queued',
            hyperparameters: {
                learningRate: 2e-4,
                epochs: 3,
                batchSize: 4,
                loraR: 16,
                loraAlpha: 32
            },
            trainingDataStats: {
                totalSamples: trainingData.length,
                positiveExamples: trainingData.length
            },
            queuedAt: new Date()
        });

        await fineTuningEvent.save();

        console.log(`[ContinuousLearning] Fine-tuning job queued: ${fineTuningEvent._id}`);

        // TODO: Trigger actual fine-tuning process
        // This would call the fine_tuner.py script or queue the job

        return fineTuningEvent;
    } catch (error) {
        console.error('[ContinuousLearning] Error triggering fine-tuning:', error);
        throw error;
    }
}

/**
 * Gets list of active course-specific models
 */
async function getCourseModels() {
    // Get unique combinations of modelName + course from recent performance logs
    const models = await LLMPerformanceLog.aggregate([
        {
            $match: {
                timestamp: { $gte: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)) }, // Last week
                'documentContext.course': { $exists: true, $ne: null }
            }
        },
        {
            $group: {
                _id: {
                    modelName: '$modelName',
                    course: '$documentContext.course'
                }
            }
        },
        {
            $project: {
                modelName: '$_id.modelName',
                course: '$_id.course',
                _id: 0
            }
        }
    ]);

    return models;
}

/**
 * Manual trigger for immediate retraining (can be called via API)
 */
async function manualRetrain(modelName, course) {
    console.log(`[ContinuousLearning] Manual retraining triggered for ${modelName} (${course})`);
    await processModelRetraining({ modelName, course });
}

module.exports = {
    initializeScheduler,
    checkAndRetrainModels,
    manualRetrain
};
