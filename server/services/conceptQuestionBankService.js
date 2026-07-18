const ConceptQuestionBank = require('../models/ConceptQuestionBank');
const { callWithFallback } = require('./llmFallbackService');
const semanticSimilarity = require('./semanticSimilarityService');
const log = require('../utils/logger');
const { redisClient } = require('../config/redisClient');
const { randomUUID } = require('crypto');
const { resolveCourseTitle } = require('./courseIdentityService');

const TARGET_QUESTIONS_PER_CONCEPT = 30;
const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const CONCEPT_QUESTION_SYSTEM_PROMPT = `You are generating a reusable concept-specific question bank.

Rules:
- The supplied concept is the source of truth.
- Generate questions ONLY about the supplied concept.
- Never write generic placeholder questions.
- Never broaden the scope to the course, module, topic, or skill tree level name.
- Cover the supplied concept thoroughly across definitions, applications, comparisons, edge cases, and misconceptions.
- Vary difficulty across easy, medium, and hard.
- Avoid duplicates or paraphrases of the same idea.
- Return long-term reusable questions that stay valid for later users.`;

const CACHE_TTL = 7 * 24 * 3600;

let redisClientInstance;
try {
  redisClientInstance = redisClient;
} catch { }

const warmupMetrics = {
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  lastDurationMs: 0,
  totalConcepts: 0,
  generatedConcepts: 0,
  reusedConcepts: 0,
  partialConcepts: 0,
  cacheHits: 0,
  dbHits: 0,
  topUpRuns: 0,
  generationRuns: 0,
  generatedQuestions: 0,
  failedConcepts: 0,
  pendingGeneration: 0,
  queuedJobs: 0,
  activeWorkers: 0,
  completedJobs: 0,
  currentConcept: null,
  lastError: null,
  queueWaitMs: 0,
  existingLookupMs: 0,
  missingQuestionCalculationMs: 0,
  llmGenerationMs: 0,
  deduplicationMs: 0,
  mongoPersistenceMs: 0,
  redisUpdateMs: 0,
};

function getWarmupMetrics() {
  const elapsed = warmupMetrics.startedAt ? Date.now() - warmupMetrics.startedAt : warmupMetrics.lastDurationMs;
  const completedConcepts = warmupMetrics.generatedConcepts + warmupMetrics.reusedConcepts + warmupMetrics.failedConcepts;
  const reuseBase = warmupMetrics.generatedConcepts + warmupMetrics.reusedConcepts;
  const completionPercentage = warmupMetrics.totalConcepts > 0 ? Math.round((completedConcepts / warmupMetrics.totalConcepts) * 100) : 0;
  const estimatedTimeRemainingMs = warmupMetrics.generationRuns > 0 && warmupMetrics.pendingGeneration > 0
    ? Math.round((warmupMetrics.lastDurationMs / Math.max(warmupMetrics.generationRuns, 1)) * warmupMetrics.pendingGeneration / Math.max(warmupMetrics.activeWorkers || 1, 1))
    : null;
  return {
    ...warmupMetrics,
    elapsedMs: elapsed,
    completedConcepts,
    reusePercentage: reuseBase > 0 ? Math.round((warmupMetrics.reusedConcepts / reuseBase) * 100) : 0,
    averageGenerationMs: warmupMetrics.generationRuns > 0 ? Math.round(warmupMetrics.lastDurationMs / Math.max(warmupMetrics.generationRuns, 1)) : 0,
    completionPercentage,
    estimatedTimeRemainingMs,
    progress: {
      total: warmupMetrics.totalConcepts,
      completed: completedConcepts,
      pending: warmupMetrics.pendingGeneration,
      completionPercentage,
      activeWorkers: warmupMetrics.activeWorkers,
      queuedJobs: warmupMetrics.queuedJobs,
      completedJobs: warmupMetrics.completedJobs,
      estimatedTimeRemainingMs,
    },
    timings: {
      queueWaitMs: warmupMetrics.queueWaitMs,
      existingLookupMs: warmupMetrics.existingLookupMs,
      missingQuestionCalculationMs: warmupMetrics.missingQuestionCalculationMs,
      llmGenerationMs: warmupMetrics.llmGenerationMs,
      deduplicationMs: warmupMetrics.deduplicationMs,
      mongoPersistenceMs: warmupMetrics.mongoPersistenceMs,
      redisUpdateMs: warmupMetrics.redisUpdateMs,
    },
  };
}

function addTiming(field, durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  warmupMetrics[field] = (warmupMetrics[field] || 0) + durationMs;
}

function normalizeConceptName(value) {
  return String(value ?? '').trim();
}

