const { callWithFallback } = require('./llmFallbackService');
const { evaluateAnswer } = require('./aiEvaluationService');
const AssessmentResult = require('../models/AssessmentResult');
const StudentKnowledgeState = require('../models/StudentKnowledgeState');
const log = require('../utils/logger');

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate'];

async function generateDiagnosticAssessment({ course, module, topic, userId }) {
  const prompt = `You are an expert educational diagnostician. Generate a diagnostic assessment to evaluate a learner's current knowledge of the given topic.

Course: ${course || 'General'}
${module ? `Module: ${module}` : ''}
${topic ? `Topic: ${topic}` : ''}

Generate exactly 5 questions that span Bloom's Taxonomy levels:
- 1 Remember (recall facts, definitions)
- 1 Understand (explain concepts in own words)
- 1 Apply (use knowledge in a practical context)
- 1 Analyze (break down components, find patterns)
- 1 Evaluate (make judgments, critique, justify)

Rules:
- Each question must test a DIFFERENT concept relevant to the topic
- Mix of MCQ and descriptive types (at least 2 MCQ, at least 1 descriptive)
- MCQs: provide 4 options (A, B, C, D), mark correctAnswer as the letter
- Descriptive: provide a modelAnswer for grading reference
- Tag each question with its bloomLevel and difficulty (easy/medium/hard)

Return valid JSON only:
{
  "questions": [
    {
      "question": "...",
      "type": "mcq" or "descriptive",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "A",
      "modelAnswer": "...",
      "bloomLevel": "remember",
      "difficulty": "easy",
      "concepts": ["concept1", "concept2"]
    }
  ]
}`;

  try {
    const responseText = await callWithFallback({
      userQuery: prompt,
      systemPrompt: 'You are an educational assessment generator. Respond with valid JSON only.',
      chatHistory: [],
      preferredProvider: 'ollama',
    });

    const raw = typeof responseText === 'string' ? responseText : (responseText.text || JSON.stringify(responseText));
    let parsed;
    const text = raw;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Could not parse LLM response as JSON');
    }

    const questions = (parsed.questions || []).slice(0, 5).map((q, i) => ({
      id: `diag_${i}_${Date.now()}`,
      question: q.question,
      type: q.type || 'mcq',
      options: q.options || [],
      bloomLevel: q.bloomLevel || 'understand',
      difficulty: q.difficulty || 'medium',
      concepts: q.concepts || [],
      correctAnswer: q.correctAnswer || '',
      modelAnswer: q.modelAnswer || '',
    }));

    return { questions, course, topic };
  } catch (error) {
    log.error('KNOWLEDGE_ASSESS', `Diagnostic generation failed: ${error.message}. Using offline fallback questions.`);
    return generateOfflineAssessment({ course, topic });
  }
}

