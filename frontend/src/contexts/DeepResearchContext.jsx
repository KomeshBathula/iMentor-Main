import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const DeepResearchContext = createContext();

export function useDeepResearch() {
  return useContext(DeepResearchContext);
}

export function DeepResearchProvider({ children }) {
  const [isResearchMode, setIsResearchMode] = useState(false);
  const [query, setQuery] = useState('');
  
  // Pipeline stages: 'idle', 'planning', 'discovery', 'evaluation', 'synthesis', 'complete', 'error'
  const [pipelineStage, setPipelineStage] = useState('idle');
  
  const [researchPlan, setResearchPlan] = useState(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [sources, setSources] = useState([]);
  const [reportContent, setReportContent] = useState('');
  const [finalReportData, setFinalReportData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [citationGraph, setCitationGraph] = useState(null);

  // Expose a method for the Chat/Socket to push updates to this context
  const handleResearchUpdate = useCallback((event) => {
    const { phase, message, plan, sourceData, token, fullReport, metaData, graphData } = event;

    if (message) setProgressMessage(message);

    if (phase === 'init') {
      setPipelineStage('planning');
    } else if (phase === 'plan_ready') {
      setResearchPlan(plan);
      setPipelineStage('discovery');
    } else if (phase === 'searching_local' || phase === 'searching_online') {
      setPipelineStage('discovery');
    } else if (phase === 'evaluating' || phase === 'enriching' || phase === 'graphing' || phase === 'verifying') {
      setPipelineStage('evaluation');
      if (sourceData) {
        setSources(sourceData);
      }
    } else if (phase === 'synthesizing' || phase === 'clustering' || phase === 'contradiction') {
      setPipelineStage('synthesis');
    } else if (phase === 'token') {
      if (token) setReportContent(prev => prev + token);
    } else if (phase === 'completed') {
      setPipelineStage('complete');
      if (fullReport) setFinalReportData(fullReport);
      if (metaData) setMeta(metaData);
      if (graphData) setCitationGraph(graphData);
      if (sourceData) setSources(sourceData);
    } else if (phase === 'error') {
      setPipelineStage('error');
      setProgressMessage(event.message || 'Research failed.');
    }
  }, []);

  const resetResearch = useCallback(() => {
    setQuery('');
    setPipelineStage('idle');
    setResearchPlan(null);
    setProgressMessage('');
    setSources([]);
    setReportContent('');
    setFinalReportData(null);
    setMeta(null);
    setCitationGraph(null);
  }, []);
  
  const restoreFromHistory = useCallback((historyEntry) => {
    setIsResearchMode(true);
    setQuery(historyEntry.query || historyEntry.title || '');
    setResearchPlan(historyEntry.detailedPlan || historyEntry.plan || null);
    setSources(historyEntry.sourcesUsed || historyEntry.sources || []);
    
    // Check if historyEntry contains the report directly or nested
    const reportData = historyEntry.researchReport || historyEntry.result || historyEntry;
    setFinalReportData(reportData);
    
    setMeta(historyEntry.metrics || historyEntry.meta || null);
    // Simulate pipeline completion
    setPipelineStage('complete');
  }, []);

  const value = {
    isResearchMode,
    setIsResearchMode,
    query,
    setQuery,
    pipelineStage,
    setPipelineStage,
    researchPlan,
    progressMessage,
    setProgressMessage,
    sources,
    reportContent,
    finalReportData,
    meta,
    citationGraph,
    handleResearchUpdate,
    resetResearch,
    restoreFromHistory
  };

  return (
    <DeepResearchContext.Provider value={value}>
      {children}
    </DeepResearchContext.Provider>
  );
}
