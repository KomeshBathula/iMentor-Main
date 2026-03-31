import React, { useState } from 'react';
import { AlertCircle, Target, BarChart3, Binary, ShieldAlert, Zap } from 'lucide-react';

const ResearchReport = ({ researchReport }) => {
    if (!researchReport) return null;

    const summary = researchReport.executiveSummary || {};
    const crossAnalysis = researchReport.crossSourceAnalysis || {};
    const quantSummary = researchReport.quantitativeSummary || {};
    const risks = researchReport.riskAssessment || {};
    const evidenceProfile = researchReport.evidenceProfile || {};

    return (
        <article className="max-w-4xl mx-auto space-y-16 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Paper Header */}
            <div className="border-b-2 border-[#1F1F1F] pb-10 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#111] border border-[#222] rounded-full text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-8">
                    <Target className="w-3 h-3 text-blue-500" />
                    Analytical Synthesis Report
                </div>
                <h1 className="text-5xl text-white font-serif leading-tight mb-8">
                    {researchReport.query || "Untitled Research"}
                </h1>
                <div className="flex justify-center items-center gap-8 text-xs text-gray-400 uppercase tracking-widest font-bold">
                    <div className="flex items-center gap-2">
                        <span className="text-[#444]">Date:</span>
                        <span>{new Date().toLocaleDateString()}</span>
                    </div>
                    <span className="w-1.5 h-1.5 bg-[#333] rounded-full"></span>
                    <div className="flex items-center gap-2">
                        <span className="text-[#444]">System Confidence:</span>
                        <span className="text-blue-500">{researchReport.overallConfidenceScore}%</span>
                    </div>
                </div>
            </div>

            {evidenceProfile && Object.keys(evidenceProfile).length > 0 && (
                <section className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-sm p-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Evidence Profile</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                        <div className="bg-[#111] border border-[#1F1F1F] p-3 rounded-sm">
                            <div className="text-gray-500 mb-1">Total</div>
                            <div className="text-white font-bold">{evidenceProfile.totalSourcesUsed ?? '—'}</div>
                        </div>
                        <div className="bg-[#111] border border-[#1F1F1F] p-3 rounded-sm">
                            <div className="text-gray-500 mb-1">Empirical</div>
                            <div className="text-white font-bold">{evidenceProfile.empiricalSources ?? '—'}</div>
                        </div>
                        <div className="bg-[#111] border border-[#1F1F1F] p-3 rounded-sm">
                            <div className="text-gray-500 mb-1">Industry</div>
                            <div className="text-white font-bold">{evidenceProfile.industrySources ?? '—'}</div>
                        </div>
                        <div className="bg-[#111] border border-[#1F1F1F] p-3 rounded-sm">
                            <div className="text-gray-500 mb-1">Counter</div>
                            <div className="text-white font-bold">{evidenceProfile.counterEvidenceSources ?? '—'}</div>
                        </div>
                        <div className="bg-[#111] border border-[#1F1F1F] p-3 rounded-sm">
                            <div className="text-gray-500 mb-1">Mode</div>
                            <div className="text-white font-bold">{evidenceProfile.retrievalMode ?? 'Default'}</div>
                        </div>
                    </div>
                </section>
            )}

            {/* 1. Executive Summary (Analytical) */}
            <section className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-sm overflow-hidden">
                <div className="px-8 py-4 bg-[#151515] border-b border-[#1F1F1F] flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-tighter">I. Executive Summary</h3>
                </div>
                <div className="p-10 space-y-8">
                    <p className="text-gray-200 leading-relaxed font-serif text-xl italic">
                        {summary.analyticalOverview}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Primary Phenom Causal Driver</h4>
                            <p className="text-sm text-gray-400">{summary.primaryDriver || 'Not identified'}</p>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Crucial Contradictory Metric</h4>
                            <p className="text-sm text-gray-400">{summary.primaryContradiction || 'No significant contradiction isolated.'}</p>
                        </div>
                    </div>
                    {summary.strongestInsight && (
                        <div className="pt-6 border-t border-[#1F1F1F]">
                            <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-4">Core Synthesized Insight</h4>
                            <div className="flex items-start gap-3 bg-red-500/5 p-3 border border-red-500/10 rounded-sm">
                                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                <span className="text-sm text-gray-300">{summary.strongestInsight}</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* 2. Section Analyses */}
            <div className="space-y-20">
                {(researchReport.sections || []).map((section, idx) => (
                    <section key={idx} className="relative">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="text-4xl font-serif text-[#1F1F1F] font-black select-none leading-none">
                                0{idx + 2}
                            </div>
                            <div className="h-[2px] flex-1 bg-gradient-to-r from-[#1F1F1F] to-transparent"></div>
                            {section.evidenceStrength && (
                                <div className={`text-[10px] font-bold px-2 py-0.5 border rounded-sm uppercase tracking-widest 
                                    ${section.evidenceStrength === 'Strong' ? 'text-green-500 border-green-500/20 bg-green-500/5' :
                                        section.evidenceStrength === 'Moderate' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' :
                                            'text-gray-500 border-gray-500/20 bg-gray-500/5'}`}>
                                    {section.evidenceStrength} Evidence
                                </div>
                            )}
                        </div>

                        <h2 className="text-3xl text-white font-serif mb-8">{section.title}</h2>

                        <div className="text-gray-300 leading-loose font-serif text-[18px] space-y-8 mb-10">
                            {formatContent(section.content)}
                        </div>

                        {section.causalMechanism && (
                            <div className="bg-[#111] p-6 border border-[#1F1F1F] rounded-sm mb-6">
                                <h4 className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-4">
                                    <BarChart3 className="w-4 h-4" />
                                    Causal Mechanism
                                </h4>
                                <p className="text-sm text-gray-400 italic">
                                    {section.causalMechanism}
                                </p>
                            </div>
                        )}

                        {section.quantitativeSignals && section.quantitativeSignals.length > 0 && (
                            <div className="bg-[#111] p-6 border border-[#1F1F1F] rounded-sm">
                                <h4 className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4">
                                    <BarChart3 className="w-4 h-4" />
                                    Section Quantitative Evidence
                                </h4>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {section.quantitativeSignals.map((signal, sIdx) => (
                                        <li key={sIdx} className="text-sm text-gray-400 flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40 mt-1.5 shrink-0"></span>
                                            {signal}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                ))}
            </div>

            {/* 3. Cross-Source Analysis */}
            <section className="border-t-2 border-[#1F1F1F] pt-16">
                <div className="flex items-center gap-3 mb-10">
                    <Binary className="w-6 h-6 text-indigo-500" />
                    <h2 className="text-3xl text-white font-serif italic">Cross-Source Analysis</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="bg-[#0D0D0D] p-6 border border-[#1F1F1F] rounded-sm">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">Synthesized Insights</h4>
                        <ul className="space-y-4">
                            {(Array.isArray(crossAnalysis.synthesizedInsight) ? crossAnalysis.synthesizedInsight : []).map((item, i) => (
                                <li key={i} className="text-sm text-gray-300 flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5"></div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-[#0D0D0D] p-6 border border-[#1F1F1F] rounded-sm">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">Disputed Claims Resolution</h4>
                        <ul className="space-y-4">
                            {(Array.isArray(crossAnalysis.disagreementResolution) ? crossAnalysis.disagreementResolution : []).map((item, i) => (
                                <li key={i} className="text-sm text-gray-300 flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5"></div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-[#0D0D0D] p-6 border border-[#1F1F1F] rounded-sm">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">Research Lacunae (Gaps)</h4>
                        <ul className="space-y-4">
                            {(Array.isArray(crossAnalysis.researchGaps) ? crossAnalysis.researchGaps : []).map((item, i) => (
                                <li key={i} className="text-sm text-gray-300 flex items-start gap-3 italic">
                                    <div className="w-1.5 h-1.5 border border-indigo-500 mt-1.5"></div>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* 4. Quantitative Signals */}
            <section className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-sm">
                <div className="px-8 py-5 bg-[#151515] border-b border-[#1F1F1F] flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">II. Quantitative Signals & Projections</h3>
                </div>
                <div className="p-10">
                    {quantSummary.status === "State explicitly if no quantitative signals were found." &&
                        (!quantSummary.projections || quantSummary.projections.length === 0) ? (
                        <p className="text-gray-500 italic text-sm">No quantitative projections found in indexed sources.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Market & Technical Projections</h4>
                                <ul className="space-y-3">
                                    {(Array.isArray(quantSummary.projections) ? quantSummary.projections : []).map((p, i) => (
                                        <li key={i} className="text-sm text-gray-300 border-l border-emerald-500/20 pl-4">{p}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Performance & Adoption Benchmarks</h4>
                                <ul className="space-y-3">
                                    {(Array.isArray(quantSummary.performanceBenchmarks) ? quantSummary.performanceBenchmarks : [])
                                        .concat(Array.isArray(quantSummary.adoptionRates) ? quantSummary.adoptionRates : [])
                                        .map((b, i) => (
                                            <li key={i} className="text-sm text-gray-300 border-l border-blue-400/20 pl-4">{b}</li>
                                        ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* 5. Risk & Security Outlook */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-red-900/5 border border-red-900/10 p-10 rounded-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <ShieldAlert className="w-5 h-5 text-red-700" />
                        <h3 className="text-xs font-black text-red-900/60 uppercase tracking-widest">Risk Assessment</h3>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed font-serif">
                        {risks.limitations}
                    </p>
                </div>
                <div className="bg-blue-900/5 border border-blue-900/10 p-10 rounded-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <Zap className="w-5 h-5 text-blue-700" />
                        <h3 className="text-xs font-black text-blue-900/60 uppercase tracking-widest">Future Outlook</h3>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed font-serif">
                        {risks.futureOutlook}
                    </p>
                </div>
            </section>

            {/* 6. Confidence Explanation */}
            {researchReport.confidenceCalculation && (
                <div className="text-center pt-8 border-t border-[#1F1F1F]">
                    <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-black mb-2">Confidence Logic</p>
                    <p className="text-xs text-gray-500 max-w-xl mx-auto italic">
                        {researchReport.confidenceCalculation.explanation}
                    </p>
                </div>
            )}
        </article>
    );
};

const formatContent = (text) => {
    if (!text) return null;
    
    // Safety check to prevent .split() crash if text is not a string
    let processedText = text;
    if (typeof processedText !== 'string') {
        try {
            processedText = JSON.stringify(processedText);
        } catch {
            processedText = String(processedText);
        }
    }
    
    const paragraphs = processedText.split('\n\n');

    return paragraphs.map((para, pIdx) => {
        if (!para.trim()) return null;
        const parts = para.split(/(\[Source \d+\])/g);
        return (
            <p key={pIdx} className="mb-6 last:mb-0">
                {parts.map((part, i) => {
                    if (part.match(/\[Source \d+\]/)) {
                        const match = part.match(/\d+/);
                        const num = match ? match[0] : '?';
                        return (
                            <sup
                                key={i}
                                className="inline-flex items-center justify-center w-5 h-5 text-[9px] font-black bg-[#1A1A1A] border border-[#333] text-blue-400 rounded-sm ml-1 last:ml-0 hover:bg-blue-500 hover:text-white transition-all cursor-crosshair"
                                title="Academic Reference"
                            >
                                {num}
                            </sup>
                        );
                    }
                    return part;
                })}
            </p>
        );
    });
};

export default ResearchReport;

