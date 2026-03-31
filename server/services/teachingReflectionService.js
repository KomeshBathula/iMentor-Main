// server/services/teachingReflectionService.js
// Post-turn reflection: analyses what happened, produces a learning adjustment.

/**
 * After each student turn, reflect on the teaching outcome and produce:
 *  - An adjustment action (or null if nothing needs changing)
 *  - A note to log for learning analytics
 *  - A recommended system-prompt patch that will be applied in the NEXT turn
 */
function reflectOnTeaching(state = {}) {
    const {
        consecutiveWrong = 0,
        hintsGiven = 0,
        masteryScore = 0,
        learningPath = null,
        turnCount = 0,
        lastAction = null,
        lastStudentResponse = '',
        cognitiveLevel = 'L1_CONCEPT',
        emotionalState = null,
        understandingLevel = null,
        sessionDurationMinutes = 0,
    } = state;

    const results = [];

    // ── 1. Persistent confusion detection ─────────────────────────────────────
    if (consecutiveWrong >= 3) {
        results.push({
            action: 'RETEACH_CONCEPT',
            note: `Student answered incorrectly ${consecutiveWrong} times in a row. Switching to re-teaching mode.`,
            promptPatch: 'The student is struggling. Start over with a simpler explanation and a relatable analogy before asking any question.',
            priority: 10,
        });
    }

    // ── 2. Hint overuse ───────────────────────────────────────────────────────
    if (hintsGiven >= 3 && lastAction !== 'SIMPLIFY_PROBLEM') {
        results.push({
            action: 'SIMPLIFY_PROBLEM',
            note: `${hintsGiven} hints given; problem may be beyond current level.`,
            promptPatch: 'Break the current problem into smaller, more manageable steps. Reduce complexity before asking again.',
            priority: 8,
        });
    }

    // ── 3. Ready to skip ahead ─────────────────────────────────────────────────
    if (masteryScore >= 0.9 && consecutiveWrong === 0 && turnCount >= 2) {
        results.push({
            action: 'SKIP_AHEAD',
            note: `High mastery (${Math.round(masteryScore * 100)}%). Student ready for next sub-topic.`,
            promptPatch: 'The student has demonstrated strong understanding. Acknowledge this clearly, then introduce the next concept.',
            priority: 7,
        });
    }

    // ── 4. First-turn stumble ─────────────────────────────────────────────────
    if (learningPath && learningPath.currentStep === 0 && consecutiveWrong >= 2) {
        results.push({
            action: 'EXPLAIN_CONCEPT',
            note: 'Student struggled at the very start; need to provide foundational explanation first.',
            promptPatch: 'Before asking any more questions, provide a clear introductory explanation of the fundamental idea.',
            priority: 9,
        });
    }

    // ── 5. Emotional state: frustration / anxiety ─────────────────────────────
    if (emotionalState === 'FRUSTRATION' || emotionalState === 'ANXIETY') {
        results.push({
            action: 'ENCOURAGE',
            note: `Emotional state detected: ${emotionalState}. Inserting encouragement.`,
            promptPatch: 'Before your next question, briefly acknowledge that this is a challenging topic and offer genuine encouragement. Keep the tone warm and patient.',
            priority: 6,
        });
    }

    // ── 6. Long session fatigue ───────────────────────────────────────────────
    if (sessionDurationMinutes >= 30 && turnCount % 10 === 0 && turnCount > 0) {
        results.push({
            action: 'TAKE_BREAK_SUGGESTION',
            note: `Session running for ${sessionDurationMinutes} minutes. Suggest a break.`,
            promptPatch: 'After your response, gently suggest that the student take a short break if they feel tired — spaced practice improves retention.',
            priority: 3,
        });
    }

    // ── 7. Comprehension check after long explanation ─────────────────────────
    if (lastAction === 'EXPLAIN_CONCEPT' && consecutiveWrong === 0 && turnCount > 0) {
        results.push({
            action: 'ASK_COMPREHENSION_CHECK',
            note: 'Just explained a concept; checking if student understood.',
            promptPatch: 'You just provided an explanation. Now ask a single targeted question to check whether the student understood it.',
            priority: 4,
        });
    }

    if (results.length === 0) return null;

    // Return the highest-priority adjustment
    results.sort((a, b) => b.priority - a.priority);
    const top = results[0];
    return {
        action: top.action,
        note: top.note,
        promptPatch: top.promptPatch,
        allAdjustments: results.map(r => r.action),
    };
}

/**
 * Build a compact summary string of the session quality for logging.
 */
function buildSessionQualitySummary(state = {}) {
    const { masteryScore = 0, turnCount = 0, hintsGiven = 0, consecutiveWrong = 0 } = state;
    const mastery = Math.round((masteryScore || 0) * 100);
    const engagement = turnCount > 10 ? 'high' : turnCount > 4 ? 'medium' : 'low';
    const difficulty = consecutiveWrong >= 3 ? 'over-challenged' : hintsGiven >= 3 ? 'challenged' : 'appropriate';
    return `mastery=${mastery}% | turns=${turnCount} | engagement=${engagement} | difficulty=${difficulty}`;
}

module.exports = {
    reflectOnTeaching,
    buildSessionQualitySummary,
};