function generateOfflineAssessment({ course, topic }) {
  const t = topic || course || 'this topic';
  const questions = [
    {
      id: `offline_0_${Date.now()}`,
      question: `What is the core definition of "${t}"? Explain it in your own words.`,
      type: 'descriptive',
      options: [],
      bloomLevel: 'remember',
      difficulty: 'easy',
      concepts: [t.toLowerCase(), 'definition', 'basics'],
      correctAnswer: '',
      modelAnswer: `The student should define ${t} with its key characteristics and core principles.`,
    },
    {
      id: `offline_1_${Date.now()}`,
      question: `Describe how "${t}" relates to the broader field it belongs to. What makes it distinct?`,
      type: 'descriptive',
      options: [],
      bloomLevel: 'understand',
      difficulty: 'easy',
      concepts: [t.toLowerCase(), 'relations', 'context'],
      correctAnswer: '',
      modelAnswer: `The student should explain how ${t} fits within its domain and what distinguishes it from related areas.`,
    },
    {
      id: `offline_2_${Date.now()}`,
      question: `Provide a practical real-world application of "${t}". What steps would you take to apply it?`,
      type: 'descriptive',
      options: [],
      bloomLevel: 'apply',
      difficulty: 'medium',
      concepts: [t.toLowerCase(), 'application', 'practice'],
      correctAnswer: '',
      modelAnswer: `The student should describe a concrete scenario where ${t} is applied and outline the method or process.`,
    },
    {
      id: `offline_3_${Date.now()}`,
      question: `Analyze the key components of "${t}". How do these components interact with each other?`,
      type: 'descriptive',
      options: [],
      bloomLevel: 'analyze',
      difficulty: 'medium',
      concepts: [t.toLowerCase(), 'analysis', 'components'],
      correctAnswer: '',
      modelAnswer: `The student should break ${t} into its constituent parts and explain their relationships and interactions.`,
    },
    {
      id: `offline_4_${Date.now()}`,
      question: `Evaluate the strengths and limitations of approaches used in "${t}". What trade-offs exist?`,
      type: 'descriptive',
      options: [],
      bloomLevel: 'evaluate',
      difficulty: 'hard',
      concepts: [t.toLowerCase(), 'evaluation', 'trade-offs', 'critique'],
      correctAnswer: '',
      modelAnswer: `The student should critically assess different approaches within ${t}, weighing their advantages and disadvantages.`,
    },
  ];
  return { questions, course, topic };
}

async function evaluateAndClassify({ responses, topic, course, userId }) {
  const gradingDetails = [];
  let rawScore = 0;

  const bloomScores = {};
  BLOOM_LEVELS.forEach(l => { bloomScores[l] = { correct: 0, total: 0 }; });
  const conceptResults = {};

  const allEvals = [];
  const allStrengths = [];
  const allWeaknesses = [];
  const allMisconceptions = [];

  for (const r of responses) {
    const bloomLevel = r.bloomLevel || 'understand';
    bloomScores[bloomLevel].total++;

    let isCorrect = false;
    let evalDetail = null;

    if (r.type === 'mcq') {
      const userAns = (r.userAnswer || '').trim().toUpperCase().charAt(0);
      const correctAns = (r.correctAnswer || '').trim().toUpperCase().charAt(0);
      isCorrect = userAns === correctAns && userAns.length > 0;
      if (isCorrect) {
        allStrengths.push(`Answered correctly: ${r.question.substring(0, 60)}`);
      }
    } else {
      evalDetail = await evaluateAnswer(r.question, r.userAnswer, r.modelAnswer, r.concepts, bloomLevel);
      isCorrect = evalDetail.score >= 5;
      if (evalDetail.strengths) allStrengths.push(...evalDetail.strengths);
      if (evalDetail.weaknesses) allWeaknesses.push(...evalDetail.weaknesses);
      if (evalDetail.misconceptions) allMisconceptions.push(...evalDetail.misconceptions);
    }

    if (isCorrect) {
      rawScore++;
      bloomScores[bloomLevel].correct++;
    }

    (r.concepts || []).forEach(c => {
      if (!conceptResults[c]) conceptResults[c] = { correct: 0, total: 0 };
      conceptResults[c].total++;
      if (isCorrect) conceptResults[c].correct++;
    });

    gradingDetails.push({
      question: r.question,
      correct: isCorrect,
      bloomLevel,
      concepts: r.concepts || [],
      evaluation: evalDetail ? { score: evalDetail.score, blooms: evalDetail.blooms, feedback: evalDetail.feedback } : undefined,
    });
  }

  const scorePercent = responses.length > 0 ? Math.round((rawScore / responses.length) * 100) : 0;

  let level = 'Beginner';
  if (scorePercent >= 90) level = 'Expert';
  else if (scorePercent >= 70) level = 'Advanced';
  else if (scorePercent >= 45) level = 'Intermediate';

  const bloomProfile = {};
  BLOOM_LEVELS.forEach(l => {
    const s = bloomScores[l];
    bloomProfile[l] = {
      score: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      mastered: s.total > 0 && s.correct === s.total,
      attempted: s.total,
    };
  });

  const conceptMastery = {};
  Object.entries(conceptResults).forEach(([concept, stats]) => {
    conceptMastery[concept] = {
      mastery: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      needsReview: stats.total > 0 && stats.correct < stats.total,
    };
  });

  const highestBloom = BLOOM_LEVELS.slice().reverse().find(l => bloomProfile[l].mastered) || 'remember';
  const conceptStrengths = Object.entries(conceptMastery).filter(([, v]) => v.mastery >= 80).map(([k]) => k);
  const conceptWeakAreas = Object.entries(conceptMastery).filter(([, v]) => v.needsReview).map(([k]) => k);

  const strengths = [...new Set([...conceptStrengths, ...allStrengths])].slice(0, 10);
  const weakAreas = [...new Set([...conceptWeakAreas, ...allWeaknesses])].slice(0, 10);
  const misconceptions = [...new Set(allMisconceptions)].slice(0, 5);

  const personalizedFeedback = buildEnhancedFeedback(level, scorePercent, strengths, weakAreas, misconceptions);

  if (userId) {
    try {
      await AssessmentResult.create({
        userId, topic: topic || course || 'general', course,
        level, score: rawScore, maxScore: responses.length, scorePercent,
        confidence: scorePercent, highestBloomLevel: highestBloom,
        bloomProfile,
        conceptMastery,
        strengths, weakAreas,
        feedback: personalizedFeedback.feedback,
        recommendation: personalizedFeedback.recommendation,
        gradingDetails,
      });

      await syncToKnowledgeState(userId, topic, { weakAreas, strengths, level });
    } catch (err) {
      log.warn('KNOWLEDGE_ASSESS', `Persist failed: ${err.message}`);
    }
  }

  return {
    level, score: rawScore, maxScore: responses.length, scorePercent,
    confidence: scorePercent, bloomProfile, highestBloomLevel: highestBloom,
    conceptMastery, strengths, weakAreas, misconceptions,
    feedback: personalizedFeedback.feedback,
    recommendation: personalizedFeedback.recommendation,
    proficiencyLevel: level,
    overallPercentage: scorePercent,
    suggestedRevisionTopics: weakAreas.slice(0, 5),
    learningReadiness: level !== 'Beginner' ? 'ready' : 'needs_preparation',
    gradingDetails,
  };
}