function buildConceptQuestionPrompt({ course, concept, topic, moduleName, count, remainingCount = null }) {
  const conceptName = normalizeConceptName(concept);
  const courseTitle = resolveCourseTitle(course, course);
  const countLabel = remainingCount && remainingCount !== count
    ? `${count} questions (targeting ${remainingCount} missing questions)`
    : `${count} questions`;

  return `You are an expert assessment designer creating a reusable question bank for one concept.

Concept: "${conceptName}"
Course context: "${courseTitle || course || 'General'}"
${topic ? `Related topic context: "${topic}"` : ''}
${moduleName ? `Related module context: "${moduleName}"` : ''}

Task:
- Generate exactly ${countLabel} multiple-choice questions for the concept "${conceptName}".
- Every question must be specifically about "${conceptName}".
- Do not create generic placeholder questions.
- Do not use template openers such as "Which statement best describes" or "What is the key trade-off".
- Do not ask questions that could be reused unchanged for another concept.
- Do not mention course codes, module names, or unrelated topic names in the question stem.
- Cover definitions, applications, comparisons, misconceptions, edge cases, and reasoning.
- Vary difficulty and Bloom levels across the set.
- Make the set reusable for later users.

Requirements:
- Exactly 4 distinct plausible options per question.
- Correct answers should be distributed across A, B, C, and D.
- Every question must include a detailed explanation.
- Return valid JSON only.

Return a JSON array of objects with this exact structure:
[
  {
    "question": "string",
    "options": ["string", "string", "string", "string"],
    "correctIndex": 0,
    "explanation": "string",
    "difficulty": "easy|medium|hard",
    "bloomLevel": "remember|understand|apply|analyze|evaluate|create",
    "learningObjective": "string",
    "estimatedTime": "30s|60s|90s|120s",
    "confidence": 0.0
  }
]

Valid JSON array only, no markdown.`;
}

function buildConceptRepairPrompt({ course, concept, topic, moduleName, count, previousQuestions = [] }) {
  const conceptName = normalizeConceptName(concept);
  const courseTitle = resolveCourseTitle(course, course);
  return `You previously returned generic or duplicated questions. Rewrite the bank from scratch.

Concept: "${conceptName}"
Course context: "${courseTitle || course || 'General'}"
${topic ? `Related topic context: "${topic}"` : ''}
${moduleName ? `Related module context: "${moduleName}"` : ''}

Rules:
- Generate exactly ${count} NEW multiple-choice questions.
- Each question must be clearly and specifically about "${conceptName}".
- Do not reuse or paraphrase any of the following rejected question stems:
${previousQuestions.length > 0 ? previousQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n') : '  (none)'}
- Avoid generic stems like "Which statement best describes...", "What is the key trade-off...", or any question that could be reused for another concept.
- Cover the concept with concrete definitions, mechanisms, applications, comparisons, misconceptions, and edge cases.
- Return only valid JSON.

Return a JSON array of MCQ objects using the same schema as before.`;
}

