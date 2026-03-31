/**
 * Tutor State Machine — T6-2 Fix
 *
 * Replaces the old 7-line UI-label stub with a proper pedagogical FSM.
 * All state constants here are kept in sync with socraticTutorService.js.
 *
 * STATES (pedagogical):
 *  IDLE → initial state before a session starts
 *  ASSESSING → evaluating a student response
 *  HOOKING → re-engaging via analogy / real-world connection
 *  SCAFFOLDING → providing structured hints/examples
 *  VERIFYING → checking mastery with deeper questions
 *  ADVANCING → moving to the next concept
 *  MASTERY_ACHIEVED → topic mastered; session can end
 *
 * COGNITIVE LEVELS (Bloom's Taxonomy):
 *  L1 REMEMBER → basic recall
 *  L2 UNDERSTAND → explain in own words
 *  L3 APPLY → use in a new context
 *  L4 ANALYZE → reason about trade-offs/connections
 */

// ─── States ────────────────────────────────────────────────────────────────

const STATES = {
  IDLE: 'IDLE',
  ASSESSING: 'ASSESSING',
  HOOKING: 'HOOKING',
  SCAFFOLDING: 'SCAFFOLDING',
  VERIFYING: 'VERIFYING',
  ADVANCING: 'ADVANCING',
  MASTERY_ACHIEVED: 'MASTERY_ACHIEVED',
};

// ─── Cognitive Levels ───────────────────────────────────────────────────────

const COGNITIVE_LEVELS = {
  L1_REMEMBER: 1,
  L2_UNDERSTAND: 2,
  L3_APPLY: 3,
  L4_ANALYZE: 4,
};

// ─── Support Levels ─────────────────────────────────────────────────────────

const SUPPORT_LEVELS = {
  MINIMAL: 'MINIMAL',        // Pure Socratic questioning — student is doing well
  GUIDED: 'GUIDED',          // Question + hint
  SCAFFOLDED: 'SCAFFOLDED',  // Example + explanation
  DIRECT: 'DIRECT',          // Direct reteaching
};

// ─── Mastery Thresholds ─────────────────────────────────────────────────────

const MASTERY = {
  THRESHOLD_SCORE: 80,       // Score >= 80 means mastered
  MAX_SCORE: 100,
  MIN_SCORE: 0,
  SCORE_CORRECT: 20,         // Points gained per correct answer
  SCORE_PARTIAL: 10,         // Points gained for partial answer
  SCORE_WRONG: -10,          // Points lost for wrong / no-foundation
  MAX_STRUGGLE_COUNT: 3,     // Force DIRECT support after this many struggles
};

// ─── Transition Table ───────────────────────────────────────────────────────
// Maps (currentState, understanding) → nextState

