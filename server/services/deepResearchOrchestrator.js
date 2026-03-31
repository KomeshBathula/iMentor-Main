const log = require('../utils/logger');
/**
 * Deep Research Orchestrator
 * 
 * Coordinates the entire deep research workflow:
 * 1. Checks Cache
 * 2. Fetches Local Knowledge
 * 3. Fetches Online Academic & Web Results (Parallel)
 * 4. Merges & Ranks Sources by Credibility
 * 5. Returns Structured Research Response
 */

const ResearchCache = require('../models/ResearchCache');
const localKnowledgeBase = require('./localKnowledgeBase');
const webCrawlerService = require('./webCrawlerService');
const sourceCredibilityService = require('./sourceCredibilityService');
const researchPlanService = require('./researchPlanService');
const researchSynthesisService = require('./researchSynthesisService');
const citationEnrichmentService = require('./citationEnrichmentService');
const academicSourceService = require('./academicSourceService');
const citationGraphService = require('./citationGraphService');
const factCheckingService = require('./factCheckingService');
const researchIntelligenceService = require('./researchIntelligenceService');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createPerformanceTracker, logPerformance } = require('./performanceDiagnosticsService');

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://rag:8000';

async function runCrewAiResearch(query, options = {}, onProgress = null) {
    log.info('SYSTEM', `Starting CrewAI deep research for: "${query}"`);
    if (onProgress) onProgress({ phase: 'init', message: 'Initializing CrewAI Research Agents...' });

    try {
        if (onProgress) onProgress({ phase: 'planning', message: 'Agents are planning the research strategy...' });

        const response = await axios.post(`${RAG_SERVICE_URL}/crewai-research`, {
            topic: query,
        }, {
            timeout: 900000, // 15 minutes timeout for deep research
            headers: { 'Content-Type': 'application/json' }
        });

        if (onProgress) onProgress({ phase: 'synthesizing', message: 'Agents are synthesizing the final report...' });

        const finalReport = response.data.result;

        if (!finalReport || typeof finalReport !== 'string' || finalReport.trim() === '') {
            throw new Error('CrewAI returned an empty or invalid report.');
        }
        
        // Simulate some of the old structure for compatibility
        const researchResult = {
            query,
            userId: options.userId,
            normalizedQuery: query.toLowerCase().trim(),
            sources: [], // CrewAI currently returns a single report
            overallConfidenceScore: 95, // Placeholder
            createdAt: new Date(),
            researchReport: { fullReport: finalReport, summary: finalReport.slice(0, 500) }
        };

        if (onProgress) {
            onProgress({
                phase: 'completed',
                message: 'Research Complete.',
                fullReport: researchResult.researchReport,
                metaData: {
                    retrievalMode: 'CrewAI',
                    totalSources: 0,
                    confidenceScore: 95,
                },
                sourceData: [],
                graphData: null
            });
        }
        
        log.success('AI', `CrewAI research complete for: "${query}"`);

        return {
            researchBundle: researchResult,
            researchReport: researchResult.researchReport,
            performanceDiagnostics: {}, // Placeholder
        };

    } catch (error) {
        log.error('AI', `CrewAI research failed: ${error.message}`);
        if (error.response) {
            log.error('AI', `RAG service response: ${JSON.stringify(error.response.data)}`);
        }
        if (onProgress) onProgress({ phase: 'error', message: `CrewAI research failed: ${error.message}` });
        throw error;
    }
}


async function retrieveSourcesForQuerySet(queries, { academicPerQuery = 2, webPerQuery = 2, maxConcurrent = 3 } = {}) {
    const results = [];

    for (let i = 0; i < queries.length; i += maxConcurrent) {
        const batch = queries.slice(i, i + maxConcurrent);

        const batchJobs = batch.map(async (expandedQuery) => {
            const [academicResult, webResult] = await Promise.allSettled([
                academicSourceService.retrieveSources(expandedQuery, { limit: academicPerQuery }),
                webCrawlerService.searchAndCrawl(expandedQuery, webPerQuery)
            ]);

            const academicSources = academicResult.status === 'fulfilled'
                ? (academicResult.value || []).map(source => ({ ...source, retrievalQuery: expandedQuery }))
                : [];

            const webSources = webResult.status === 'fulfilled'
                ? (webResult.value || []).map(source => ({ ...source, retrievalQuery: expandedQuery }))
                : [];

            return [...academicSources, ...webSources];
        });

        const settled = await Promise.all(batchJobs);
        results.push(...settled.flat());
    }

    return results;
}