function extractJsonArray(text) {
  if (!text) return null;
  const stripped = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeQuestionStem(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isGenericConceptStem(question, concept) {
  const stem = normalizeQuestionStem(question);
  if (!stem) return true;

  const genericPatterns = [
    /^which statement best describes/,
    /^which statement best explains/,
    /^which statement correctly explains/,
    /^which of the following best describes/,
    /^which of the following best explains/,
    /^which of the following correctly describes/,
    /^what is the key trade-off/,
    /^what is the defining idea behind/,
    /^what is the primary characteristic of/,
    /^what is the primary goal of/,
    /^what is the main purpose of/,
    /^what is the core idea behind/,
    /^which example best demonstrates/,
    /^what is a common misconception about/,
    /^how does .* differ from a closely related concept/,
    /^which response shows the deepest understanding/,
    /^which practical scenario is the best match for/,
    /^what happens when .* is applied incorrectly/,
    /^what prerequisite idea should/,
    /^how would you explain .* to a new learner/,
  ];

  if (genericPatterns.some(pattern => pattern.test(stem))) return true;

  return false;
}

function normalizeGeneratedQuestion(rawQuestion, { concept, defaultDifficulty = 'medium' } = {}) {
  const question = String(rawQuestion?.question || '').trim();
  const options = Array.isArray(rawQuestion?.options)
    ? rawQuestion.options.slice(0, 4).map(o => String(o).trim()).filter(Boolean)
    : [];

  if (!question || options.length !== 4) return null;
  if (isGenericConceptStem(question, concept)) return null;

  const correctIndex = resolveCorrectIndex(rawQuestion);
  const difficulty = ['easy', 'medium', 'hard'].includes(rawQuestion?.difficulty) ? rawQuestion.difficulty : defaultDifficulty;
  const bloomLevel = BLOOM_LEVELS.includes(rawQuestion?.bloomLevel) ? rawQuestion.bloomLevel : 'understand';
  const estimatedTime = ['30s', '60s', '90s', '120s'].includes(rawQuestion?.estimatedTime) ? rawQuestion.estimatedTime : '60s';
  const confidence = typeof rawQuestion?.confidence === 'number' && rawQuestion.confidence >= 0 && rawQuestion.confidence <= 1
    ? rawQuestion.confidence
    : 0.8;

  return shuffleOptions({
    question,
    options,
    correctIndex,
    explanation: String(rawQuestion?.explanation || '').trim(),
    difficulty,
    bloomLevel,
    learningObjective: String(rawQuestion?.learningObjective || `Assess understanding of ${concept || 'the concept'}`).trim(),
    estimatedTime,
    confidence,
    _provider: rawQuestion?._provider || rawQuestion?.provider || 'unknown',
    _model: rawQuestion?._model || rawQuestion?.model || 'unknown',
  });
}

function resetWarmupMetrics(totalConcepts = 0) {
  warmupMetrics.status = 'running';
  warmupMetrics.startedAt = Date.now();
  warmupMetrics.finishedAt = null;
  warmupMetrics.lastDurationMs = 0;
  warmupMetrics.totalConcepts = totalConcepts;
  warmupMetrics.generatedConcepts = 0;
  warmupMetrics.reusedConcepts = 0;
  warmupMetrics.partialConcepts = 0;
  warmupMetrics.cacheHits = 0;
  warmupMetrics.dbHits = 0;
  warmupMetrics.topUpRuns = 0;
  warmupMetrics.generationRuns = 0;
  warmupMetrics.generatedQuestions = 0;
  warmupMetrics.failedConcepts = 0;
  warmupMetrics.pendingGeneration = totalConcepts;
  warmupMetrics.queuedJobs = totalConcepts;
  warmupMetrics.activeWorkers = 0;
  warmupMetrics.completedJobs = 0;
  warmupMetrics.currentConcept = null;
  warmupMetrics.lastError = null;
  warmupMetrics.queueWaitMs = 0;
  warmupMetrics.existingLookupMs = 0;
  warmupMetrics.missingQuestionCalculationMs = 0;
  warmupMetrics.llmGenerationMs = 0;
  warmupMetrics.deduplicationMs = 0;
  warmupMetrics.mongoPersistenceMs = 0;
  warmupMetrics.redisUpdateMs = 0;
}

function finishWarmupMetrics(status = 'completed', error = null) {
  warmupMetrics.status = status;
  warmupMetrics.finishedAt = Date.now();
  warmupMetrics.lastDurationMs = warmupMetrics.startedAt ? warmupMetrics.finishedAt - warmupMetrics.startedAt : warmupMetrics.lastDurationMs;
  warmupMetrics.pendingGeneration = 0;
  warmupMetrics.queuedJobs = 0;
  warmupMetrics.activeWorkers = 0;
  warmupMetrics.currentConcept = null;
  if (error) warmupMetrics.lastError = String(error.message || error);
}

function incrementProgress(field, amount = 1) {
  warmupMetrics[field] = (warmupMetrics[field] || 0) + amount;
}

function getRedisLockClient() {
  return redisClientInstance && redisClientInstance.isOpen ? redisClientInstance : null;
}

async function acquireGenerationLock(key, ttlSeconds = 120) {
  const client = getRedisLockClient();
  if (!client) return { acquired: true, token: null };
  const token = randomUUID();
  try {
    const result = await client.set(key, token, { NX: true, EX: ttlSeconds });
    return { acquired: result === 'OK', token: result === 'OK' ? token : null };
  } catch {
    return { acquired: true, token: null };
  }
}

async function releaseGenerationLock(key, token) {
  const client = getRedisLockClient();
  if (!client || !token) return;
  try {
    const current = await client.get(key);
    if (current === token) {
      await client.del(key);
    }
  } catch {
    // ignore
  }
}

async function waitForConceptCompletion(course, concept, timeoutMs = 15000) {
  const started = Date.now();
  const cacheKey = `concept_qb:${course}:${concept.toLowerCase().trim()}`;
  while (Date.now() - started < timeoutMs) {
    const cached = await getRedis(cacheKey);
    if (cached && Array.isArray(cached) && cached.length >= TARGET_QUESTIONS_PER_CONCEPT) {
      return cached;
    }
    const existing = await ConceptQuestionBank.find({
      course: { $regex: new RegExp(`^${escapeRegex(course)}$`, 'i') },
      concept: { $regex: new RegExp(`^${escapeRegex(concept)}$`, 'i') },
    }).lean();
    if (existing.length >= TARGET_QUESTIONS_PER_CONCEPT) return existing;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

async function fetchConceptQuestionBank(course, concept) {
  const conceptKey = concept.toLowerCase().trim();
  return ConceptQuestionBank.find({
    course: { $regex: new RegExp(`^${escapeRegex(course)}$`, 'i') },
    concept: { $regex: new RegExp(`^${escapeRegex(conceptKey)}$`, 'i') },
  }).lean();
}

async function getRedis(key) {
  try {
    if (redisClientInstance && redisClientInstance.isOpen) {
      const val = await redisClientInstance.get(key);
      if (val) return JSON.parse(val);
    }
  } catch { }
  return null;
}

async function setRedis(key, data) {
  try {
    if (redisClientInstance && redisClientInstance.isOpen) {
      await redisClientInstance.setEx(key, CACHE_TTL, JSON.stringify(data));
    }
  } catch { }
}

function shuffleOptions(question) {
  const options = [...question.options];
  const originalCorrectIndex = question.correctIndex;

  const correctText = options[originalCorrectIndex];

  const indices = [0, 1, 2, 3];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffled = indices.map(i => options[i]);
  const newCorrectIndex = indices.indexOf(originalCorrectIndex);

  return {
    ...question,
    options: shuffled,
    correctIndex: newCorrectIndex,
    _shuffleApplied: true,
  };
}

function validateEvenDistribution(questions) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const q of questions) {
    const idx = q.correctIndex;
    if (idx >= 0 && idx <= 3) counts[idx]++;
  }
  const total = questions.length;
  const ideal = total / 4;
  let chiSq = 0;
  for (let i = 0; i < 4; i++) {
    chiSq += ((counts[i] - ideal) ** 2) / ideal;
  }
  const balanced = chiSq <= 7.815;
  log.info('CONCEPT_QB', `Distribution: ${JSON.stringify(counts)}, χ²=${chiSq.toFixed(2)}, balanced=${balanced}`);
  return { counts, chiSq, balanced };
}

async function checkDuplicate(questionText, existingQuestions) {
  try {
    const existingTexts = existingQuestions.map(q => q.question).filter(Boolean);
    if (existingTexts.length === 0) return { isDuplicate: false };

    const result = await semanticSimilarity.checkQuestionDuplicate(questionText, existingTexts, 0.9);
    return result;
  } catch {
    const exact = existingQuestions.some(q =>
      q.question?.toLowerCase().trim() === questionText.toLowerCase().trim()
    );
    return { isDuplicate: exact, similarity: exact ? 1 : 0 };
  }
}

async function ensureQuestionsForConcept({ course, concept, topic, moduleName, forceGenerate = false, queuedAt = Date.now(), warmupJob = false }) {
  if (warmupJob) {
    if (warmupMetrics.status === 'idle') {
      warmupMetrics.status = 'running';
      warmupMetrics.startedAt = warmupMetrics.startedAt || Date.now();
    }
    warmupMetrics.totalConcepts += 1;
    warmupMetrics.pendingGeneration += 1;
    warmupMetrics.queuedJobs += 1;
  }
  warmupMetrics.activeWorkers++;
  warmupMetrics.queuedJobs = Math.max(0, warmupMetrics.queuedJobs - 1);
  addTiming('queueWaitMs', Date.now() - queuedAt);
  const conceptKey = concept.toLowerCase().trim();
  const cacheKey = `concept_qb:${course}:${conceptKey}`;
  const lockKey = `concept_qb_lock:${course.toLowerCase().trim()}:${conceptKey}`;

  const completeConceptQuestions = async (initialExisting = []) => {
    let currentQuestions = Array.isArray(initialExisting) ? initialExisting : [];
    let attempts = 0;
    const maxAttempts = 4;

    while (currentQuestions.length < TARGET_QUESTIONS_PER_CONCEPT && attempts < maxAttempts) {
      const missingCount = TARGET_QUESTIONS_PER_CONCEPT - currentQuestions.length;
      if (missingCount <= 0) break;

      attempts += 1;
      const llmStart = Date.now();
      const generated = await generateConceptQuestions({
        course,
        concept,
        topic,
        moduleName,
        targetCount: missingCount,
      });
      addTiming('llmGenerationMs', Date.now() - llmStart);
      incrementProgress(attempts === 1 ? 'generationRuns' : 'topUpRuns');
      warmupMetrics.lastDurationMs += Date.now() - llmStart;
      warmupMetrics.generatedQuestions += generated.length;

      if (generated.length === 0) {
        break;
      }

      const saved = await saveQuestionsToBank(generated, { course, concept, topic, moduleName });
      if (saved.length > 0) {
        const redisStart = Date.now();
        await setRedis(cacheKey, saved);
        addTiming('redisUpdateMs', Date.now() - redisStart);
      }

      currentQuestions = await fetchConceptQuestionBank(course, concept);
      if (currentQuestions.length >= TARGET_QUESTIONS_PER_CONCEPT) {
        return currentQuestions;
      }

      if (saved.length > 0 && saved.length < generated.length) {
        log.info('CONCEPT_QB', `Saved ${saved.length}/${generated.length} questions for ${course}/${concept}; retrying remaining ${TARGET_QUESTIONS_PER_CONCEPT - currentQuestions.length}`);
      }
    }

    return currentQuestions;
  };

  try {
    if (!forceGenerate) {
      const cacheLookupStart = Date.now();
      const cached = await getRedis(cacheKey);
      addTiming('existingLookupMs', Date.now() - cacheLookupStart);
      if (cached && Array.isArray(cached) && cached.length >= TARGET_QUESTIONS_PER_CONCEPT) {
        incrementProgress('cacheHits');
        incrementProgress('reusedConcepts');
        log.info('CONCEPT_QB', `Cache hit: ${course}/${concept} (${cached.length} questions)`);
        return cached;
      }

      const dbLookupStart = Date.now();
      const existing = await ConceptQuestionBank.find({
        course: { $regex: new RegExp(`^${escapeRegex(course)}$`, 'i') },
        concept: { $regex: new RegExp(`^${escapeRegex(conceptKey)}$`, 'i') },
      }).lean();
      addTiming('existingLookupMs', Date.now() - dbLookupStart);

      if (existing.length >= TARGET_QUESTIONS_PER_CONCEPT) {
        incrementProgress('dbHits');
        incrementProgress('reusedConcepts');
        log.info('CONCEPT_QB', `DB hit: ${course}/${concept} (${existing.length} questions)`);
        const redisStart = Date.now();
        await setRedis(cacheKey, existing);
        addTiming('redisUpdateMs', Date.now() - redisStart);
        return existing;
      }

      if (existing.length > 0) {
        incrementProgress('partialConcepts');
        const missingCalcStart = Date.now();
        const missingCount = Math.max(TARGET_QUESTIONS_PER_CONCEPT - existing.length, 0);
        addTiming('missingQuestionCalculationMs', Date.now() - missingCalcStart);
        if (missingCount > 0) {
          log.info('CONCEPT_QB', `Top-up needed: ${course}/${concept} has ${existing.length}/${TARGET_QUESTIONS_PER_CONCEPT}; generating ${missingCount} missing questions`);
          const lockWaitStart = Date.now();
          const lock = await acquireGenerationLock(lockKey, 180);
          addTiming('queueWaitMs', Date.now() - lockWaitStart);
          if (!lock.acquired) {
            const warmed = await waitForConceptCompletion(course, concept, 10000);
            if (warmed && warmed.length > 0) return warmed;
          } else {
            try {
              const filled = await completeConceptQuestions(existing);
              if (filled.length > 0) {
                return filled;
              }
            } finally {
              await releaseGenerationLock(lockKey, lock.token);
            }
          }
        }
      }
    }

    const lockWaitStart = Date.now();
    const lock = await acquireGenerationLock(lockKey, 180);
    addTiming('queueWaitMs', Date.now() - lockWaitStart);
    if (!lock.acquired) {
      const warmed = await waitForConceptCompletion(course, concept, 10000);
      if (warmed && warmed.length > 0) return warmed;
    } else {
      try {
        log.info('CONCEPT_QB', `Generating questions for ${course}/${concept}`);
        const filled = await completeConceptQuestions();
        if (filled.length >= TARGET_QUESTIONS_PER_CONCEPT) {
          incrementProgress('generatedConcepts');
          return filled;
        }
        if (filled.length > 0) {
          incrementProgress('partialConcepts');
          return filled;
        }
      } finally {
        await releaseGenerationLock(lockKey, lock.token);
      }
    }

    const existing = await fetchConceptQuestionBank(course, concept);
    if (existing.length >= TARGET_QUESTIONS_PER_CONCEPT) {
      incrementProgress('reusedConcepts');
    } else if (existing.length > 0) {
      warmupMetrics.pendingGeneration = Math.max(0, warmupMetrics.pendingGeneration - 1);
    } else {
      incrementProgress('failedConcepts');
    }
    return existing;
  } finally {
    warmupMetrics.activeWorkers = Math.max(0, warmupMetrics.activeWorkers - 1);
    warmupMetrics.completedJobs += 1;
    warmupMetrics.pendingGeneration = Math.max(0, warmupMetrics.totalConcepts - warmupMetrics.completedJobs - warmupMetrics.activeWorkers);
    warmupMetrics.queuedJobs = Math.max(0, warmupMetrics.totalConcepts - warmupMetrics.completedJobs - warmupMetrics.activeWorkers);
  }
}

async function generateFallbackQuestions({ course, concept, topic, moduleName, count, previousQuestions = [] }) {
  const name = normalizeConceptName(concept || topic || course);
  const prompt = buildConceptRepairPrompt({
    course,
    concept: name,
    topic,
    moduleName,
    count,
    previousQuestions,
  });

  try {
    const providerHealth = require('./providerHealthCache');
    const healthyProviders = providerHealth.getHealthyProviders(['groq', 'sglang', 'gemini', 'openai', 'ollama']);
    const preferredProvider = healthyProviders.includes('groq')
      ? 'groq'
      : (healthyProviders[0] || 'groq');
    const result = await callWithFallback({
      userQuery: prompt,
      systemPrompt: `${CONCEPT_QUESTION_SYSTEM_PROMPT}\n\nReturn ONLY valid JSON array of MCQ objects with all required fields.`,
      chatHistory: [],
      preferredProvider,
      preferLocalFirst: false,
      options: { groqModel: 'llama-3.1-8b-instant', temperature: 0.25, maxOutputTokens: 4096, timeout: 30000 },
    });

    const parsed = extractJsonArray(result?.text || '');
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map(q => normalizeGeneratedQuestion(q, { concept: name }))
      .filter(Boolean);

    const unique = [];
    const seen = new Set(previousQuestions.map(q => normalizeQuestionStem(q)));
    for (const q of normalized) {
      const key = normalizeQuestionStem(q.question);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(q);
      if (unique.length >= count) break;
    }
    return unique;
  } catch (e) {
    log.warn('CONCEPT_QB', `AI fallback generation failed for ${name}: ${e.message}`);
    return [];
  }
}

async function generateConceptQuestions({ course, concept, topic, moduleName, targetCount = 10 }) {
  const name = concept || topic || course;
  const initialTarget = Math.max(1, Number(targetCount) || 10);
  const allQuestions = [];

  const generationStart = Date.now();
  const GENERATION_TIMEOUT = 180_000;

  for (let batch = 0; allQuestions.length < initialTarget && batch < 6; batch++) {
    if (Date.now() - generationStart > GENERATION_TIMEOUT) {
      log.info('CONCEPT_QB', `Generation timeout reached after ${Date.now() - generationStart}ms — stopping batch loop`);
      break;
    }
    const remaining = initialTarget - allQuestions.length;
    if (remaining <= 0) break;
    const count = Math.min(10, remaining);

    const prompt = buildConceptQuestionPrompt({
      course,
      concept: name,
      topic,
      moduleName,
      count,
    });

    try {
      const providerHealth = require('./providerHealthCache');
      const healthyProviders = providerHealth.getHealthyProviders(['groq', 'sglang', 'gemini', 'openai', 'ollama']);
      const preferredProvider = healthyProviders.includes('groq')
        ? 'groq'
        : (healthyProviders[0] || 'groq');
      const result = await callWithFallback({
        userQuery: prompt,
        systemPrompt: `${CONCEPT_QUESTION_SYSTEM_PROMPT}\n\nReturn ONLY valid JSON array of MCQ objects with all required fields.`,
        chatHistory: [],
        preferredProvider,
        preferLocalFirst: false,
        options: { groqModel: 'llama-3.1-8b-instant', temperature: 0.45 + batch * 0.05, maxOutputTokens: 4096, timeout: 30000 },
      });

      const text = result?.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        let parsed;
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          continue;
        }

        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map(q => normalizeGeneratedQuestion({
              ...q,
              _provider: result?.provider || 'unknown',
              _model: result?.model || 'unknown',
            }, { concept: name }))
            .filter(Boolean);

          const existingStems = new Set(allQuestions.map(q => normalizeQuestionStem(q.question)));
          for (const q of normalized) {
            const stem = normalizeQuestionStem(q.question);
            if (!stem || existingStems.has(stem)) continue;
            existingStems.add(stem);
            allQuestions.push(q);
            if (allQuestions.length >= initialTarget) break;
          }
        }
      }
    } catch (e) {
      log.warn('CONCEPT_QB', `Batch ${batch + 1} generation failed: ${e.stack || e.message}`);
    }
  }

  if (allQuestions.length === 0) {
    log.info('CONCEPT_QB', `LLM providers exhausted — retrying AI repair path for ${name}`);
    const repairedQuestions = await generateFallbackQuestions({
      course,
      concept: name,
      topic,
      moduleName,
      count: initialTarget,
    });
    allQuestions.push(...repairedQuestions);
  }

  if (allQuestions.length < initialTarget) {
    const repairNeeded = initialTarget - allQuestions.length;
    const repairedQuestions = await generateFallbackQuestions({
      course,
      concept: name,
      topic,
      moduleName,
      count: repairNeeded,
      previousQuestions: allQuestions.map(q => q.question),
    });
    const existingStems = new Set(allQuestions.map(q => normalizeQuestionStem(q.question)));
    for (const q of repairedQuestions) {
      const stem = normalizeQuestionStem(q.question);
      if (!stem || existingStems.has(stem)) continue;
      existingStems.add(stem);
      allQuestions.push(q);
      if (allQuestions.length >= initialTarget) break;
    }
  }

  const distribution = validateEvenDistribution(allQuestions);
  log.info('CONCEPT_QB', `Generated ${allQuestions.length} questions for ${name} in ${Date.now() - generationStart}ms. Distribution balanced: ${distribution.balanced}`);

  return allQuestions;
}

