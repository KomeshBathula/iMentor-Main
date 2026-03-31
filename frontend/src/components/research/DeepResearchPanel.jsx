import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeepResearch } from '../../contexts/DeepResearchContext';
import ResearchPipelineTracker from './ResearchPipelineTracker';
import SourceCard from './SourceCard';
import ResearchReport from './ResearchReport';
import { Activity, Beaker, Map, FileText, ChevronRight, ChevronDown, BookOpen, ArrowLeft, Search, BarChart3, FlaskConical, Building2, Brain, CheckCircle2, Clock3, MessageSquare } from 'lucide-react';

export default function DeepResearchPanel({ onToggleMode }) {
   const navigate = useNavigate();
   const { pipelineStage, researchPlan, meta, reportContent, finalReportData, sources, progressMessage } = useDeepResearch();
   const [activeTab, setActiveTab] = useState(null);
   const [isStrategyOpen, setIsStrategyOpen] = useState(false);
   const [traceOpen, setTraceOpen] = useState(false);
   const [reassuranceIndex, setReassuranceIndex] = useState(0);
   const [showCompletionTransition, setShowCompletionTransition] = useState(false);

   const reassuranceMessages = useMemo(() => [
      'Evaluating empirical strength of retrieved studies…',
      'Filtering low-credibility sources…',
      'Building structural comparison model…',
      'Detecting counter-arguments…'
   ], []);

   useEffect(() => {
      setActiveTab(pipelineStage);
   }, [pipelineStage]);

   useEffect(() => {
      if (pipelineStage === 'complete') return;
      const timer = setInterval(() => {
         setReassuranceIndex(prev => (prev + 1) % reassuranceMessages.length);
      }, 2600);
      return () => clearInterval(timer);
   }, [pipelineStage, reassuranceMessages.length]);

   useEffect(() => {
      if (pipelineStage !== 'complete') return;
      setShowCompletionTransition(true);
      const t = setTimeout(() => setShowCompletionTransition(false), 1700);
      return () => clearTimeout(t);
   }, [pipelineStage]);

   const isComplete = pipelineStage === 'complete';
   const currentView = activeTab || pipelineStage;

   const targetSources = useMemo(() => {
      const fromMeta = meta?.evidenceProfile?.totalSourcesUsed;
      if (typeof fromMeta === 'number' && fromMeta > 0) return fromMeta;
      return 5;
   }, [meta]);

   const empiricalCount = useMemo(
      () => sources.filter(s => s?.evidenceCategory === 'empirical' || s?.sourceType === 'academic' || s?.sourceRole?.datasetOrSurvey).length,
      [sources]
   );

   const industryCount = useMemo(
      () => sources.filter(s => s?.sourceRole?.industryFinancial || s?.sourceRole?.policyGovReport || s?.sourceType === 'web').length,
      [sources]
   );

   const counterCount = useMemo(
      () => sources.filter(s => s?.sourceRole?.counterPosition).length,
      [sources]
   );

   const empiricalRatio = targetSources > 0 ? Math.round((empiricalCount / Math.max(1, sources.length)) * 100) : 0;

   const stageStates = useMemo(() => {
      const order = ['planning', 'discovery', 'evaluation', 'synthesis', 'complete'];
      const currentIndex = order.indexOf(pipelineStage);
      const stateFor = (idx) => (currentIndex > idx ? 'done' : currentIndex === idx ? 'active' : 'queued');
      return {
         methodology: stateFor(0),
         discovery: stateFor(1),
         credibility: stateFor(2),
         synthesis: stateFor(3)
      };
   }, [pipelineStage]);

   const activityCards = useMemo(() => {
      const expandedCount = researchPlan?.expanded_search_queries?.length || researchPlan?.research_dimensions?.length || 0;
      return [
         { icon: <Search className="w-4 h-4" />, title: 'Query Expansion Generated', value: `${expandedCount} semantic queries created`, active: expandedCount > 0 },
         { icon: <BookOpen className="w-4 h-4" />, title: 'Sources Retrieved', value: `${Math.min(sources.length, targetSources)} / ${targetSources} target`, active: sources.length > 0 },
         { icon: <BarChart3 className="w-4 h-4" />, title: 'Empirical Papers Identified', value: `${empiricalCount}`, active: empiricalCount > 0 },
         { icon: <FlaskConical className="w-4 h-4" />, title: 'Counter-Evidence Search', value: counterCount > 0 ? `${counterCount} found` : 'Running', active: counterCount > 0 || pipelineStage === 'evaluation' },
         { icon: <Building2 className="w-4 h-4" />, title: 'Industry Reports Validated', value: `${industryCount}`, active: industryCount > 0 },
         { icon: <Brain className="w-4 h-4" />, title: 'Structural Modeling', value: pipelineStage === 'synthesis' || pipelineStage === 'complete' ? 'Preparing insights' : 'Queued', active: pipelineStage === 'synthesis' || pipelineStage === 'complete' }
      ];
   }, [researchPlan, sources.length, targetSources, empiricalCount, counterCount, industryCount, pipelineStage]);

   const lowCredRejected = useMemo(
      () => sources.filter(s => (s?.credibilityScore || 0) < 50),
      [sources]
   );

   const renderStageLine = (label, state) => {
      const isDone = state === 'done';
      const isActive = state === 'active';
      return (
         <div className="flex items-center justify-between py-2" key={label}>
            <div className="flex items-center gap-2">
               {isDone ? <CheckCircle2 className="w-4 h-4 text-[#00D1FF]" /> : <Clock3 className={`w-4 h-4 ${isActive ? 'text-[#00D1FF] animate-pulse' : 'text-[#666666]'}`} />}
               <span className={`text-sm ${isDone || isActive ? 'text-white' : 'text-[#777777]'}`}>{label}</span>
            </div>
            <span className={`text-[11px] uppercase tracking-wide ${isDone ? 'text-[#00D1FF]' : isActive ? 'text-[#B3F5FF]' : 'text-[#555555]'}`}>
               {isDone ? 'Done' : isActive ? 'In Progress…' : 'Queued'}
            </span>
         </div>
      );
   };

   return (
      <div className="flex h-full w-full bg-[#0B0B0B] text-[#FFFFFF] overflow-hidden">

         {/* LEFT SIDEBAR: Pipeline Tracker & Research Plan */}
         <aside className="w-[280px] border-r border-[#2A2A2A] flex flex-col flex-shrink-0 relative bg-[#0B0B0B] overflow-y-auto custom-scrollbar">

            {/* Navigation / Back Buttons */}
            <div className="px-6 pt-5 pb-2 flex flex-col gap-3">
               <button
                  onClick={onToggleMode}
                  className="flex items-center text-[11px] font-bold text-[#666666] uppercase tracking-widest hover:text-[#FFFFFF] transition-colors group"
               >
                  <ArrowLeft className="w-3.5 h-3.5 mr-2 group-hover:-translate-x-1 transition-transform" />
                  New Research
               </button>
               <button
                  onClick={() => navigate('/')}
                  className="flex items-center text-[11px] font-bold text-[#00D1FF] uppercase tracking-widest hover:text-[#FFFFFF] transition-colors group"
               >
                  <MessageSquare className="w-3.5 h-3.5 mr-2" />
                  Back to Chat
               </button>
            </div>


            <div className="px-6 pb-5 border-b border-[#1A1A1A] mt-4">
               <h1 className="text-[13px] font-semibold text-[#FFFFFF] tracking-wide flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-[#B3B3B3]" />
                  Active Protocol
               </h1>
            </div>

            {/* Research Plan Strategy Section */}
            {researchPlan && (
               <div className="px-6 py-4 border-b border-[#1A1A1A]">
                  <button 
                     onClick={() => setIsStrategyOpen(!isStrategyOpen)}
                     className="w-full flex items-center justify-between text-[11px] uppercase tracking-widest text-[#666666] font-semibold hover:text-[#B3B3B3] transition-colors"
                  >
                     <div className="flex items-center">
                        <Map className="w-3.5 h-3.5 mr-1.5" />
                        Strategy Dimensions
                     </div>
                     {isStrategyOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  {isStrategyOpen && (
                     <ul className="space-y-2 text-[13px] mt-4">
                        {researchPlan?.research_dimensions?.map((focus, i) => (
                           <li key={i} className="flex items-start text-[#B3B3B3]">
                              <ChevronRight className="w-3.5 h-3.5 min-w-[14px] mt-0.5 mr-1.5 text-[#666666]" />
                              <span className="leading-snug">{focus}</span>
                           </li>
                        ))}
                     </ul>
                  )}
               </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
               <ResearchPipelineTracker activeTab={currentView} onTabSelect={setActiveTab} />
            </div>

            {/* Meta Data Box (Appears when evaluation completes) */}
            {meta && (
               <div className="p-5 border-t border-[#1A1A1A]">
                  <h3 className="text-[11px] uppercase tracking-widest text-[#666666] font-semibold mb-3">Credibility Matrix</h3>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                     <div className="bg-[#121212] border border-[#1A1A1A] p-2.5 rounded-sm">
                        <span className="block text-[#666666] mb-1 text-[11px]">Mode</span>
                        <strong className="text-[#FFFFFF]">{meta.retrievalMode || 'Default'}</strong>
                     </div>
                     <div className="bg-[#121212] border border-[#1A1A1A] p-2.5 rounded-sm">
                        <span className="block text-[#666666] mb-1 text-[11px]">Confidence</span>
                        <strong className="text-[#FFFFFF]">{typeof meta.confidenceScore === 'number' ? `${meta.confidenceScore}/100` : '0/100'}</strong>
                     </div>
                     <div className="bg-[#121212] border border-[#1A1A1A] p-2.5 rounded-sm col-span-2 flex justify-between items-center">
                        <span className="text-[#666666] text-[11px]">Sources</span>
                        <div className="text-right">
                           <strong className="text-[#FFFFFF] block leading-none mb-1">{meta.totalSources} Total</strong>
                           <span className="text-[10px] text-[#666666]">{meta.academicSources} Academic | {meta.webSources} Web</span>
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </aside>

         {/* MAIN CONTENT AREA: Realtime Stream or Completed Report */}
         <main className="flex-1 relative bg-[#0B0B0B] overflow-y-auto custom-scrollbar p-6">
            <div className="max-w-[900px] w-full mx-auto">
               {/* Real-time Discovery & Evaluation View */}
               {(currentView === 'discovery' || currentView === 'evaluation') && (
                  <div className="flex flex-col h-full min-h-[50vh] duration-500 py-12">
                     <div className="mb-10 pb-6 border-b border-[#1A1A1A]">
                        <h2 className="text-[22px] font-semibold text-[#FFFFFF] flex items-center mb-2 tracking-tight">
                           <span className="mr-3">🔬</span>
                           Research Intelligence in Progress
                           <span className="ml-3 inline-flex gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] animate-pulse"></span>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] animate-pulse [animation-delay:120ms]"></span>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] animate-pulse [animation-delay:240ms]"></span>
                           </span>
                        </h2>
                        <p className="text-[14px] text-[#B3B3B3] leading-relaxed">Analyzing academic databases, industry reports, and empirical studies.</p>
                     </div>

                     {/* Live dashboard */}
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                        <section className="lg:col-span-2 bg-[#101214] border border-[#1D2A30] rounded-lg p-4 shadow-[0_0_0_1px_rgba(0,209,255,0.03)]">
                           <h3 className="text-[12px] uppercase tracking-widest text-[#8FBBC3] mb-3">Live Research Activity</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {activityCards.map((card) => (
                                 <div key={card.title} className="bg-[#0E1012] border border-[#1A2328] rounded-md p-3 flex items-start gap-3">
                                    <div className={`mt-0.5 ${card.active ? 'text-[#00D1FF]' : 'text-[#5F6A6F]'}`}>{card.icon}</div>
                                    <div>
                                       <div className="text-[12px] text-[#B7C6CB]">{card.title}</div>
                                       <div className={`text-[13px] font-medium ${card.active ? 'text-white' : 'text-[#7A878C]'}`}>{card.value}</div>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </section>

                        <section className="bg-[#101214] border border-[#1D2A30] rounded-lg p-4">
                           <h3 className="text-[12px] uppercase tracking-widest text-[#8FBBC3] mb-3">Evidence Profile</h3>
                           <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-[#8FA4AB]">Target Sources</span><span className="text-white">{targetSources}</span></div>
                              <div className="flex justify-between"><span className="text-[#8FA4AB]">Retrieved</span><span className="text-white">{Math.min(sources.length, targetSources)}</span></div>
                              <div className="flex justify-between"><span className="text-[#8FA4AB]">Empirical Ratio</span><span className="text-white">{empiricalRatio}%</span></div>
                              <div className="flex justify-between"><span className="text-[#8FA4AB]">Counter Sources</span><span className="text-white">{counterCount}</span></div>
                           </div>
                           <div className="mt-3 h-1.5 bg-[#172025] rounded-full overflow-hidden">
                              <div className="h-full bg-[#00D1FF] transition-all duration-700" style={{ width: `${Math.min(100, (Math.min(sources.length, targetSources) / Math.max(1, targetSources)) * 100)}%` }} />
                           </div>
                        </section>
                     </div>

                     {/* Staged timeline */}
                     <section className="bg-[#0F1113] border border-[#1A2328] rounded-lg p-4 mb-6">
                        <h3 className="text-[12px] uppercase tracking-widest text-[#8FBBC3] mb-2">Research Progress</h3>
                        {renderStageLine('Methodology Framework', stageStates.methodology)}
                        {renderStageLine('Semantic Discovery', stageStates.discovery)}
                        {renderStageLine('Credibility Validation', stageStates.credibility)}
                        {renderStageLine('Knowledge Synthesis', stageStates.synthesis)}
                     </section>

                     {/* Reassurance rotation */}
                     <section className="mb-6 text-[13px] text-[#9BC8D3] bg-[#0B1317] border border-[#17313A] rounded-md px-4 py-3">
                        {reassuranceMessages[reassuranceIndex]}
                     </section>

                     {/* Research trace */}
                     <section className="mb-8">
                        <button
                           onClick={() => setTraceOpen(!traceOpen)}
                           className="text-[12px] uppercase tracking-widest text-[#7CCFDE] hover:text-[#B3F5FF] flex items-center gap-2"
                        >
                           {traceOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                           View Live Research Trace
                        </button>
                        {traceOpen && (
                           <div className="mt-3 bg-[#0E1012] border border-[#1A2328] rounded-lg p-4 space-y-4 text-sm">
                              <div>
                                 <div className="text-[#8FBBC3] mb-2">Generated Search Queries</div>
                                 <ul className="space-y-1 text-[#B3BFC4]">
                                    {(researchPlan?.expanded_search_queries || []).slice(0, 8).map((q, idx) => <li key={idx}>• {q}</li>)}
                                    {(!researchPlan?.expanded_search_queries || researchPlan.expanded_search_queries.length === 0) && <li className="text-[#6F7D84]">No query trace available yet.</li>}
                                 </ul>
                              </div>
                              <div>
                                 <div className="text-[#8FBBC3] mb-2">Source Scoring Snapshot</div>
                                 <ul className="space-y-1 text-[#B3BFC4]">
                                    {sources.slice(0, 6).map((s, idx) => (
                                       <li key={idx}>• {(s.title || 'Untitled').substring(0, 80)} — credibility {(s.credibilityScore ?? 'N/A')}</li>
                                    ))}
                                    {sources.length === 0 && <li className="text-[#6F7D84]">No scoring data streamed yet.</li>}
                                 </ul>
                              </div>
                              <div>
                                 <div className="text-[#8FBBC3] mb-2">Rejected / Low-Credibility Sources</div>
                                 <ul className="space-y-1 text-[#B3BFC4]">
                                    {lowCredRejected.slice(0, 6).map((s, idx) => (
                                       <li key={idx}>• {(s.title || 'Untitled').substring(0, 80)} — credibility {(s.credibilityScore ?? 'N/A')}</li>
                                    ))}
                                    {lowCredRejected.length === 0 && <li className="text-[#6F7D84]">No explicit low-credibility rejections in current stream.</li>}
                                 </ul>
                              </div>
                           </div>
                        )}
                     </section>

                     <div className="space-y-4">
                        {sources.map((src, idx) => (
                           <SourceCard key={src.id || idx} source={src} />
                        ))}
                        {/* Skeleton loader - elegant minimal fade */}
                        {sources.length === 0 && (
                           <div className="w-full h-24 border border-[#1A1A1A] bg-[#121212] rounded-sm p-6 opacity-60">
                              <div className="w-8 h-8 bg-[#1A1A1A] rounded-sm mb-4"></div>
                              <div className="h-2.5 bg-[#1A1A1A] w-[60%] rounded-full mb-3"></div>
                              <div className="h-2 bg-[#1A1A1A] w-[30%] rounded-full"></div>
                           </div>
                        )}
                     </div>
                  </div>
               )}

               {currentView === 'planning' && (
                  <div className="flex flex-col items-center justify-center h-full min-h-[60vh] duration-700 ease-in-out">
                     <div className="relative mb-8">
                        <div className="absolute inset-0 bg-[#00D1FF]/20 rounded-full blur-2xl animate-pulse"></div>
                        <Beaker className="w-12 h-12 text-[#00D1FF] relative z-10" />
                     </div>
                     <div className="space-y-6 text-center max-w-[400px]">
                        <h2 className="text-[20px] font-medium text-[#FFFFFF] tracking-tight">
                           {progressMessage || 'Constructing Research Framework'}
                        </h2>
                        <div className="flex flex-col items-center space-y-3">
                           <div className="w-[200px] h-[1px] bg-[#1A1A1A] relative overflow-hidden">
                              <div className="absolute top-0 left-0 h-full w-1/3 bg-[#00D1FF] animate-[loading_1.5s_infinite]"></div>
                           </div>
                           <p className="text-[13px] text-[#666666] tracking-wide uppercase">
                              Preparing Research Nodes
                           </p>
                        </div>
                     </div>
                     <style dangerouslySetInnerHTML={{
                        __html: `
                    @keyframes loading {
                       0% { left: -33%; }
                       100% { left: 100%; }
                    }
                 `}} />
                  </div>
               )}

               {/* Live Streaming Synthesis View */}
               {(currentView === 'synthesis' && !finalReportData) && (
                  <div className="prose prose-invert max-w-none text-[#FFFFFF] leading-loose text-[16px] duration-500 py-12">
                     <div className="flex items-center text-[#B3B3B3] mb-8 text-[11px] uppercase tracking-widest border-b border-[#1A1A1A] pb-4 font-semibold">
                        <FileText className="w-3.5 h-3.5 mr-2" />
                        Drafting Synthesis
                     </div>
                     <div className="whitespace-pre-wrap">{reportContent}</div>
                     <span className="inline-block w-1.5 h-4 bg-[#FFFFFF] ml-1 opacity-70 animate-pulse"></span>
                  </div>
               )}

               {/* Completed Document View */}
               {((currentView === 'synthesis' && finalReportData) || currentView === 'complete') && (
                  <div className="py-12">
                     {showCompletionTransition && (
                        <div className="mb-6 bg-[#0C1418] border border-[#1A3A45] rounded-lg p-4 text-[#BDF6FF] animate-pulse">
                           <div className="text-lg font-semibold">📘 Evidence Synthesis Complete</div>
                           <div className="text-sm text-[#9DD8E2]">Transitioning to final analytical report…</div>
                        </div>
                     )}
                     <ResearchReport
                        researchReport={finalReportData?.researchReport || finalReportData}
                     />
                  </div>
               )}

               {/* Error / Aborted View */}
               {currentView === 'error' && (
                  <div className="flex flex-col items-center justify-center h-full min-h-[50vh] duration-700 ease-in-out">
                     <div className="relative mb-6">
                        <div className="absolute inset-0 bg-[#FF3B30]/10 rounded-full blur-xl animate-pulse"></div>
                        <Activity className="w-10 h-10 text-[#FF3B30] relative z-10 opacity-80" />
                     </div>
                     <div className="space-y-4 text-center max-w-[420px]">
                        <h2 className="text-[18px] font-medium text-[#FFFFFF] tracking-tight">
                           {progressMessage || 'Research Aborted'}
                        </h2>
                        <p className="text-[14px] text-[#B3B3B3] leading-relaxed">
                           Adaptive retrieval could not locate any usable sources after all fallback stages. Please refine your query or broaden the topic scope.
                        </p>
                        <p className="text-[12px] text-[#666666] italic mt-2">
                           No file was generated or saved to your history.
                        </p>
                        <button 
                           onClick={onToggleMode} 
                           className="mt-6 px-5 py-2.5 bg-[#121212] border border-[#2A2A2A] text-[#B3B3B3] text-[12px] font-semibold rounded-sm tracking-wide uppercase hover:bg-[#1A1A1A] hover:text-[#FFFFFF] transition-all"
                        >
                           Start New Research
                        </button>
                     </div>
                  </div>
               )}
            </div>
         </main>

      </div>
   );
}
