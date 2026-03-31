// frontend/src/components/chat/ThinkingDropdown.jsx
import React, { useState } from 'react';
import { ChevronDown, BrainCircuit, CheckCircle2, XCircle, Loader2, GitBranch, List, Gauge, Route, Database, Cog, Microscope, Sparkles, PenSquare } from 'lucide-react';
import Animate from '../core/Animate.jsx';
import TaskTreeVisualization from './TaskTreeVisualization';

const STEP_META = {
    complexity_analysis: { label: 'Complexity Analysis', icon: Gauge },
    complexity_check: { label: 'Complexity Analysis', icon: Gauge },
    decomposition: { label: 'Strategy Formation', icon: Route },
    planning: { label: 'Strategy Formation', icon: Route },
    search: { label: 'Knowledge Retrieval', icon: Database },
    retrieval: { label: 'Knowledge Retrieval', icon: Database },
    modeling: { label: 'Building Reasoning Model', icon: Cog },
    analysis_loop: { label: 'Scenario Simulation', icon: Microscope },
    scenario_simulation: { label: 'Scenario Simulation', icon: Microscope },
    self_critique: { label: 'Self-Critique', icon: BrainCircuit },
    synthesis: { label: 'Final Synthesis', icon: PenSquare },
    final_synthesis: { label: 'Final Synthesis', icon: PenSquare },
    confidence_calibration: { label: 'Confidence Calibration', icon: Sparkles }
};

// --- Step Timeline Item ---
const StepTimelineItem = ({ step, isLast }) => {
    const statusConfig = {
        processing: {
            icon: <Loader2 size={14} className="animate-spin text-blue-400" />,
            borderColor: 'border-blue-500/50',
            bgColor: 'bg-blue-500/10',
            labelColor: 'text-blue-400',
        },
        completed: {
            icon: <CheckCircle2 size={14} className="text-emerald-400" />,
            borderColor: 'border-emerald-500/30',
            bgColor: 'bg-emerald-500/5',
            labelColor: 'text-emerald-400',
        },
        failed: {
            icon: <XCircle size={14} className="text-red-400" />,
            borderColor: 'border-red-500/30',
            bgColor: 'bg-red-500/5',
            labelColor: 'text-red-400',
        },
    };

    const config = statusConfig[step.status] || statusConfig.processing;
    const meta = STEP_META[step.stepId] || {};
    const StepIcon = meta.icon || BrainCircuit;
    const displayTitle = meta.label || step.title || step.stepId;
    const hasStepConfidence = Number.isFinite(step.stepConfidence);
    const hasBranchMeta = Number.isFinite(step.dynamicBranchCount) || Number.isFinite(step.branchesPruned);

    return (
        <Animate
            animation="slide-right"
            duration="0.3s"
            className="flex gap-3 relative"
        >
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.bgColor} border ${config.borderColor}`}>
                    {config.icon}
                </div>
                {!isLast && (
                    <div className="w-px flex-1 bg-zinc-700/50 mt-1" />
                )}
            </div>

            {/* Content */}
            <div className={`pb-3 flex-1 min-w-0`}>
                <p className={`text-xs font-semibold ${config.labelColor} truncate flex items-center gap-1.5`}>
                    <StepIcon size={12} className="opacity-90" />
                    {displayTitle}
                </p>
                {step.content && (
                    <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {step.content}
                    </p>
                )}

                {(hasStepConfidence || hasBranchMeta) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {hasStepConfidence && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                Step Confidence: {step.stepConfidence}%
                            </span>
                        )}
                        {Number.isFinite(step.dynamicBranchCount) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                Branches: {step.dynamicBranchCount}
                            </span>
                        )}
                        {Number.isFinite(step.branchesPruned) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                Pruned: {step.branchesPruned}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </Animate>
    );
};

// --- Confidence Meter ---
const ConfidenceMeter = ({ score }) => {
    if (score === null || score === undefined) return null;

    const getColor = (s) => {
        if (s > 80) return { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' };
        if (s >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/20' };
        return { bar: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/20' };
    };

    const colors = getColor(score);

    return (
        <Animate
            animation="slide-up-sm"
            className="mt-2 pt-2 border-t border-zinc-700/50"
        >
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Confidence</span>
                <span className={`text-xs font-bold ${colors.text}`}>{score}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                    style={{ width: `${score}%`, transition: 'width 0.8s ease-out' }}
                    className={`h-full rounded-full ${colors.bar} shadow-sm ${colors.glow}`}
                />
            </div>
        </Animate>
    );
};

// --- Main ThinkingDropdown ---
function ThinkingDropdown({ children, isOpen, setIsOpen, isStreaming, status, steps, confidenceScore }) {
    const [viewMode, setViewMode] = useState('timeline');
    const hasSteps = steps && steps.length > 0;

    return (
        <div className="w-full">
            <div className="flex items-center justify-between gap-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors py-1.5 group"
                    aria-expanded={isOpen}
                >
                    <BrainCircuit size={14} className="text-zinc-500 group-hover:text-zinc-400 transition-colors" />

                    <span className={isStreaming ? 'shimmer-container' : ''}>
                        {status || (isStreaming ? "Reasoning Timeline" : "Thinking Process")}
                    </span>

                    <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && hasSteps && (
                    <div className="flex bg-zinc-900/60 p-0.5 rounded-lg border border-white/[0.04]">
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${viewMode === 'timeline' ? 'bg-zinc-700/80 text-zinc-200 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            <List size={10} />
                            Steps
                        </button>
                        <button
                            onClick={() => setViewMode('graph')}
                            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${viewMode === 'graph' ? 'bg-zinc-700/80 text-zinc-200 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}
                        >
                            <GitBranch size={10} />
                            Graph
                        </button>
                    </div>
                )}
            </div>

            <div
                style={{
                    opacity: isOpen ? 1 : 0,
                    height: isOpen ? 'auto' : 0,
                    marginTop: isOpen ? '0.25rem' : '0',
                    transition: 'opacity 0.3s ease-in-out, margin-top 0.3s ease-in-out',
                }}
                className="overflow-hidden"
            >
                {/* View Mode Switching */}
                {hasSteps && (
                    <div className="mt-1">
                        {viewMode === 'timeline' ? (
                            <div className="pl-2 space-y-0 mb-2 border-l-2 border-zinc-800/80">
                                {steps.map((step, index) => (
                                        <StepTimelineItem
                                            key={step.stepId}
                                            step={step}
                                            isLast={index === steps.length - 1}
                                        />
                                    ))}
                            </div>
                        ) : (
                            <div className="mb-3">
                                <TaskTreeVisualization steps={steps} />
                            </div>
                        )}
                    </div>
                )}

                {/* Confidence Meter */}
                {confidenceScore !== null && confidenceScore !== undefined && (
                    <div className="pl-2 border-l-2 border-zinc-800/80">
                        <ConfidenceMeter score={confidenceScore} />
                    </div>
                )}

                {/* Legacy content (raw thinking text) */}
                {!hasSteps && children && (
                    <div className="mt-1 pl-2 border-l-2 border-zinc-800/80">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ThinkingDropdown;