async function generateRemainingQuestions({ course, concept, topic, moduleName, allQuestions, existing }) {
  const name = concept || topic || course;
  const totalExisting = allQuestions.length + existing.length;
  if (totalExisting >= TARGET_QUESTIONS_PER_CONCEPT) return;

  const existingTexts = new Set([
    ...existing.map(q => q.question?.toLowerCase().trim()),
    ...allQuestions.map(q => q.question?.toLowerCase().trim()),
  ]);

  const remainingCount = TARGET_QUESTIONS_PER_CONCEPT - totalExisting;
  const extraBatches = Math.ceil(remainingCount / 10);
  const persisted = [];

  for (let batch = 0; batch < extraBatches; batch++) {
    const count = Math.min(10, TARGET_QUESTIONS_PER_CONCEPT - totalExisting - persisted.length);
    if (count <= 0) break;

    const prompt = buildConceptQuestionPrompt({
      course,
      concept: name,
      topic,
      moduleName,
      count,
      remainingCount: TARGET_QUESTIONS_PER_CONCEPT - totalExisting - persisted.length,
    });

    try {
    const providerHealth = require('./providerHealthCache');
    const healthyProviders = providerHealth.getHealthyProviders(['groq', 'sglang', 'gemini', 'openai', 'ollama']);
    const preferredProvider = healthyProviders.includes('groq')
      ? 'groq'
      : (healthyProviders[0] || 'groq');
    const result = await callWithFallback({
      userQuery: prompt,
      systemPrompt: `${CONCEPT_QUESTION_SYSTEM_PROMPT}\n\nReturn ONLY valid JSON array of MCQ objects.`,
      chatHistory: [],
      preferredProvider,
      preferLocalFirst: false,
      options: { groqModel: 'llama-3.1-8b-instant', temperature: 0.5, maxOutputTokens: 4096, timeout: 30000 },
    });

      const text = result?.text || '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        let parsed;
        try { parsed = JSON.parse(jsonMatch[0]); } catch { continue; }
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map(q => normalizeGeneratedQuestion({
              ...q,
              _provider: result?.provider || 'unknown',
              _model: result?.model || 'unknown',
            }, { concept: name }))
            .filter(Boolean)
            .filter(q => !existingTexts.has(normalizeQuestionStem(q.question)));

          for (const question of normalized) {
            try {
              const doc = await ConceptQuestionBank.findOneAndUpdate(
                {
                  course: { $regex: new RegExp(`^${escapeRegex(course)}$`, 'i') },
                  concept: { $regex: new RegExp(`^${escapeRegex(concept)}$`, 'i') },
                  question: question.question,
                },
                {
                  $setOnInsert: {
                    course, concept, topic: topic || '', moduleName: moduleName || '',
                    question: question.question, options: question.options,
                    correctIndex: question.correctIndex, explanation: question.explanation,
                    difficulty: question.difficulty, bloomLevel: question.bloomLevel,
                    learningObjective: question.learningObjective, estimatedTime: question.estimatedTime,
                    confidence: question.confidence,
                    generatedBy: question._provider || '', model: question._model || '',
                    pipelineVersion: 'v2', generatedAt: new Date(),
                    conceptTags: [concept, topic].filter(Boolean),
                  },
                },
                { upsert: true, new: true }
              );
              persisted.push(doc.toObject());
              existingTexts.add(question.question.toLowerCase().trim());
            } catch { /* skip dup */ }
          }
        }
      }
    } catch (e) { /* background gen failed silently */ }
  }

  if (persisted.length > 0) {
    const cacheKey = `concept_qb:${course}:${concept.toLowerCase().trim()}`;
    try {
      const allDocs = await ConceptQuestionBank.find({
        course: { $regex: new RegExp(`^${escapeRegex(course)}$`, 'i') },
        concept: { $regex: new RegExp(`^${escapeRegex(concept)}$`, 'i') },
      }).lean();
      await setRedis(cacheKey, allDocs);
    } catch { /* ok */ }
    log.info('CONCEPT_QB', `Background: persisted ${persisted.length} additional questions for ${name}`);
  }
}