const TRANSITIONS = {
  [STATES.IDLE]: {
    default: STATES.ASSESSING,
  },
  [STATES.ASSESSING]: {
    CORRECT: STATES.ADVANCING,
    PARTIAL: STATES.HOOKING,
    VAGUE: STATES.HOOKING,
    MISCONCEPTION: STATES.SCAFFOLDING,
    NO_FOUNDATION: STATES.SCAFFOLDING,
    default: STATES.HOOKING,
  },
  [STATES.HOOKING]: {
    CORRECT: STATES.VERIFYING,
    PARTIAL: STATES.SCAFFOLDING,
    VAGUE: STATES.SCAFFOLDING,
    MISCONCEPTION: STATES.SCAFFOLDING,
    NO_FOUNDATION: STATES.SCAFFOLDING,
    default: STATES.SCAFFOLDING,
  },
  [STATES.SCAFFOLDING]: {
    CORRECT: STATES.VERIFYING,
    PARTIAL: STATES.HOOKING,
    VAGUE: STATES.HOOKING,
    MISCONCEPTION: STATES.SCAFFOLDING, // repeat if still misconception
    NO_FOUNDATION: STATES.SCAFFOLDING,
    default: STATES.HOOKING,
  },
  [STATES.VERIFYING]: {
    CORRECT: STATES.ADVANCING,
    PARTIAL: STATES.HOOKING,
    VAGUE: STATES.HOOKING,
    MISCONCEPTION: STATES.SCAFFOLDING,
    NO_FOUNDATION: STATES.SCAFFOLDING,
    default: STATES.HOOKING,
  },
  [STATES.ADVANCING]: {
    default: STATES.ASSESSING, // start next concept
  },
  [STATES.MASTERY_ACHIEVED]: {
    default: STATES.IDLE,
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Pure transition function — returns next pedagogical state.
 * @param {string} currentState — one of STATES
 * @param {string} understanding — 'CORRECT' | 'PARTIAL' | 'VAGUE' | 'MISCONCEPTION' | 'NO_FOUNDATION'
 * @param {number} masteryScore — current mastery score (0-100)
 * @returns {string} next state
 */
function getNextState(currentState, understanding, masteryScore = 0) {
  if (masteryScore >= MASTERY.THRESHOLD_SCORE) {
    return STATES.MASTERY_ACHIEVED;
  }

  const stateTransitions = TRANSITIONS[currentState] || TRANSITIONS[STATES.ASSESSING];
  return stateTransitions[understanding] || stateTransitions.default || STATES.ASSESSING;
}

/**
 * Determine support level based on struggle count and assessment.
 * Mirrors determineSupportLevel() in socraticTutorService for a single source of truth.
 * @param {number} struggleCount
 * @param {string} understanding
 * @param {string} emotionalState
 * @returns {string} one of SUPPORT_LEVELS
 */
function getSupportLevel(struggleCount = 0, understanding = 'VAGUE', emotionalState = 'UNCERTAIN') {
  if (struggleCount >= MASTERY.MAX_STRUGGLE_COUNT || emotionalState === 'FRUSTRATED') {
    return SUPPORT_LEVELS.DIRECT;
  }
  if (understanding === 'NO_FOUNDATION' || struggleCount === 2) {
    return SUPPORT_LEVELS.SCAFFOLDED;
  }
  if (struggleCount === 1 || understanding === 'VAGUE') {
    return SUPPORT_LEVELS.GUIDED;
  }
  return SUPPORT_LEVELS.MINIMAL;
}

/**
 * Returns a short addendum to inject into system prompts based on tutor state.
 * Allows prompts to adapt without duplicating logic in every service.
 * @param {string} state — one of STATES
 * @param {string} supportLevel — one of SUPPORT_LEVELS
 * @returns {string}
 */
function getTutorSystemPromptAddendum(state, supportLevel) {
  const stateDirectives = {
    [STATES.HOOKING]: '🎣 Use a creative analogy or surprising real-world hook to re-engage the student.',
    [STATES.SCAFFOLDING]: '🏗 Break the concept into smaller steps. Provide a direct example before asking a question.',
    [STATES.VERIFYING]: '✅ The student shows understanding. Deepen it with an L3/L4 Bloom\'s level question.',
    [STATES.ADVANCING]: '🚀 The student has mastered this sub-topic. Introduce the next concept with enthusiasm.',
    [STATES.MASTERY_ACHIEVED]: '🎓 Celebrate mastery! Summarise what was learned and encourage the student.',
  };

  const supportDirectives = {
    [SUPPORT_LEVELS.DIRECT]: '⚠️ Student is struggling significantly. Teach directly first, no leading questions.',
    [SUPPORT_LEVELS.SCAFFOLDED]: '💡 Provide an example or analogy before asking a follow-up question.',
    [SUPPORT_LEVELS.GUIDED]: '🔍 Ask a guiding question with a small hint embedded.',
    [SUPPORT_LEVELS.MINIMAL]: '🧠 Pure Socratic mode — questions only, no hints.',
  };

  return [
    stateDirectives[state] || '',
    supportDirectives[supportLevel] || '',
  ].filter(Boolean).join('\n');
}

/**
 * Legacy UI status labels — kept for backward compatibility with any
 * frontend components that read these values.
 * @deprecated Use STATES instead for logic; these are display labels only.
 */
const UI_STATUS_LABELS = {
  THINKING: 'Thinking',
  GENERATING: 'Generating response',
  ANALYZING: 'Analyzing information',
  SUMMARIZING: 'Summarizing key points',
  IDLE: null,
};

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  // State constants
  STATES,
  COGNITIVE_LEVELS,
  SUPPORT_LEVELS,
  MASTERY,
  TRANSITIONS,

  // Helper functions
  getNextState,
  getSupportLevel,
  getTutorSystemPromptAddendum,

  // Legacy (backward compat)
  ...UI_STATUS_LABELS,
};
