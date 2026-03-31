import React from 'react';
import { useDeepResearch } from '../../contexts/DeepResearchContext';
import { BookOpen, Globe, CheckCircle, Database } from 'lucide-react';

export default function ResearchPipelineTracker({ activeTab, onTabSelect }) {
  const { pipelineStage, sources } = useDeepResearch();

  const stages = [
    { id: 'planning', label: 'Methodology Framework', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'discovery', label: 'Semantic Discovery', icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'evaluation', label: 'Credibility Validation', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { id: 'synthesis', label: 'Knowledge Synthesis', icon: <Database className="w-3.5 h-3.5" /> }
  ];

  const getStageStatus = (stageId) => {
    const stageOrder = ['planning', 'discovery', 'evaluation', 'synthesis', 'complete'];
    const currentIndex = stageOrder.indexOf(pipelineStage);
    const stageIndex = stageOrder.indexOf(stageId);

    if (currentIndex > stageIndex) return 'complete';
    if (currentIndex === stageIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="flex flex-col space-y-4 px-6 py-4">
      <h3 className="text-[11px] uppercase tracking-widest text-[#666666] font-semibold mb-2 font-sans">
        Live Protocol
      </h3>

      <div className="relative border-l border-[#2A2A2A] ml-2.5 space-y-6 pb-2">
        {stages.map((stage) => {
          const status = getStageStatus(stage.id);
          const isActive = status === 'active';
          const isComplete = status === 'complete';
          
          const stageOrder = ['planning', 'discovery', 'evaluation', 'synthesis', 'complete'];
          const currentIndex = stageOrder.indexOf(pipelineStage);
          const stageIndex = stageOrder.indexOf(stage.id);
          const isClickable = currentIndex >= stageIndex;

          return (
            <div 
              key={stage.id} 
              className={`relative pl-8 py-2 -ml-2 rounded-md transition-colors ${isClickable ? 'cursor-pointer hover:bg-[#1A1A1A]' : ''} ${activeTab === stage.id ? 'bg-[#1A1A1A]' : ''}`}
              onClick={() => {
                if (isClickable && onTabSelect) {
                  onTabSelect(stage.id);
                }
              }}
            >
              {/* Timeline Dot */}
              <div 
                className={`absolute left-[3px] top-3.5 w-2 h-2 rounded-full border border-[#0B0B0B] transition-all duration-300
                  ${stage.id === activeTab ? 'bg-[#00D1FF] shadow-[0_0_8px_rgba(0,209,255,0.4)] scale-125' :
                    isComplete ? 'bg-[#FFFFFF]' : (isActive ? 'bg-[#00D1FF] shadow-[0_0_8px_rgba(0,209,255,0.4)]' : 'bg-[#2A2A2A]')}`}
              />

              <div className="flex items-start space-x-3">
                <div className={`mt-[2px] transition-colors duration-300 ${stage.id === activeTab ? 'text-[#00D1FF]' : isActive ? 'text-[#00D1FF]' : (isComplete ? 'text-[#FFFFFF]' : 'text-[#666666]')}`}>
                  {stage.icon}
                </div>
                <div className="flex flex-col mt-0.5">
                  <span className={`text-[13px] font-medium transition-colors duration-300
                    ${stage.id === activeTab ? 'text-[#00D1FF]' : isActive ? 'text-[#FFFFFF]' : (isComplete ? 'text-[#B3B3B3]' : 'text-[#666666]')}`}>
                    {stage.label}
                  </span>
                  
                  {/* Sub-status contextual text */}
                  {isActive && stage.id === 'discovery' && (
                    <span className="text-[11px] text-[#B3B3B3] mt-1 opacity-80">
                      Querying academic & web nodes...
                    </span>
                  )}
                  {isActive && stage.id === 'evaluation' && sources.length > 0 && (
                    <span className="text-[11px] text-[#B3B3B3] mt-1 opacity-80">
                      Evaluating {sources.length} sources...
                    </span>
                  )}
                  {isComplete && stage.id === 'evaluation' && sources.length > 0 && (
                    <span className="text-[11px] text-[#666666] mt-1">
                      {sources.length} sources enriched.
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