async function saveQuestionsToBank(questions, { course, concept, topic, moduleName }) {
  const saved = [];
  const existing = await ConceptQuestionBank.find({
    course: { $regex: new RegExp(`^${escapeRegex(course)}$`, 'i') },
    concept: { $regex: new RegExp(`^${escapeRegex(concept)}$`, 'i') },
  }).lean();

  for (const q of questions) {
    try {
      const dedupeStart = Date.now();
      const dupResult = await checkDuplicate(q.question, [...existing, ...saved]);
      addTiming('deduplicationMs', Date.now() - dedupeStart);

      if (dupResult.isDuplicate) {
        const matchedSim = dupResult.similarity ? ` (sim: ${dupResult.similarity.toFixed(3)})` : '';
        log.info('CONCEPT_QB', `Skipping duplicate: "${q.question.substring(0, 60)}..."${matchedSim}`);
        continue;
      }

      const mongoStart = Date.now();
      const doc = await ConceptQuestionBank.findOneAndUpdate(
        {
          course: { $regex: new RegExp(`^${escapeRegex(course)}$`, 'i') },
          concept: { $regex: new RegExp(`^${escapeRegex(concept)}$`, 'i') },
          question: q.question,
        },
        {
          $setOnInsert: {
            course,
            concept,
            topic: topic || '',
            moduleName: moduleName || '',
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            difficulty: q.difficulty,
            bloomLevel: q.bloomLevel,
            learningObjective: q.learningObjective,
            estimatedTime: q.estimatedTime,
            confidence: q.confidence,
            generatedBy: q._provider || '',
            model: q._model || '',
            pipelineVersion: 'v2',
            generatedAt: new Date(),
            conceptTags: [concept, topic].filter(Boolean),
          },
        },
        { upsert: true, new: true }
      );
      addTiming('mongoPersistenceMs', Date.now() - mongoStart);
      saved.push(doc.toObject());
    } catch (e) {
      log.warn('CONCEPT_QB', `Save failed for question: ${e.message}`);
    }
  }

  log.info('CONCEPT_QB', `Saved ${saved.length}/${questions.length} questions to bank for ${course}/${concept}`);
  return saved;
}