const deepResearchOrchestrator = {

    /**
     * Run a comprehensive deep research query.
     * @param {string} query - The research subject.
     * @param {Object} options - { forceRefresh: boolean, userId: string }
     * @returns {Promise<Object>} The full research result set.
     */
    async runDeepResearch(query, options = {}, onProgress = null) {
        // Route to CrewAI if the feature flag is enabled or for specific queries
        if (process.env.USE_CREWAI_RESEARCH === 'true') {
            return runCrewAiResearch(query, options, onProgress);
        }

        const startTime = Date.now();
        const perf = createPerformanceTracker({ mode: 'deepResearch', queryPreview: String(query || '').slice(0, 80) });
        const normalizedQuery = query.toLowerCase().trim();
        const researchConfig = researchIntelligenceService.resolveResearchConfig(query, options.researchConfig || null);

        log.info('SYSTEM', `Deep research started: "${query}"`);
        if (onProgress) onProgress({ phase: 'init', message: 'Initializing Research Engine...' });

        // 0. Generate research plan with analytical decomposition
        if (onProgress) onProgress({ phase: 'planning', message: 'Generating Academic Research Plan...' });

        let researchPlan = {};
        try {
            const planStart = Date.now();
            researchPlan = await researchPlanService.generatePlan(query, options.userId);
            perf.addLlm(Date.now() - planStart);
            researchPlan = {
                ...researchPlan,
                ...researchIntelligenceService.buildQueryBlueprint(query, researchPlan)
            };
            if (onProgress) onProgress({ phase: 'plan_ready', plan: researchPlan });
            await new Promise(r => setTimeout(r, 1500));
        } catch (planError) {
            researchPlan = researchIntelligenceService.buildQueryBlueprint(query, {});
            if (onProgress) onProgress({ phase: 'plan_ready', plan: researchPlan });
        }

        // 1. Check Cache
        if (!options.forceRefresh) {
            const dbReadStart = Date.now();
            const cachedResult = await ResearchCache.findOne({ normalizedQuery }).sort({ createdAt: -1 }).lean();
            perf.addDb(Date.now() - dbReadStart);
            if (cachedResult && cachedResult.sources && cachedResult.sources.length >= Math.min(researchConfig.target_source_count, 5)) {
                log.info('SYSTEM', `Research cache hit: "${query}"`);

                if (onProgress) {
                    onProgress({
                        phase: 'completed',
                        message: 'Retrieved from Cache',
                        fullReport: cachedResult.researchReport,
                        metaData: {
                            retrievalMode: cachedResult.mode || 'HYBRID',
                            totalSources: cachedResult.sources?.length || 0,
                            academicSources: cachedResult.onlineSourceCount || 0,
                            webSources: 0,
                            confidenceScore: cachedResult.overallConfidenceScore || 0,
                            evidenceProfile: cachedResult.evidenceProfile || null
                        },
                        sourceData: cachedResult.sources,
                        graphData: cachedResult.citationGraphData
                    });
                }

                if (cachedResult.researchReport && Object.keys(cachedResult.researchReport).length > 0) {
                    const diagnostics = perf.toLogPayload({
                        branchCount: 1,
                        toolCalls: 0,
                        tokenUsageEstimate: Math.ceil(String(cachedResult.researchReport?.fullReport || '').length / 4),
                    });
                    logPerformance(diagnostics);
                    return {
                        researchBundle: cachedResult,
                        researchReport: cachedResult.researchReport,
                        performanceDiagnostics: diagnostics,
                    };
                }
            }
        }

        // 2. Fetch local evidence
        if (onProgress) onProgress({ phase: 'searching_local', message: 'Checking Internal Knowledge Graph...' });
        const localStart = Date.now();
        const localSources = await localKnowledgeBase.getLocalSources(query, { limit: 10 });
        perf.addTool(Date.now() - localStart);
        const reusableValidatedSources = researchIntelligenceService.getReusableValidatedSources(query, researchConfig.target_source_count);

        const expandedQueries = (researchPlan.expanded_search_queries || []).slice(0, 10);
        const counterQueries = (researchPlan.counter_evidence_queries || []).slice(0, 6);
        const domainExpansionQueries = [
            `${query} arxiv`,
            `${query} government policy report`,
            `${query} industry whitepaper`,
            `${query} technical benchmark report`
        ];

        if (onProgress) onProgress({ phase: 'searching_online', message: `Running expanded retrieval (${expandedQueries.length} analytical queries)...` });

        let onlineSources = [];
        try {
            const onlineStart = Date.now();
            onlineSources = await retrieveSourcesForQuerySet(expandedQueries, { academicPerQuery: 2, webPerQuery: 2 });
            perf.addTool(Date.now() - onlineStart);
        } catch (onlineError) {
            log.error('AI', `Online search failed: ${onlineError.message}`);
        }

        if (onProgress) onProgress({ phase: 'analyzing', message: 'Processing Documents...' });

        // 3/4. Merge, credibility scoring, and validation scoring
        let allSources = researchIntelligenceService.dedupeSources([...reusableValidatedSources, ...localSources, ...onlineSources]);

        if (allSources.length === 0) {
            log.warn('AI', "No sources retrieved from local/online.");
            if (onProgress) onProgress({ phase: 'error', message: 'Research aborted due to insufficient material. No functional online sources found.' });
            throw new Error("Research aborted due to insufficient material.");
        }

        // Credibility scoring
        if (onProgress) onProgress({ phase: 'evaluating', message: 'Evaluating Source Credibility...', sourceData: allSources });
        allSources.forEach((source, index) => {
            try {
                source.citationIndex = index + 1;
                const assessment = sourceCredibilityService.evaluateSourceCredibility(source, allSources);
                source.credibilityScore = assessment.credibilityScore;
                source.credibilityReason = assessment.reason;
            } catch (credErr) {
                source.credibilityScore = 50;
            }
        });

        // Validation scoring against relevance/domain/evidence thresholds (Level 0: default)
        let retrievalMode = 'default';
        let fallbackStage = 0;
        let thresholds = researchIntelligenceService.getAdaptiveThresholds(0);

        let evaluatedSources = researchIntelligenceService.evaluateCorpus(allSources, {
            query,
            dimensions: researchPlan.research_dimensions || [],
            thresholds
        });
        let validSources = evaluatedSources.filter(source => source.sourceValidation?.passesThreshold);
        let selectedSources = researchIntelligenceService.selectTopSourcesWithBalance(validSources, researchConfig);
        let sufficiency = researchIntelligenceService.computeSufficiencyMetrics(selectedSources, researchConfig);
        log.info('RESEARCH', `Evidence metrics (initial): total=${sufficiency.total}, empirical=${sufficiency.empiricalTotal}, academic=${sufficiency.academicTotal}, industry=${sufficiency.industryOrReportTotal}, counter=${sufficiency.counterPosition}`);

        // Fallback ladder (non-blocking unless zero sources)
        while (researchConfig.allow_adaptive_fallback && !researchIntelligenceService.hasSufficientEvidence(sufficiency) && fallbackStage < 4) {
            fallbackStage += 1;

            if (fallbackStage === 1) {
                retrievalMode = 'adaptive';
                const recoveryQueries = researchIntelligenceService.buildRecoveryQueries(query, sufficiency);
                const secondPassQueries = [...counterQueries, ...recoveryQueries].slice(0, 8);

                if (secondPassQueries.length > 0) {
                    if (onProgress) onProgress({ phase: 'searching_online', message: 'Adaptive retrieval L1: expanding semantic queries...' });
                    const recoverySources = await retrieveSourcesForQuerySet(secondPassQueries, { academicPerQuery: 2, webPerQuery: 2 });
                    allSources = researchIntelligenceService.dedupeSources([...allSources, ...recoverySources]);
                }
            }

            if (fallbackStage === 2) {
                retrievalMode = 'adaptive';
                if (onProgress) onProgress({ phase: 'searching_online', message: 'Adaptive retrieval L2: expanding domains (arXiv/industry/policy reports)...' });
                const domainSources = await retrieveSourcesForQuerySet(domainExpansionQueries, { academicPerQuery: 2, webPerQuery: 2 });
                allSources = researchIntelligenceService.dedupeSources([...allSources, ...domainSources]);
            }

            if (fallbackStage === 3) {
                retrievalMode = 'fallback';
                thresholds = researchIntelligenceService.getAdaptiveThresholds(3);
                if (onProgress) onProgress({ phase: 'searching_online', message: 'Adaptive retrieval L3: accepting near-match evidence with lower-confidence tagging...' });
            }

            if (fallbackStage >= 4) {
                retrievalMode = 'fallback';
                if (onProgress) onProgress({ phase: 'searching_online', message: 'Adaptive retrieval L4: controlled proceed mode enabled with available evidence.' });
                break;
            }

            // Re-score credibility for newly merged sources
            allSources.forEach((source, index) => {
                if (source.credibilityScore != null) return;
                source.citationIndex = index + 1;
                const assessment = sourceCredibilityService.evaluateSourceCredibility(source, allSources);
                source.credibilityScore = assessment.credibilityScore;
                source.credibilityReason = assessment.reason;
            });

            evaluatedSources = researchIntelligenceService.evaluateCorpus(allSources, {
                query,
                dimensions: researchPlan.research_dimensions || [],
                thresholds
            });

            validSources = evaluatedSources.filter(source => source.sourceValidation?.passesThreshold);
            selectedSources = researchIntelligenceService.selectTopSourcesWithBalance(validSources, researchConfig);
            if (thresholds.label === 'fallback_near_match') {
                selectedSources = selectedSources.map(s => ({ ...s, lowerConfidenceEvidence: true }));
            }
            sufficiency = researchIntelligenceService.computeSufficiencyMetrics(selectedSources, researchConfig);
            log.info('RESEARCH', `Evidence metrics (fallback L${fallbackStage}): total=${sufficiency.total}, empirical=${sufficiency.empiricalTotal}, academic=${sufficiency.academicTotal}, industry=${sufficiency.industryOrReportTotal}, counter=${sufficiency.counterPosition}`);
        }

        // Controlled proceed mode: continue with partial evidence when non-zero sources exist
        if (selectedSources.length === 0 && validSources.length > 0) {
            selectedSources = validSources.slice(0, Math.min(researchConfig.target_source_count, validSources.length));
            retrievalMode = 'fallback';
            sufficiency = researchIntelligenceService.computeSufficiencyMetrics(selectedSources, researchConfig);
        }

        // Final non-blocking guard: if validation pipeline is too strict, proceed with best available retrieved sources.
        if (selectedSources.length === 0 && allSources.length > 0) {
            const broadEvaluated = researchIntelligenceService.evaluateCorpus(allSources, {
                query,
                dimensions: researchPlan.research_dimensions || [],
                thresholds: { relevance: 0.45, domainAlignment: 0.4, includeNearMatch: true }
            });

            selectedSources = broadEvaluated
                .sort((a, b) => (b.source_score || 0) - (a.source_score || 0))
                .slice(0, Math.min(researchConfig.target_source_count, broadEvaluated.length))
                .map(source => ({ ...source, lowerConfidenceEvidence: true }));

            retrievalMode = 'fallback';
            sufficiency = researchIntelligenceService.computeSufficiencyMetrics(selectedSources, researchConfig);
        }

        if (selectedSources.length === 0) {
            const message = 'Research aborted because zero usable sources were retrieved after adaptive fallback.';
            log.warn('AI', message);
            if (onProgress) onProgress({ phase: 'error', message });
            throw new Error(message);
        }

        // 6b. Citation Enrichment
        if (onProgress) onProgress({ phase: 'enriching', message: 'Enriching Citation Metadata...', sourceData: selectedSources });
        try {
            const enrichStart = Date.now();
            const enrichedSources = await citationEnrichmentService.enrichSources(selectedSources);
            perf.addTool(Date.now() - enrichStart);
            selectedSources.length = 0;
            selectedSources.push(...enrichedSources);

            const completeness = citationEnrichmentService.calculateMetadataCompleteness(selectedSources);
            if (completeness < 70) {
                const retryEnriched = await citationEnrichmentService.enrichSources(selectedSources);
                selectedSources.length = 0;
                selectedSources.push(...retryEnriched);
            }
        } catch (enrichErr) {
            log.warn('AI', `Citation enrichment partial: ${enrichErr.message}`);
        }

        selectedSources.sort((a, b) => {
            const aScore = (a.source_score || ((a.credibilityScore || 0) / 100));
            const bScore = (b.source_score || ((b.credibilityScore || 0) / 100));
            return bScore - aScore;
        });

        const topSources = selectedSources.slice(0, researchConfig.target_source_count);

        if (onProgress) onProgress({ phase: 'graphing', message: 'Constructing Document Citation Graph...', sourceData: topSources });
        const graphData = citationGraphService.buildGraph(topSources);

        if (onProgress) onProgress({ phase: 'verifying', message: 'Extracting mechanisms and counter-evidence units...', sourceData: topSources });
        const verifyStart = Date.now();
        const verificationData = await factCheckingService.verifyCorpusClaims(topSources, query, options.userId);
        perf.addLlm(Date.now() - verifyStart);

        const confidenceMetrics = researchIntelligenceService.computeConfidenceMetrics({
            sources: topSources,
            evidenceUnits: verificationData,
            sufficiencyMetrics: sufficiency,
            researchConfig,
            retrievalMode
        });

        const academicSources = topSources.filter(s => s.sourceType === 'academic');
        const webSources = topSources.filter(s => s.sourceType === 'web');
        const empiricalSources = topSources.filter(s => s.evidenceCategory === 'empirical' || s.sourceType === 'academic' || s.sourceRole?.datasetOrSurvey || s.sourceRole?.empiricalAcademic);
        const industrySources = topSources.filter(s => s.sourceRole?.industryFinancial || s.sourceRole?.policyGovReport);
        const counterSources = topSources.filter(s => s.sourceRole?.counterPosition);

        const evidenceProfile = {
            totalSourcesUsed: topSources.length,
            empiricalSources: empiricalSources.length,
            industrySources: industrySources.length,
            counterEvidenceSources: counterSources.length,
            retrievalMode: retrievalMode === 'default' ? 'Default' : (retrievalMode === 'adaptive' ? 'Adaptive' : 'Fallback')
        };

        const researchResult = {
            query,
            userId: options.userId,
            normalizedQuery,
            mode: evidenceProfile.retrievalMode,
            sources: topSources,
            localSourceCount: localSources.length,
            onlineSourceCount: academicSources.length + webSources.length,
            overallConfidenceScore: confidenceMetrics.overallConfidenceScore,
            createdAt: new Date(),
            plan: researchPlan,
            citationGraphData: graphData,
            verifiedClaimsData: verificationData,
            evidenceSufficiency: sufficiency,
            confidenceMetrics,
            researchConfig,
            evidenceProfile
        };

        researchIntelligenceService.registerValidatedSources(query, topSources);

        if (onProgress) onProgress({ phase: 'synthesizing', message: 'Drafting Final Academic Report...' });
        // log.info('AI', "Synthesizing research report...");

        const synthesisStart = Date.now();
        const finalReport = await researchSynthesisService.generateResearchReport(
            { ...researchResult, plan: researchPlan },
            (token) => {
                if (onProgress) onProgress({ phase: 'token', content: token });
            }
        );
        perf.addLlm(Date.now() - synthesisStart);

        // 10. Save to History
        try {
            const dbWriteStart = Date.now();
            const cachePayload = { ...researchResult, researchReport: finalReport, title: query };
            await ResearchCache.create(cachePayload);
            perf.addDb(Date.now() - dbWriteStart);
            log.success('SYSTEM', `Deep research session saved: "${query}"`);
        } catch (cacheError) {
            log.error('SYSTEM', `Failed to save research: ${cacheError.message}`);
        }

        const finalResponse = {
            researchBundle: researchResult,
            researchReport: finalReport
        };

        if (onProgress) {
            onProgress({
                phase: 'completed',
                message: 'Research Complete.',
                fullReport: finalReport,
                metaData: {
                    retrievalMode: researchResult.mode,
                    totalSources: researchResult.sources?.length || 0,
                    academicSources: academicSources.length,
                    webSources: webSources.length,
                    confidenceScore: researchResult.overallConfidenceScore,
                    confidenceExplanation: confidenceMetrics.explanation,
                    evidenceProfile
                },
                sourceData: researchResult.sources,
                graphData: researchResult.citationGraphData
            });
        }

        const duration = Date.now() - startTime;
        const diagnostics = perf.toLogPayload({
            branchCount: 1,
            toolCalls: expandedQueries.length,
            tokenUsageEstimate: Math.ceil(String(finalReport?.fullReport || finalReport?.summary || '').length / 4),
        });
        logPerformance(diagnostics);
        log.success('AI', `Research synthesis complete (${topSources.length} qualified sources, ${duration}ms)`);

        return {
            ...finalResponse,
            performanceDiagnostics: diagnostics,
        };
    }
};

module.exports = deepResearchOrchestrator;