function buildEnhancedFeedback(level, scorePercent, strengths, weakAreas, misconceptions) {
  let feedback;
  if (scorePercent >= 90) {
    feedback = 'Excellent work! You demonstrate strong command across all areas assessed.';
    if (strengths.length > 0) feedback += ` Your strengths include ${strengths.slice(0, 3).join(', ')}.`;
  } else if (scorePercent >= 70) {
    feedback = 'Good foundation established. A few areas need reinforcement.';
    if (weakAreas.length > 0) feedback += ` Focus on improving: ${weakAreas.slice(0, 3).join(', ')}.`;
  } else if (scorePercent >= 45) {
    feedback = 'You have basic awareness but need to develop deeper understanding.';
    if (weakAreas.length > 0) feedback += ` Priority areas: ${weakAreas.slice(0, 3).join(', ')}.`;
    if (misconceptions.length > 0) feedback += ` Address misconceptions about: ${misconceptions.slice(0, 2).join(', ')}.`;
  } else {
    feedback = 'This topic needs foundational work. Start with core concepts and build up gradually.';
    if (misconceptions.length > 0) feedback += ` Clarify misunderstandings about: ${misconceptions.slice(0, 2).join(', ')}.`;
  }

  const gaps = weakAreas.slice(0, 3);
  const gapText = gaps.length > 0 ? ` Focus on: ${gaps.join(', ')}.` : '';
  let recommendation;
  if (level === 'Beginner') recommendation = `Start with introductory material covering core concepts. Practice basic recall and understanding exercises.${gapText}`;
  else if (level === 'Intermediate') recommendation = `Build on your foundation with application exercises. Try explaining concepts in your own words.${gapText}`;
  else if (level === 'Advanced') recommendation = `Challenge yourself with analysis and evaluation tasks. Connect concepts across different topics.${gapText}`;
  else recommendation = `You are ready for advanced synthesis. Explore cross-cutting concepts and create original solutions.${gapText}`;

  return { feedback, recommendation };
}

