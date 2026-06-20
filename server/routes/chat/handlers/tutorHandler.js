// server/routes/chat/handlers/tutorHandler.js
// Handles both Socratic tutor modes: General (no-course) and Course-Structured.
const ChatHistory = require('../../../models/ChatHistory');
const User = require('../../../models/User');
const {
    processTutorResponse,
    getTutorSessionState,
    setTutorSessionState,
    clearTutorSessionState,
    startSocraticSession,
    SOCRATIC_STATES,
    getSubtopicContext,
    resolveCurrentPosition,
    advanceToNextSubtopic,
    buildInitialLearningPath,
    saveUserProgress,
} = require('../../../services/socraticTutorService');
const tutorStateMachine = require('../../../services/tutorStateMachine');
const knowledgeStateService = require('../../../services/knowledgeStateService');
const axios = require('axios');
const { performWebSearch } = require('../../../services/webSearchService');
const socketService = require('../../../services/socketService');
const { triggerPeriodicAnalysis } = require('../../../middleware/contextualMemoryMiddleware');
const log = require('../../../utils/logger');
const { streamEvent, TUTOR_MODE_TYPES, emitTutorKnowledgeEvents } = require('../helpers');
const { computeTurnXp, awardTurnXpAsync, scheduleQualityBonusAsync } = require('../../../services/tutorXpService');
const masteryService = require('../../../services/masteryService'); // [Team8]
const tutorEnhancementService = require('../../../services/tutorEnhancementService'); // [Team8]
const priorKnowledgeDetector = require('../../../services/priorKnowledgeDetector'); // [Team8]

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// [Team8] Select starting Bloom level based on declared difficulty + prior knowledge signal
function selectStartingCognitiveLevel(difficultyLevel, hasPriorKnowledge) {
    if (difficultyLevel === 'advanced') return 'L3_CRITICAL';
    if (difficultyLevel === 'beginner') return 'L1_CONCEPT';
    if (hasPriorKnowledge && difficultyLevel === 'intermediate') return 'L2_APPLICATION';
    return 'L1_CONCEPT';
}

// [Team4] Build optional client timing metadata to pass into processTutorResponse
function buildTutorMetadata(ctx = {}) {
    const meta = {};
    if (ctx.responseTime != null) meta.responseTime = Number(ctx.responseTime);
    if (ctx.clientId) meta.clientId = String(ctx.clientId);
    return meta;
}

/**
 * Build the $each array for ChatHistory push.
 * When isAutoGreeting is true we skip the phantom user message so history stays clean.
 */