async function selectQuestionsForLevel({ course, concept, count = 5, seenQuestionIds = [], userId }) {
  const allQuestions = await ensureQuestionsForConcept({ course, concept });

  if (allQuestions.length === 0) return [];

  const seenSet = new Set(seenQuestionIds.map(s => s.toLowerCase().trim()));

  const annotated = allQuestions.map(q => ({
    ...q,
    _usageCount: q.usageCount || 0,
    _seen: seenSet.has(q.question?.toLowerCase().trim()),
    _lastUsed: q.lastUsedAt ? new Date(q.lastUsedAt).getTime() : 0,
    _successRate: q.usageCount > 0 ? (q.successCount || 0) / q.usageCount : 0.5,
    _random: Math.random(),
  }));

  const unseenFirst = annotated.sort((a, b) => {
    if (a._seen !== b._seen) return a._seen ? 1 : -1;
    if (a._usageCount !== b._usageCount) return a._usageCount - b._usageCount;
    if (a._lastUsed !== b._lastUsed) return a._lastUsed - b._lastUsed;
    return a._random - b._random;
  });

  const selected = unseenFirst.slice(0, count);

  return selected.map(q => ({
    question: q.question,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    difficulty: q.difficulty,
    bloomLevel: q.bloomLevel,
    learningObjective: q.learningObjective,
    estimatedTime: q.estimatedTime,
    confidence: q.confidence,
    _id: q._id,
  }));
}

