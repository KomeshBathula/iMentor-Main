import React, { useCallback, useState } from 'react';
import SkillTreeCourseSelector from './SkillTreeCourseSelector.jsx';

/**
 * Minimal wrapper to satisfy ISSUE 1:
 * - Render ONLY course selector when showCourseSelector===true.
 * - Keep landing hidden.
 *
 * It also provides ISSUE 2 wiring points for Other Course.
 * NOTE: No backend generation internals are changed.
 */
const SkillTreeCourseSelectorWrapper = ({ onContinue, isGenerating }) => {
  const [matchingResult, setMatchingResult] = useState(null);

  const handleValidatedCourse = useCallback(
    async ({ canonical, source }) => {
      if (!canonical) return;
      onContinue?.({ courseName: canonical, source });
    },
    [onContinue]
  );

  const handleMatchingResult = useCallback((res) => {
    console.log('[FLOW] handleMatchingResult entered');
    setMatchingResult(res);


    // PHASE 1 (CSV FLOW FIX):
    // When CSV upload/matching succeeds, immediately continue the same
    // workflow as manual selection by pushing the best extracted topic
    // into onContinue().
    if (!res) return;

    const extracted = Array.isArray(res.extractedTopics) ? res.extractedTopics : [];
    const matched = Array.isArray(res.matchedConcepts) ? res.matchedConcepts : [];
    console.log('[FLOW] extractedTopics=', extracted);
    console.log('[FLOW] matchedConcepts=', matched);

    const ignoreStructuralLabels = new Set([
      'module',
      'module 1',
      'module 2',
      'lecture number',
      'lecture topic',
      'subtopics',
      'week',
      'unit',
      'chapter',
      'topic',
      's.no',
      'sr no',
      'index',
      'number'
    ]);

    const isPureNumber = (s) => /^\d+$/.test(String(s || '').trim());

    const isEducationalCandidate = (s) => {
      const candidate = String(s || '').trim();
      if (!candidate) return { ok: false, candidate };
      if (isPureNumber(candidate)) return { ok: false, candidate };
      const lower = candidate.toLowerCase();
      if (ignoreStructuralLabels.has(lower)) return { ok: false, candidate };
      if (ignoreStructuralLabels.has(lower.replace(/\s+/g, ' '))) return { ok: false, candidate };
      return { ok: true, candidate };
    };

    // Build candidates with priority: matchedConcepts first, then extractedTopics.
    // Apply CSV header/structural filtering and pure-number filtering.
    const candidates = [...(Array.isArray(matched) ? matched : []), ...(Array.isArray(extracted) ? extracted : [])];

    let bestTopic = '';
    for (const raw of candidates) {
      const { ok, candidate } = isEducationalCandidate(raw);
      console.log('[CSV TOPIC FILTER] candidate=', String(candidate || ''));
      if (ok) {
        console.log('[CSV TOPIC FILTER] accepted=', candidate);
        bestTopic = candidate;
        break;
      } else {
        console.log('[CSV TOPIC FILTER] rejected=', candidate);
      }
    }

    console.log('[FLOW] bestTopic=', bestTopic);
    if (!bestTopic) return;


    // Mark the origin so SkillTreeLanding can skip topic-likelihood gating.
    // Also, treat extracted CSV topics as a "database"-origin for frontend validation.
    console.log('[FLOW] calling onContinue');
    onContinue?.({ courseName: bestTopic, source: 'database' });

  }, [onContinue]);

  // onValidatedCourse expects a shape; SkillTreeCourseSelector passes {canonical}
  return (
    <SkillTreeCourseSelector
      onValidatedCourse={handleValidatedCourse}
      onMatchingResult={handleMatchingResult}
      existingCourses={[]}
      isGenerating={isGenerating}
    />
  );
};

export default SkillTreeCourseSelectorWrapper;