async function syncToKnowledgeState(userId, topic, { weakAreas, strengths, level }) {
  const state = await StudentKnowledgeState.findOneAndUpdate(
    { userId },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const now = new Date();
  state.engagementMetrics.totalSessions = (state.engagementMetrics.totalSessions || 0) + 1;
  state.engagementMetrics.lastActiveDate = now;

  weakAreas.forEach(area => {
    const existing = state.concepts.find(c => c.conceptName.toLowerCase() === area.toLowerCase());
    if (existing) {
      existing.understandingLevel = 'struggling';
      existing.masteryScore = Math.min(existing.masteryScore || 50, 40);
    } else {
      state.concepts.push({
        conceptName: area, understandingLevel: 'struggling', masteryScore: 20,
        category: 'fundamental', difficulty: 'medium',
      });
    }
  });

  strengths.forEach(area => {
    const existing = state.concepts.find(c => c.conceptName.toLowerCase() === area.toLowerCase());
    if (existing) {
      existing.understandingLevel = 'mastered';
      existing.masteryScore = Math.max(existing.masteryScore || 0, 85);
    } else {
      state.concepts.push({
        conceptName: area, understandingLevel: 'comfortable', masteryScore: 85,
        category: 'intermediate', difficulty: 'low',
      });
    }
  });

  try { await state.save(); } catch (e) { log.warn('KNOWLEDGE_ASSESS', `KnowledgeState sync error: ${e.message}`); }
}



async function generateLearningReadiness(userId, topic) {
  try {
    const query = { userId };
    if (topic) query.topic = topic;
    const latest = await AssessmentResult.findOne(query).sort({ createdAt: -1 });

    if (!latest) {
      return {
        readiness: 'unknown',
        message: 'No assessment data available. Take a diagnostic assessment to determine readiness.',
        recommendations: [{ area: 'assessment', action: 'Take a diagnostic assessment', priority: 'high' }],
      };
    }

    const recommendations = [];
    if (latest.level === 'Beginner' || latest.level === 'Intermediate') {
      recommendations.push({ area: 'foundation', action: 'Review core concepts with structured lecture notes', priority: 'high' });
    }
    if (latest.highestBloomLevel === 'remember' || latest.highestBloomLevel === 'understand') {
      recommendations.push({ area: 'application', action: 'Practice with scenario-based questions', priority: 'medium' });
    }
    (latest.weakAreas || []).forEach(area => {
      recommendations.push({ area: 'knowledge_gap', action: `Review ${area} with targeted practice`, priority: 'high' });
    });
    recommendations.push({
      area: 'progression',
      action: latest.level === 'Beginner' ? 'Progress to Intermediate material' : 'Attempt advanced analysis questions',
      priority: 'medium',
    });

    return {
      readiness: latest.level !== 'Beginner' ? 'ready' : 'needs_preparation',
      currentLevel: latest.level,
      highestBloomLevel: latest.highestBloomLevel,
      lastAssessed: latest.createdAt,
      recommendations,
    };
  } catch (error) {
    log.error('KNOWLEDGE_ASSESS', `Readiness check failed: ${error.message}`);
    return { readiness: 'error', message: error.message, recommendations: [] };
  }
}

async function getAssessmentHistory(userId, topic) {
  const query = { userId };
  if (topic) query.topic = topic;
  const assessments = await AssessmentResult.find(query).sort({ createdAt: -1 }).limit(20).lean();

  const sorted = [...assessments].reverse();
  const trend = sorted.length >= 2 ? sorted[sorted.length - 1].scorePercent - sorted[0].scorePercent : null;

  return { assessments: sorted, trend };
}

module.exports = {
  generateDiagnosticAssessment,
  evaluateAndClassify,
  generateLearningReadiness,
  getAssessmentHistory,
};