async function recordQuestionAttempt(questionId, userId, correct) {
  try {
    const q = await ConceptQuestionBank.findById(questionId);
    if (!q) return;

    q.usageCount = (q.usageCount || 0) + 1;
    if (correct) q.successCount = (q.successCount || 0) + 1;
    q.lastUsedAt = new Date();
    q.studentHistory.push({ userId, correct, answeredAt: new Date() });

    if (q.studentHistory.length > 50) {
      q.studentHistory = q.studentHistory.slice(-50);
    }

    await q.save();
  } catch (e) {
    log.warn('CONCEPT_QB', `Failed to record attempt: ${e.message}`);
  }
}

async function getQuestionAnalytics(concept, course) {
  const match = {};
  if (concept) match.concept = { $regex: new RegExp(escapeRegex(concept), 'i') };
  if (course) match.course = { $regex: new RegExp(`^${escapeRegex(course)}$`, 'i') };

  const questions = await ConceptQuestionBank.find(match).lean();
  const total = questions.length;
  const totalUsage = questions.reduce((s, q) => s + (q.usageCount || 0), 0);
  const totalCorrect = questions.reduce((s, q) => s + (q.successCount || 0), 0);
  const overallSuccessRate = totalUsage > 0 ? Math.round((totalCorrect / totalUsage) * 100) : 0;

  const byDifficulty = { easy: { total: 0, usage: 0, correct: 0 }, medium: { total: 0, usage: 0, correct: 0 }, hard: { total: 0, usage: 0, correct: 0 } };
  const byBloom = {};

  for (const q of questions) {
    const d = q.difficulty || 'medium';
    if (byDifficulty[d]) {
      byDifficulty[d].total++;
      byDifficulty[d].usage += q.usageCount || 0;
      byDifficulty[d].correct += q.successCount || 0;
    }
    const bl = q.bloomLevel || 'understand';
    if (!byBloom[bl]) byBloom[bl] = { total: 0, usage: 0, correct: 0 };
    byBloom[bl].total++;
    byBloom[bl].usage += q.usageCount || 0;
    byBloom[bl].correct += q.successCount || 0;
  }

  return {
    total,
    totalUsage,
    overallSuccessRate,
    byDifficulty,
    byBloom,
    lastGeneratedAt: questions.length > 0 ? questions[questions.length - 1].generatedAt : null,
  };
}

function resolveCorrectIndex(q) {
  if (typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < 4) return q.correctIndex;
  if (typeof q.correctIndex === 'string' && /^\d$/.test(q.correctIndex)) return parseInt(q.correctIndex);
  if (typeof q.answer === 'string' && /^[A-Da-d]$/.test(q.answer)) return q.answer.toUpperCase().charCodeAt(0) - 65;
  if (typeof q.correct === 'string' && /^[A-Da-d]$/.test(q.correct)) return q.correct.toUpperCase().charCodeAt(0) - 65;
  return 0;
}

function escapeRegex(str) {
  return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  ensureQuestionsForConcept,
  generateConceptQuestions,
  saveQuestionsToBank,
  selectQuestionsForLevel,
  recordQuestionAttempt,
  getQuestionAnalytics,
  shuffleOptions,
  validateEvenDistribution,
  checkDuplicate,
  getWarmupMetrics,
};