function buildMessagesEach(userMessageForDb, aiMessageForDb, isAutoGreeting) {
    return isAutoGreeting ? [aiMessageForDb] : [userMessageForDb, aiMessageForDb];
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL SOCRATIC (no course context)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if this handler handled the request.
 */
async function handleGeneral(res, ctx) {
    const {
        tutorMode, tutorModeType, query, sessionId, userId,
        llmConfig, chatSession, userMessageForDb, contextualMemory,
        isAutoGreeting,
    } = ctx;
    const effectiveQuery = (query === '__tutor_init__') ? '' : query.trim();

    if (!tutorMode || tutorModeType !== TUTOR_MODE_TYPES.GENERAL_SOCRATIC) return false;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendStatus = (status) => streamEvent(res, { type: 'status_update', content: status });

    let tutorState = await getTutorSessionState(sessionId);

    // ── Continue an active general Socratic loop ──────────────────────────────
    if (tutorState && (!tutorState.courseName || tutorState.courseName === 'General')) {
        sendStatus('Evaluating your understanding...');

        let smState = null;
        try {
            smState = await tutorStateMachine.getSessionState(sessionId);
            if (!smState) {
                smState = await tutorStateMachine.initializeSession(sessionId, {
                    topic: tutorState?.teachingUnit || tutorState?.moduleTitle || 'general'
                });
            }
        } catch (smErr) {
            log.warn('TUTOR', `State machine init failed (non-fatal): ${smErr.message}`);
        }

        let currentSmState = smState;  // hoisted — updated after state machine writes

        const tutorResult = await processTutorResponse(
            query.trim(),
            sessionId,
            llmConfig,
            (status) => sendStatus(status),
            (event) => {
                if (typeof event === 'string') {
                    streamEvent(res, { type: 'token', content: event });
                } else {
                    streamEvent(res, event);
                }
            }
        );

        // Update cognitive state from result
        if (tutorResult && tutorResult.classification) {
            try {
                const cls = tutorResult.classification;
                const statusStr = cls?.status || cls;
                let masteryData = null;
                const scoreMap = { CORRECT: 1.0, PARTIAL: 0.5, WRONG: 0, UNKNOWN: 0, INCOMPLETE: 0 };
                await tutorStateMachine.recordStudentResponse(sessionId, {
                    studentResponse: query.trim(),
                    classification: statusStr,
                    score: scoreMap[statusStr] ?? 0,
                    reasoning: cls?.reasoning || null
                });
                masteryData = await tutorStateMachine.checkMastery(sessionId);
                if (masteryData?.achieved) {
                    await tutorStateMachine.advanceLearningStep(sessionId);
                }
                const freshSmState = await tutorStateMachine.getSessionState(sessionId);
                currentSmState = freshSmState;
                if (freshSmState?.consecutiveCorrect >= 2) {
                    await tutorStateMachine.advanceCognitiveLevel(sessionId);
                    currentSmState = await tutorStateMachine.getSessionState(sessionId);
                    await tutorStateMachine.resetHints(sessionId);
                } else if (statusStr === 'WRONG' || statusStr === 'UNKNOWN') {
                    await tutorStateMachine.incrementHints(sessionId);
                }

                const conceptName = tutorState?.teachingUnit || tutorState?.subtopicName || tutorState?.moduleTitle || tutorResult?.moduleTitle || 'general';
                const hintUsed = statusStr === 'WRONG' || statusStr === 'UNKNOWN';
                await emitTutorKnowledgeEvents({ userId, sessionId, statusStr, conceptName, hintUsed, mastered: !!masteryData?.achieved });
            } catch (smUpdateErr) {
                log.warn('TUTOR', `State machine update failed (non-fatal): ${smUpdateErr.message}`);
            }
        }

        // ── Live XP — computed once here, used in reply and deferred award ────
        const _genCls = (() => { const c = tutorResult?.classification; return typeof c === 'object' ? (c?.status || 'UNKNOWN') : (c || 'UNKNOWN'); })();
        const _genCogLvl = currentSmState?.cognitiveLevelName || currentSmState?.cognitiveLevel || tutorState?.cognitiveLevel || 'L1_CONCEPT';
        const _genHints  = tutorState?.hintsGiven || 0;
        const genXpResult = tutorResult ? computeTurnXp(_genCls, _genCogLvl, _genHints) : null;

        if (!tutorResult) {
            const fallbackReply = {
                sender: 'bot', role: 'model',
                text: "Let's restart this Socratic thread. What concept do you want to understand first?",
                parts: [{ text: "Let's restart this Socratic thread. What concept do you want to understand first?" }],
                timestamp: new Date(),
                source_pipeline: 'tutor-general-fallback',
                criticalThinkingCues: []
            };

            streamEvent(res, { type: 'final_answer', content: fallbackReply });
            res.end();

            // Deferred DB write — don't block the response
            setImmediate(async () => {
                try {
                    const _fallbackAiMsg = { role: 'model', parts: [{ text: fallbackReply.text }], timestamp: new Date(), source_pipeline: 'tutor-general-fallback' };
                    await ChatHistory.findOneAndUpdate(
                        { sessionId, userId },
                        {
                            $push: { messages: { $each: buildMessagesEach(userMessageForDb, _fallbackAiMsg, isAutoGreeting) } },
                            $set: { isTutorMode: true, tutorModeType: TUTOR_MODE_TYPES.GENERAL_SOCRATIC, updatedAt: new Date() }
                        },
                        { upsert: true }
                    );
                    const messageCount = (chatSession?.messages?.length || 0) + 2;
                    triggerPeriodicAnalysis(sessionId, userId, messageCount, llmConfig);
                } catch (err) {
                    log.error('TUTOR', `Deferred DB write failed: ${err.message}`);
                }
            });

            return true;
        }

        if (tutorResult.isMastered) {
            const masteredUnit = tutorState.teachingUnit || tutorState.moduleTitle || 'this concept';
            await clearTutorSessionState(sessionId);

            const masteryText = `Great work — you've shown strong understanding of **${masteredUnit}**.\n\nDo you want to go one level deeper, apply it to a real example, or switch topics? Which option do you choose and why?`;
            const masteryReply = {
                sender: 'bot', role: 'model',
                text: masteryText, parts: [{ text: masteryText }],
                timestamp: new Date(),
                source_pipeline: 'tutor-general-mastery',
                socraticState: SOCRATIC_STATES.MASTERY_ACHIEVED,
                thinking: `General Socratic mastery achieved for ${masteredUnit}`,
                criticalThinkingCues: []
            };

            streamEvent(res, { type: 'final_answer', content: masteryReply });
            res.end();

            // Deferred DB write — don't block the response
            setImmediate(async () => {
                try {
                    const _masteryAiMsg = { role: 'model', parts: [{ text: masteryText }], timestamp: new Date(), source_pipeline: 'tutor-general-mastery' };
                    await ChatHistory.findOneAndUpdate(
                        { sessionId, userId },
                        {
                            $push: { messages: { $each: buildMessagesEach(userMessageForDb, _masteryAiMsg, isAutoGreeting) } },
                            $set: { isTutorMode: true, tutorModeType: TUTOR_MODE_TYPES.GENERAL_SOCRATIC, updatedAt: new Date() }
                        },
                        { upsert: true }
                    );
                    const messageCount = (chatSession?.messages?.length || 0) + 2;
                    triggerPeriodicAnalysis(sessionId, userId, messageCount, llmConfig);
                } catch (err) {
                    log.error('TUTOR', `Deferred DB write failed: ${err.message}`);
                }
            });

            return true;
        }

        const socraticReply = {
            sender: 'bot', role: 'model',
            text: tutorResult.followUpQuestion,
            parts: [{ text: tutorResult.followUpQuestion }],
            timestamp: new Date(),
            source_pipeline: `tutor-general-${(tutorResult.pedagogicalMove || 'socratic').toLowerCase()}`,
            socraticState: tutorResult.socraticState,
            thinking: `General Socratic mode. Move: ${tutorResult.pedagogicalMove}. ${tutorResult.reasoning || ''}`,
            criticalThinkingCues: [],
            masteryProgress: tutorResult.masteryProgress || null,
            steps: tutorResult.steps || [],
            confidenceScore: 85,
            xpDelta: genXpResult
        };

        streamEvent(res, { type: 'final_answer', content: socraticReply });
        res.end();

        // Deferred DB write + live XP award — don't block the response
        setImmediate(async () => {
            try {
                const _socraticAiMsg = { role: 'model', parts: [{ text: tutorResult.followUpQuestion }], timestamp: new Date(), source_pipeline: socraticReply.source_pipeline };
                await ChatHistory.findOneAndUpdate(
                    { sessionId, userId },
                    {
                        $push: { messages: { $each: buildMessagesEach(userMessageForDb, _socraticAiMsg, isAutoGreeting) } },
                        $set: { isTutorMode: true, tutorModeType: TUTOR_MODE_TYPES.GENERAL_SOCRATIC, updatedAt: new Date() }
                    },
                    { upsert: true }
                );
                const messageCount = (chatSession?.messages?.length || 0) + 2;
                triggerPeriodicAnalysis(sessionId, userId, messageCount, llmConfig);
            } catch (err) {
                log.error('TUTOR', `Deferred DB write failed: ${err.message}`);
            }
            // Live XP award (deferred — zero latency impact)
            if (genXpResult) {
                const _gConceptName = tutorState?.teachingUnit || tutorState?.moduleTitle || 'general';
                awardTurnXpAsync(userId, genXpResult.xp, _gConceptName, `tutor_${_genCls.toLowerCase()}`);
                scheduleQualityBonusAsync(userId, query.trim(), tutorResult.followUpQuestion, _gConceptName, llmConfig);
            }
        });

        return true;
    }

    // ── Initialize a new general Socratic thread ──────────────────────────────
    sendStatus('Preparing Socratic session...');

    const rawQuery = query.trim();
    let teachingUnit = rawQuery
        .replace(/^(tell me about|explain|what is|what us|how does|teach me|i want to learn about|describe|what's|who is|let'?s?\s*(start|go|begin|learn)\s*(with)?|start\s*(with)?|begin\s*(with)?)\s*/i, '')
        .replace(/\?$/, '')
        .trim();

    teachingUnit = teachingUnit
        ? teachingUnit.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
        : 'General AI Concepts';

    let contextForIntro = '';
    if (contextualMemory?.systemPrompt) {
        contextForIntro = `[STUDENT PROFILE FOR PERSONALIZATION]:\n${contextualMemory.systemPrompt}`;
    }

    // [Team8] Detect prior knowledge from student's initial query — sets starting Bloom level
    let hasPriorKnowledge = false;
    let startingCognitiveLevel = 'L1_CONCEPT';
    try {
        const pkResult = await priorKnowledgeDetector.detectPriorKnowledge(query, teachingUnit);
        hasPriorKnowledge = pkResult?.hasPriorKnowledge || false;
        const difficultyLevel = pkResult?.suggestedLevel || 'beginner';
        startingCognitiveLevel = selectStartingCognitiveLevel(difficultyLevel, hasPriorKnowledge);
        if (hasPriorKnowledge) {
            sendStatus('Detected prior knowledge — adjusting difficulty...');
            log.info('TUTOR', `Prior knowledge detected for "${teachingUnit}" — starting at ${startingCognitiveLevel}`);
        }
    } catch (pkErr) {
        log.warn('TUTOR', `Prior knowledge detection failed (non-fatal): ${pkErr.message}`);
    }
    if (startingCognitiveLevel !== 'L1_CONCEPT') {
        llmConfig = { ...llmConfig, currentCognitiveLevel: startingCognitiveLevel };
    }
    // [/Team8]

    let initialResponse = '';
    try {
        initialResponse = await startSocraticSession(
            teachingUnit,
            contextForIntro,
            llmConfig,
            null,
            (event) => {
                if (typeof event === 'string') {
                    streamEvent(res, { type: 'token', content: event });
                } else {
                    streamEvent(res, event);
                }
            }
        );
    } catch (err) {
        log.warn('TUTOR', `General Socratic init failed: ${err.message}`);
        initialResponse = `Let's explore **${teachingUnit}** together.\n\nTo begin, what do you already believe about this topic?`;
    }

    const generalState = {
        moduleTitle: teachingUnit,
        topic: teachingUnit,
        teachingUnit,
        teachingUnitType: 'general',
        courseName: 'General',
        lastQuestion: initialResponse,
        turnCount: 0,
        startedAt: new Date().toISOString(),
        socraticState: SOCRATIC_STATES.INTRODUCTION,
        masteryScore: 0,
        cognitiveLevel: 'L1_CONCEPT',
        consecutiveWrong: 0,
        hintsGiven: 0,
        history: [],
        consecutiveCorrect: 0,
        learningPath: await buildInitialLearningPath('General', { subtopicName: teachingUnit })
    };
    await setTutorSessionState(sessionId, generalState);

    const introReply = {
        sender: 'bot', role: 'model',
        text: initialResponse, parts: [{ text: initialResponse }],
        timestamp: new Date(),
        source_pipeline: 'tutor-general-introduction',
        socraticState: SOCRATIC_STATES.INTRODUCTION,
        thinking: `General Socratic tutor initialized. Teaching unit: ${teachingUnit}`,
        criticalThinkingCues: []
    };

    const _genIntroAiMsg = { role: 'model', parts: [{ text: initialResponse }], timestamp: new Date(), source_pipeline: 'tutor-general-introduction' };
    await ChatHistory.findOneAndUpdate(
        { sessionId, userId },
        {
            $push: { messages: { $each: buildMessagesEach(userMessageForDb, _genIntroAiMsg, isAutoGreeting) } },
            $set: { isTutorMode: true, tutorModeType: TUTOR_MODE_TYPES.GENERAL_SOCRATIC, courseName: 'General', updatedAt: new Date() }
        },
        { upsert: true }
    );

    const messageCount = (chatSession?.messages?.length || 0) + 2;
    triggerPeriodicAnalysis(sessionId, userId, messageCount, llmConfig);

    streamEvent(res, { type: 'final_answer', content: introReply });
    res.end();
    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSE-STRUCTURED SOCRATIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if this handler handled the request.
 */
async function handleStructured(res, ctx) {
    const {
        tutorMode, tutorModeType, query, sessionId, userId,
        llmConfig, chatSession, userMessageForDb, contextualMemory,
        documentContextName, currentModulePathId, user: reqUser,
        isAutoGreeting,
    } = ctx;
    const effectiveQuery = (query === '__tutor_init__') ? '' : query.trim();

    if (!tutorMode || tutorModeType !== TUTOR_MODE_TYPES.COURSE_STRUCTURED) return false;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendStatus = (status) => streamEvent(res, { type: 'status_update', content: status });

    let tutorState = await getTutorSessionState(sessionId);

    // ── Topic shift detection ─────────────────────────────────────────────────
    if (tutorState) {
        const rawQuery = query.trim();
        const shiftKeywords = /^(tell me about|explain|what is|what us|how does|teach me|i want to learn about|describe|what's|who is|let'?s?\s*(start|go|begin|learn)\s*(with)?|start\s*(with)?|begin\s*(with)?)\s+/i;

        if (shiftKeywords.test(rawQuery)) {
            let extractedTopic = rawQuery
                .replace(shiftKeywords, '')
                .replace(/\?$/, '')
                .trim();

            if (extractedTopic && extractedTopic.length > 2 && extractedTopic.length < 50) {
                const currentUnit = (tutorState.teachingUnit || '').toLowerCase();
                const pivotTopic = extractedTopic.toLowerCase();

                const isRelated = currentUnit.includes(pivotTopic) || pivotTopic.includes(currentUnit) ||
                    (tutorState.moduleName && tutorState.moduleName.toLowerCase().includes(pivotTopic));

                if (!isRelated) {
                    log.info('TUTOR', `Topic shift detected: "${currentUnit}" -> "${extractedTopic}". Resetting.`);
                    await clearTutorSessionState(sessionId);
                    tutorState = null;
                }
            }
        }
    }

    // ── Continue an existing course lesson ────────────────────────────────────
    if (tutorState) {
        log.info('TUTOR', `Continuing lesson "${tutorState.teachingUnit}" (Turn ${tutorState.turnCount})`);

        let smState = null;
        try {
            smState = await tutorStateMachine.getSessionState(sessionId);
            if (!smState) {
                smState = await tutorStateMachine.initializeSession(sessionId, {
                    moduleTitle: tutorState?.moduleTitle,
                    topic: tutorState?.topicName || tutorState?.teachingUnit,
                    subtopic: tutorState?.subtopicName || tutorState?.teachingUnit,
                    moduleId: tutorState?.moduleId,
                    topicId: tutorState?.topicId,
                    subtopicId: tutorState?.subtopicId
                });
            }
        } catch (smErr) {
            log.warn('TUTOR', `State machine init failed (non-fatal): ${smErr.message}`);
        }

        let currentSmState = smState;  // hoisted — updated after cognitive level writes

        // Fetch graph facts (non-blocking — augments context, failure is safe)
        let graphFacts = '';
        try {
            const PYTHON_RAG_SERVICE_URL = process.env.PYTHON_RAG_SERVICE_URL || 'http://localhost:2001';
            const graphRes = await axios.post(
                `${PYTHON_RAG_SERVICE_URL}/graph/search`,
                {
                    query: query.trim(),
                    user_id: userId,
                    document_context: tutorState?.courseName || null,
                },
                { timeout: 3000 }
            );
            if (graphRes.data?.facts) graphFacts = graphRes.data.facts;
        } catch (_gErr) {
            log.debug('TUTOR', `Graph search skipped (non-fatal): ${_gErr.message}`);
        }

        const augmentedQuery = graphFacts
            ? `${query.trim()}\n\n[Graph context: ${graphFacts}]`
            : query.trim();

        const tutorResult = await processTutorResponse(
            augmentedQuery,
            sessionId,
            llmConfig,
            sendStatus,
            (event) => {
                if (typeof event === 'string') {
                    streamEvent(res, { type: 'token', content: event });
                } else {
                    streamEvent(res, event);
                }
            }
        );

        // Update cognitive state from result
        if (tutorResult && tutorResult.classification) {
            try {
                const cls = tutorResult.classification;
                const statusStr = cls?.status || cls;
                let masteryData = null;
                const scoreMap = { CORRECT: 1.0, PARTIAL: 0.5, WRONG: 0, UNKNOWN: 0, INCOMPLETE: 0 };
                await tutorStateMachine.recordStudentResponse(sessionId, {
                    studentResponse: query.trim(),
                    classification: statusStr,
                    score: scoreMap[statusStr] ?? 0,
                    reasoning: cls?.reasoning || null
                });
                masteryData = await tutorStateMachine.checkMastery(sessionId);
                if (masteryData?.achieved) {
                    await tutorStateMachine.advanceLearningStep(sessionId);
                }
                const freshSmState = await tutorStateMachine.getSessionState(sessionId);
                currentSmState = freshSmState;
                if (freshSmState?.consecutiveCorrect >= 2) {
                    await tutorStateMachine.advanceCognitiveLevel(sessionId);
                    currentSmState = await tutorStateMachine.getSessionState(sessionId);
                    await tutorStateMachine.resetHints(sessionId);
                } else if (statusStr === 'WRONG' || statusStr === 'UNKNOWN') {
                    await tutorStateMachine.incrementHints(sessionId);
                }

                const conceptName = tutorState?.teachingUnit || tutorState?.subtopicName || tutorState?.moduleTitle || tutorResult?.moduleTitle || 'general';
                const hintUsed = statusStr === 'WRONG' || statusStr === 'UNKNOWN';
                await emitTutorKnowledgeEvents({ userId, sessionId, statusStr, conceptName, hintUsed, mastered: !!masteryData?.achieved });
            } catch (smUpdateErr) {
                log.warn('TUTOR', `State machine update failed (non-fatal): ${smUpdateErr.message}`);
            }
        }

        // ── Live XP — pure computation (zero I/O), included in reply for instant display
        const _strCls = (() => { const c = tutorResult?.classification; return typeof c === 'object' ? (c?.status || 'UNKNOWN') : (c || 'UNKNOWN'); })();
        const _strCogLvl = currentSmState?.cognitiveLevelName || currentSmState?.cognitiveLevel || tutorState?.cognitiveLevel || 'L1_CONCEPT';
        const _strHints  = tutorState?.hintsGiven || 0;
        const xpResult  = tutorResult ? computeTurnXp(_strCls, _strCogLvl, _strHints, !!tutorResult.isMastered) : null;

        if (!tutorResult) {
            log.error('TUTOR', 'Failed to generate tutor response - LLM service unavailable');
            const errorReply = {
                sender: 'bot', role: 'model',
                text: "I'm having trouble connecting to the AI service right now. This is temporary. Please try again in a moment, or you can:\n\n- **Retry** the question\n- **Change topics** to a different module\n- **Switch to regular chat mode** while I recover\n\nWe apologize for the interruption!",
                parts: [{ text: "I'm having trouble connecting to the AI service right now. This is temporary. Please try again in a moment, or you can:\n\n- **Retry** the question\n- **Change topics** to a different module\n- **Switch to regular chat mode** while I recover\n\nWe apologize for the interruption!" }],
                timestamp: new Date(),
                source_pipeline: 'tutor-error-recovery',
                confidenceScore: 0,
                isError: true
            };
            streamEvent(res, { type: 'final_answer', content: errorReply });
            res.end();
            return true;
        }

        // ── Mastery handling ──────────────────────────────────────────────────
        if (tutorResult.isMastered) {
            log.success('SUCCESS', `Mastery achieved for: "${tutorState.teachingUnit || tutorResult.moduleTitle}"`);

            let finalReplyText = tutorResult.followUpQuestion;
            let nextTopicState = null;
            let advanceResult = null;

            const courseName = tutorState.courseName || documentContextName;
            if (courseName && courseName !== 'General') {
                let completedSubtopics = [];
                let completedTopics = [];

                try {
                    const currentUser = await User.findById(reqUser._id);
                    const userProgress = currentUser?.curriculumProgress?.get(courseName);
                    completedSubtopics = userProgress?.completedSubtopics || [];
                    completedTopics = userProgress?.completedTopics || [];
                } catch (e) {
                    log.warn('TUTOR', `Progress fetch failed: ${e.message}`);
                }

                const currentPosition = {
                    moduleIndex: tutorState.moduleIndex || 0,
                    topicIndex: tutorState.topicIndex || 0,
                    subtopicIndex: tutorState.subtopicIndex || 0,
                    subtopicId: tutorState.subtopicId,
                    subtopicName: tutorState.subtopicName,
                    topicId: tutorState.topicId,
                    topicName: tutorState.topicName,
                    moduleName: tutorState.moduleName,
                    teachingUnitId: tutorState.subtopicId || tutorState.topicId,
                    teachingUnitType: tutorState.teachingUnitType || 'subtopic',
                    isLastInTopic: tutorState.isLastInTopic || false,
                    isLastInModule: tutorState.isLastInModule || false
                };

                advanceResult = await advanceToNextSubtopic(courseName, currentPosition, completedSubtopics, completedTopics);

                if (advanceResult.completedSubtopics.length > completedSubtopics.length || advanceResult.topicJustCompleted || advanceResult.moduleJustCompleted) {
                    try {
                        const userToUpdate = await User.findById(reqUser._id);
                        if (userToUpdate) {
                            if (!userToUpdate.curriculumProgress) {
                                userToUpdate.curriculumProgress = new Map();
                            }
                            const existingProgress = userToUpdate.curriculumProgress.get(courseName) || {};
                            userToUpdate.curriculumProgress.set(courseName, {
                                completedSubtopics: advanceResult.completedSubtopics,
                                completedTopics: advanceResult.completedTopics,
                                completedModules: [
                                    ...new Set([
                                        ...(existingProgress.completedModules || []),
                                        ...(advanceResult.moduleJustCompleted && tutorState.moduleId ? [tutorState.moduleId] : [])
                                    ])
                                ],
                                lastActiveDate: new Date()
                            });
                            await userToUpdate.save();
                            log.info('DB', `Progress updated for ${courseName}.`);
                        }
                    } catch (updateErr) {
                        log.error('DB', `Failed to update progress: ${updateErr.message}`);
                    }
                }

                if (advanceResult.nextPosition && !advanceResult.nextPosition.isComplete) {
                    const nextUnit = advanceResult.nextPosition.teachingUnit;
                    log.info('TUTOR', `Advancing to next unit: "${nextUnit}"`);
                    sendStatus(`Preparing next lesson: ${nextUnit}...`);

                    let nextRagContext = '';
                    try {
                        const nextContextData = await getSubtopicContext(courseName, advanceResult.nextPosition.subtopicId, advanceResult.nextPosition.topicId);
                        if (nextContextData?.qdrant_chunks && nextContextData.qdrant_chunks.length > 0) {
                            nextRagContext = nextContextData.qdrant_chunks.map(chunk => chunk.text).join('\n\n').slice(0, 1500);
                            log.info('TOT', `RAG Context injected for "${nextUnit}"`);
                        } else {
                            log.info('RESEARCH', `No RAG info. Using web search for "${nextUnit}"`);
                            const searchResult = await performWebSearch(`${nextUnit} concept explanation`);
                            if (searchResult && searchResult.toolOutput) {
                                nextRagContext = `[WEB SEARCH CONTEXT]:\n${searchResult.toolOutput.slice(0, 1500)}`;
                            }
                        }
                    } catch (ctxErr) {
                        log.warn('TUTOR', `Next unit context failed: ${ctxErr.message}`);
                    }

                    let nextEnhancedContext = nextRagContext;
                    if (contextualMemory?.systemPrompt) {
                        nextEnhancedContext += `\n\n[STUDENT PROFILE]:\n${contextualMemory.systemPrompt}`;
                    }

                    const nextIntro = await startSocraticSession(nextUnit, nextEnhancedContext, llmConfig, advanceResult.nextPosition);

                    let transitionParts = [];
                    transitionParts.push(`Great job! You've mastered **${tutorState.teachingUnit || tutorResult.moduleTitle}**.`);

                    if (advanceResult.topicJustCompleted) {
                        transitionParts.push(`We've also finished the whole topic on **${advanceResult.topicCompletedName}**.`);
                    }

                    transitionParts.push(`Let's move on to the next idea:\n\n${nextIntro}`);
                    finalReplyText = transitionParts.join(' ');

                    await clearTutorSessionState(sessionId);
                    nextTopicState = {
                        moduleId: advanceResult.nextPosition.moduleId,
                        moduleName: advanceResult.nextPosition.moduleName,
                        moduleIndex: advanceResult.nextPosition.moduleIndex,
                        topicId: advanceResult.nextPosition.topicId,
                        topicName: advanceResult.nextPosition.topicName,
                        topicIndex: advanceResult.nextPosition.topicIndex,
                        subtopicId: advanceResult.nextPosition.subtopicId,
                        subtopicName: advanceResult.nextPosition.subtopicName,
                        subtopicIndex: advanceResult.nextPosition.subtopicIndex,
                        teachingUnit: nextUnit,
                        teachingUnitType: advanceResult.nextPosition.teachingUnitType,
                        isLastInTopic: advanceResult.nextPosition.isLastInTopic,
                        isLastInModule: advanceResult.nextPosition.isLastInModule,
                        courseName,
                        moduleTitle: nextUnit,
                        lastQuestion: nextIntro,
                        turnCount: 0,
                        startedAt: new Date().toISOString(),
                        socraticState: SOCRATIC_STATES.INTRODUCTION,
                        masteryScore: 0,
                        // Carry forward the cognitive level the student demonstrated.
                        // The Socratic engine will adapt down if they struggle at this level.
                        cognitiveLevel: currentSmState?.cognitiveLevelName || currentSmState?.cognitiveLevel || 'L1_CONCEPT',
                        history: [],
                        consecutiveUnderstands: 0
                    };
                    await setTutorSessionState(sessionId, nextTopicState);
                } else if (advanceResult.nextPosition?.isComplete) {
                    await clearTutorSessionState(sessionId);
                    finalReplyText = `🎉 **Congratulations!**\n\nYou've mastered **${tutorState.teachingUnit || tutorResult.moduleTitle}** and completed the entire **${courseName}** curriculum!\n\nThis is a major achievement in your learning journey. Would you like to:\n\n- **Review** any specific topic\n- Start a **new course**\n- Take a **final assessment**\n- Explore related **advanced concepts**`;
                } else {
                    await clearTutorSessionState(sessionId);
                    finalReplyText = `🎉 **Mastery Achieved!** You've completed your current goal of mastering **${tutorState.teachingUnit || tutorResult.moduleTitle}**.\n\nWhat would you like to learn next?`;
                }
            } else {
                await clearTutorSessionState(sessionId);
            }

            const masteryReply = {
                sender: 'bot', role: 'model',
                text: finalReplyText, parts: [{ text: finalReplyText }],
                timestamp: new Date(),
                source_pipeline: 'tutor-mastery',
                socraticState: nextTopicState ? SOCRATIC_STATES.INTRODUCTION : tutorResult.socraticState,
                thinking: `Mastery achieved for "${tutorResult.moduleTitle}". Auto-advanced: ${nextTopicState ? 'Yes' : 'No'}.`,
                criticalThinkingCues: [],
                xpDelta: xpResult  // includes mastery bonus (isMastery=true was passed to computeTurnXp)
            };

            const aiMessageForDb = {
                role: 'model', parts: [{ text: finalReplyText }],
                timestamp: new Date(), source_pipeline: 'tutor-mastery'
            };
            await ChatHistory.findOneAndUpdate(
                { sessionId, userId },
                {
                    $push: { messages: { $each: buildMessagesEach(userMessageForDb, aiMessageForDb, isAutoGreeting), $slice: -100 } },
                    $set: { isTutorMode: true, tutorModeType: 'structured', updatedAt: new Date() }
                },
                { upsert: true }
            );

            const messageCount = (chatSession?.messages?.length || 0) + 2;
            triggerPeriodicAnalysis(sessionId, userId, messageCount, llmConfig);

            // Build the accumulated completedModules list for the event
            const updatedCompletedModules = [
                ...new Set([
                    ...(advanceResult?.moduleJustCompleted && tutorState.moduleId
                        ? [...(completedTopics || []), tutorState.moduleId]
                        : []),
                ])
            ];
            // Re-read the saved DB value to get accurate completedModules
            let dbCompletedModules = [];
            try {
                const freshUser = await User.findById(reqUser._id).select('curriculumProgress');
                dbCompletedModules = freshUser?.curriculumProgress?.get(courseName)?.completedModules || [];
            } catch (_) {}

            const progressUpdate = {
                type: 'progress_update',
                content: {
                    courseName,
                    masteredSubtopicId: tutorState.subtopicId,
                    masteredSubtopicName: tutorState.subtopicName || tutorState.teachingUnit,
                    masteredTopicId: advanceResult?.topicJustCompleted ? tutorState.topicId : null,
                    masteredTopicName: advanceResult?.topicCompletedName || null,
                    masteredModuleId: advanceResult?.moduleJustCompleted ? tutorState.moduleId : null,
                    masteredModuleName: advanceResult?.moduleCompletedName || null,
                    completedSubtopics: advanceResult?.completedSubtopics || [],
                    completedTopics: advanceResult?.completedTopics || [],
                    completedModules: dbCompletedModules,
                    currentPosition: nextTopicState ? {
                        subtopicId: nextTopicState.subtopicId,
                        subtopicName: nextTopicState.subtopicName,
                        topicId: nextTopicState.topicId,
                        topicName: nextTopicState.topicName,
                        moduleId: nextTopicState.moduleId,
                        moduleName: nextTopicState.moduleName,
                        teachingUnit: nextTopicState.teachingUnit
                    } : null,
                    isCourseComplete: advanceResult?.nextPosition?.isComplete || false
                }
            };
            streamEvent(res, progressUpdate);

            masteryReply.currentPosition = progressUpdate.content.currentPosition;
            masteryReply.progressUpdate = progressUpdate.content;

            streamEvent(res, { type: 'final_answer', content: masteryReply });
            res.end();

            // Deferred live XP award for mastery turn
            setImmediate(() => {
                if (xpResult) {
                    const _mConceptName = tutorState?.teachingUnit || tutorState?.subtopicName || 'general';
                    // Base turn XP + mastery bonus are combined inside xpResult.xp (isMastery=true)
                    awardTurnXpAsync(userId, xpResult.xp, _mConceptName, 'tutor_mastery');
                    scheduleQualityBonusAsync(userId, query.trim(), finalReplyText, _mConceptName, llmConfig);
                }
            });

            return true;
        }
        // ── End mastery handling ──────────────────────────────────────────────

        log.success('TUTOR', `Follow-up generated (Move: ${tutorResult.pedagogicalMove})`);

        const socraticReply = {
            sender: 'bot', role: 'model',
            text: tutorResult.followUpQuestion,
            parts: [{ text: tutorResult.followUpQuestion }],
            timestamp: new Date(),
            source_pipeline: `tutor-${tutorResult.pedagogicalMove?.toLowerCase() || 'socratic'}`,
            socraticState: tutorResult.socraticState,
            thinking: `Classification: ${tutorResult.classification}. Move: ${tutorResult.pedagogicalMove}. ${tutorResult.reasoning || ''}`,
            criticalThinkingCues: [],
            masteryProgress: tutorResult.masteryProgress || null,
            steps: tutorResult.steps || [],
            confidenceScore: 85,
            xpDelta: xpResult,
            currentPosition: {
                subtopicId: tutorState.subtopicId,
                subtopicName: tutorState.subtopicName,
                topicId: tutorState.topicId,
                topicName: tutorState.topicName,
                moduleId: tutorState.moduleId,
                moduleName: tutorState.moduleName,
                teachingUnit: tutorState.teachingUnit,
                courseName: tutorState.courseName
            }
        };

        const aiMessageForDb = {
            role: 'model', parts: [{ text: tutorResult.followUpQuestion }],
            timestamp: new Date(), source_pipeline: socraticReply.source_pipeline
        };
        await ChatHistory.findOneAndUpdate(
            { sessionId, userId },
            {
                $push: { messages: { $each: buildMessagesEach(userMessageForDb, aiMessageForDb, isAutoGreeting), $slice: -100 } },
                $set: { isTutorMode: true, tutorModeType: 'structured', updatedAt: new Date() }
            },
            { upsert: true }
        );

        const messageCount = (chatSession?.messages?.length || 0) + 2;
        triggerPeriodicAnalysis(sessionId, userId, messageCount, llmConfig);

        streamEvent(res, { type: 'final_answer', content: socraticReply });
        res.end();

        // Deferred live XP award — zero latency impact
        setImmediate(() => {
            if (xpResult) {
                const _sConceptName = tutorState?.teachingUnit || tutorState?.subtopicName || 'general';
                awardTurnXpAsync(userId, xpResult.xp, _sConceptName, `tutor_${_strCls.toLowerCase()}`);
                scheduleQualityBonusAsync(userId, query.trim(), tutorResult.followUpQuestion, _sConceptName, llmConfig);
            }
        });

        return true;
    }

    // ── Auto-initialize new tutor session (curriculum-driven) ─────────────────
    const courseName = documentContextName || 'General';
    log.info('TUTOR', `Initializing new tutor session for ${courseName}`);
    sendStatus('Resolving curriculum position…');

    let completedSubtopics = [];
    let completedTopics = [];
    let completedModules = [];

    if (courseName !== 'General' && reqUser) {
        try {
            const currentUser = await User.findById(reqUser._id);
            const userProgress = currentUser?.curriculumProgress?.get(courseName);
            completedSubtopics = userProgress?.completedSubtopics || [];
            completedTopics = userProgress?.completedTopics || [];
            completedModules = userProgress?.completedModules || [];
        } catch (e) {
            log.warn('TUTOR', `Pre-init progress fetch failed: ${e.message}`);
        }
    }

    let position = null;
    let teachingUnit = '';

    if (courseName !== 'General') {
        try {
            position = await resolveCurrentPosition(courseName, completedSubtopics, completedTopics, currentModulePathId);

            if (position && position.teachingUnit) {
                teachingUnit = position.teachingUnit;
                log.info('TUTOR', `Lesson Plan: "${teachingUnit}"`);
            } else if (position?.isComplete) {
                const completionReply = {
                    sender: 'bot', role: 'model',
                    text: `🎉 **Congratulations!** You have completed the entire **${courseName}** ${currentModulePathId ? 'module' : 'curriculum'}!\n\nWould you like to:\n- **Review** any topic\n- Start a **different course**\n- Do some **practice questions**`,
                    parts: [{ text: `🎉 **Congratulations!** You have completed the entire **${courseName}** ${currentModulePathId ? 'module' : 'curriculum'}!\n\nWould you like to:\n- **Review** any topic\n- Start a **different course**\n- Do some **practice questions**` }],
                    timestamp: new Date(),
                    source_pipeline: 'tutor-completion',
                    socraticState: SOCRATIC_STATES.MASTERY_ACHIEVED,
                    thinking: 'All curriculum items mastered.',
                    criticalThinkingCues: []
                };

                const aiMessageForDb = {
                    role: 'model', parts: [{ text: completionReply.text }],
                    timestamp: new Date(), source_pipeline: 'tutor-completion'
                };
                await ChatHistory.findOneAndUpdate(
                    { sessionId, userId },
                    { $push: { messages: { $each: buildMessagesEach(userMessageForDb, aiMessageForDb, isAutoGreeting), $slice: -100 } } },
                    { upsert: true }
                );

                streamEvent(res, { type: 'final_answer', content: completionReply });
                res.end();
                return true;
            }
        } catch (err) {
            if (err.code === 'CURRICULUM_EMPTY') {
                log.error('TUTOR', `Curriculum empty for '${courseName}': ${err.message}`);
                streamEvent(res, { type: 'error', content: err.message });
                res.end();
                return true;
            }
            log.warn('TUTOR', `Position resolution failed: ${err.message}`);
        }
    }

    if (!teachingUnit) {
        const rawQuery = query.trim();
        let extracted = rawQuery
            .replace(/^(tell me about|explain|what is|what us|how does|teach me|i want to learn about|describe|what's|who is|let'?s?\s*(start|go|begin|learn)\s*(with)?|start\s*(with)?|begin\s*(with)?)\s*/i, '')
            .replace(/\?$/, '')
            .trim();

        extracted = extracted.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');

        teachingUnit = (extracted && extracted.length > 2) ? extracted : (courseName !== 'General' ? courseName : 'General Concepts');
    }

    sendStatus(`Preparing lesson on ${teachingUnit}…`);

    let ragContext = '';
    let contextualMemoryText = '';
    let strugglingTopics = [];

    try {
        log.info('TUTOR', 'Fetching contextual memory and student trace...');
        sendStatus('Loading student profile...');
        const [memoryContext, struggles] = await Promise.all([
            knowledgeStateService.getContextualMemory(userId, teachingUnit),
            knowledgeStateService.getStrugglingTopics(userId)
        ]);
        contextualMemoryText = memoryContext || '';
        strugglingTopics = struggles || [];

        if (contextualMemoryText) {
            log.info('SYSTEM', 'Contextual memory successfully loaded.');
        }
    } catch (memErr) {
        log.error('SYSTEM', 'Contextual memory fetch failed', memErr);
    }

    try {
        log.info('TUTOR', `Starting RAG context fetch for unit: ${teachingUnit}`);
        sendStatus('Gathering knowledge from course curriculum...');
        const subtopicId = position?.subtopicId;
        const topicId = position?.topicId;

        const contextData = await getSubtopicContext(courseName, subtopicId, topicId);
        if (contextData && contextData.qdrant_chunks && contextData.qdrant_chunks.length > 0) {
            ragContext = contextData.qdrant_chunks.map(chunk => chunk.text).join('\n\n').slice(0, 1500);
            log.info('SYSTEM', `Injected ${contextData.qdrant_chunks.length} RAG chunks`);
        } else {
            log.info('SYSTEM', `No local RAG results for "${teachingUnit}". Relying on LLM internal knowledge...`);
            ragContext = '';
        }
    } catch (e) {
        log.warn('SYSTEM', `Context fetch failed: ${e.message}`);
        ragContext = ragContext || '';
    }

    ragContext = ragContext || '';

    let initialResponse = '';
    try {
        log.info('TUTOR', `Starting LLM generation for: ${teachingUnit}...`);
        sendStatus(`Generating Socratic introduction for ${teachingUnit}...`);
        const topicContext = position?.topicName ? `(part of ${position.topicName})` : '';
        const moduleContext = position?.moduleName ? `in ${position.moduleName}` : '';

        let enhancedContext = ragContext;

        if (topicContext) {
            enhancedContext += `\n\nThis subtopic ${topicContext} ${moduleContext}.`;
        }

        if (contextualMemoryText) {
            enhancedContext += `\n\n[STUDENT PROFILE FOR PERSONALIZATION]:\n${contextualMemoryText}`;
        }

        if (strugglingTopics.length > 0) {
            const strugglingNames = strugglingTopics.map(t => t.conceptName || t.name).join(', ');
            enhancedContext += `\n\n[STUDENT STRUGGLES]: The student has previously struggled with: ${strugglingNames}. Provide extra guidance if this topic relates.`;
        }

        // Prerequisite check — non-blocking, injects warning into context if gaps found
        if (position?.topicId && courseName !== 'General') {
            try {
                const PYTHON_RAG_SERVICE_URL = process.env.PYTHON_RAG_SERVICE_URL || 'http://localhost:2001';
                const prereqRes = await axios.post(
                    `${PYTHON_RAG_SERVICE_URL}/course/${encodeURIComponent(courseName)}/topic/${encodeURIComponent(position.topicId)}/missing-prerequisites`,
                    { completed_subtopic_ids: completedSubtopics },
                    { timeout: 5000 }
                );
                const missing = prereqRes.data?.missing_prerequisites || [];
                if (missing.length > 0) {
                    const names = missing.map(p => p.name || p.id).join(', ');
                    enhancedContext += `\n\n[PREREQUISITE ALERT]: Student may benefit from reviewing: ${names}.`;
                    log.info('TUTOR', `Prerequisite gaps detected: ${names}`);
                }
            } catch (prereqErr) {
                log.warn('TUTOR', `Prereq check skipped (non-fatal): ${prereqErr.message}`);
            }
        }

        initialResponse = await startSocraticSession(
            teachingUnit,
            enhancedContext,
            llmConfig,
            position,
            (event) => {
                if (typeof event === 'string') {
                    streamEvent(res, { type: 'token', content: event });
                } else {
                    streamEvent(res, event);
                }
            }
        );
        log.success('TUTOR', `LLM generation complete for ${teachingUnit}`);
    } catch (err) {
        log.error('TUTOR', `Error in startSocraticSession: ${err.message}`, err);
        initialResponse = `Let's dive into **${teachingUnit}**!\n\nTo get started, can you tell me what you already know about this topic?`;
    }

    sendStatus(`Starting lesson on ${teachingUnit}…`);

    const newTutorState = {
        moduleId: position?.moduleId || null,
        moduleName: position?.moduleName || null,
        moduleIndex: position?.moduleIndex ?? 0,
        moduleTitle: teachingUnit,
        topicId: position?.topicId || null,
        topicName: position?.topicName || null,
        topicIndex: position?.topicIndex ?? 0,
        subtopicId: position?.subtopicId || null,
        subtopicName: position?.subtopicName || null,
        subtopicIndex: position?.subtopicIndex ?? 0,
        teachingUnit,
        teachingUnitType: position?.teachingUnitType || 'topic',
        courseName,
        isLastInTopic: position?.isLastInTopic || false,
        isLastInModule: position?.isLastInModule || false,
        lastQuestion: initialResponse,
        turnCount: 0,
        startedAt: new Date().toISOString(),
        socraticState: SOCRATIC_STATES.INTRODUCTION,
        masteryScore: 0,
        cognitiveLevel: 'L1_CONCEPT',
        topic: position?.subtopicName || position?.topicName || teachingUnit,
        consecutiveWrong: 0,
        hintsGiven: 0,
        history: [],
        learningPath: await buildInitialLearningPath(courseName, position)
    };

    await setTutorSessionState(sessionId, newTutorState);

    await saveUserProgress(userId.toString(), courseName, {
        completedSubtopics,
        completedTopics,
        completedModules,
        currentPosition: position,
        lastActiveDate: new Date().toISOString()
    });

    const introReply = {
        sender: 'bot', role: 'model',
        text: initialResponse, parts: [{ text: initialResponse }],
        timestamp: new Date(),
        source_pipeline: 'tutor-introduction',
        socraticState: SOCRATIC_STATES.INTRODUCTION,
        thinking: `Curriculum-driven tutor initialized. Teaching: "${teachingUnit}" (${position?.teachingUnitType || 'topic'}) in ${position?.moduleName || courseName}.`,
        currentPosition: position,
        criticalThinkingCues: []
    };

    const aiMessageForDb = {
        role: 'model', parts: [{ text: initialResponse }],
        timestamp: new Date(), source_pipeline: 'tutor-introduction'
    };
    await ChatHistory.findOneAndUpdate(
        { sessionId, userId },
        {
            $push: { messages: { $each: buildMessagesEach(userMessageForDb, aiMessageForDb, isAutoGreeting), $slice: -100 } },
            $set: { isTutorMode: true, tutorModeType: 'structured', courseName, updatedAt: new Date() }
        },
        { upsert: true }
    );

    streamEvent(res, { type: 'final_answer', content: introReply });
    res.end();
    return true;
}

module.exports = { handleGeneral, handleStructured };
