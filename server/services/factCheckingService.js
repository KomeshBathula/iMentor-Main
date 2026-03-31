/**
 * Intelligent Fact Checking Service
 * 
 * Analyzes the final source corpus BEFORE synthesis to extract structured evidence,
 * perform causal analysis mechanisms, evaluate contradictions, and compute deep analytical confidence.
 */
const { LLMRouter } = require('./llmRouterService');

const factCheckingService = {
  /**
   * Pipeline to extract claims and verify them against the provided sources.
   * @param {Array} sources - Array of AcademicSource schema objects
   * @param {string} query - The core research topic
   * @param {string} userId - For LLM routing context
   * @returns {Promise<Array>} Array of ClaimVerification objects
   */
  async verifyCorpusClaims(sources, query, userId) {
    if (!sources || sources.length === 0) return [];

    console.log(`[FactChecking] Starting intelligent claim extraction for "${query}"`);

    // Build context block mapping source ID to its text
    const sourceContext = sources.map(s => {
      const abstract = s.abstract || s.content || '';
      return `[Source ${s.citationIndex || s.id}] (${s.evidenceCategory || 'unknown'} | ${s.sourceType || 'unknown'}): ${abstract.substring(0, 1000)}`;
    }).join('\n\n');

    const prompt = `
You are an Advanced Analytical Research Engine.
Do NOT summarize. Extract structured research units and resolve causal mechanisms for the research topic: "${query}".

STAGE 4 CAUSAL REASONING MANDATE:
For every major claim you discover, evaluate:
1. CAUSE (Root cause or driving factor)
2. CONTRIBUTING FACTORS
3. ALTERNATIVE EXPLANATIONS (Counter-arguments)
4. SECOND-ORDER EFFECTS (Long-term consequences)
5. UNCERTAINTY LEVEL

If a statement is descriptive only, expand it to causal analysis (explain WHY and HOW).
Every claim must include measurable support and affected actors when available.
Categorize evidence as one of: Empirical | Historical | Theoretical | Market Signal | Speculative.

SOURCE CORPUS:
${sourceContext}

OUTPUT FORMAT (JSON ARRAY ONLY OF EVIDENTIARY OBJECTS):
[
  {
    "claim": "Major claim statement.",
    "mechanism": "Underlying mechanism and transmission channel.",
    "cause": "Direct causal driver.",
    "contributing_factors": "Additional factors that amplify or dampen the effect.",
    "alternative_explanations": "Competing explanations and confounders.",
    "second_order_effects": "Long-term and system-level implications.",
    "supporting_data": "Quantitative signal, trend, or measurable evidence.",
    "timeframe": "Time period covered by the evidence.",
    "affected_actors": ["Who is impacted"],
    "counter_evidence": "Disconfirming evidence or contradiction.",
    "evidence_type": "Empirical | Historical | Theoretical | Market Signal | Speculative",
    "strength_of_evidence": "Strong | Moderate | Weak",
    "example": "Concrete real-world example from sources.",
    "implication": "Strategic, operational, ethical, or technical implication.",
    "supportingSources": [1, 3],
    "contradictingSources": [2],
    "uncertainty_level": "Low | Medium | High",
    "confidenceScore": 85
  }
]

RULES:
- 'supportingSources' and 'contradictingSources' must be arrays of integers representing Source IDs.
- Include at least one counter-evidence reference when available.
- OUTPUT STRICT VALID JSON ARRAY. No markdown. No conversational prefixes.
`;

    try {
      const response = await LLMRouter.generate({
        query: prompt,
        userId: userId,
        deepResearchContext: true,
        systemPrompt: "You are a rigid analytical fact-checker. Output only strict JSON arrays."
      });

      let jsonString = response;
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
          jsonString = jsonMatch[0];
      }

      // Clean control characters
      jsonString = jsonString.replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, "");

      const claims = JSON.parse(jsonString);
      
      console.log(`[FactChecking] Successfully extracted and verified ${claims.length} claims.`);
      return claims;

    } catch (err) {
      console.warn("[FactChecking] Intelligent extraction failed, returning generic claim structure:", err.message);
      return [];
    }
  }
};

module.exports = factCheckingService;
