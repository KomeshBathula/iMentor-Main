import React, { useMemo, useState } from 'react';

function getConfidenceColor(value) {
    if (value >= 75) return 'text-green-400';
    if (value >= 50) return 'text-yellow-400';
    return 'text-red-400';
}

function OrchestratorMonitor({ debugData, featureFlags, onToggleFeature }) {
    const [collapsed, setCollapsed] = useState(false);

    const routing = debugData?.routing || {};
    const performance = debugData?.performance || {};
    const reasoning = debugData?.reasoning || {};
    const redis = debugData?.redis || {};

    const branchCount = Number(reasoning.branchCount || 0);
    const branchesPruned = Number(reasoning.branchesPruned || 0);
    const activeBranches = Math.max(0, branchCount - branchesPruned);

    const finalConfidence = Number(reasoning.finalConfidence || 0);
    const confidenceWidth = Math.max(0, Math.min(100, finalConfidence));

    const branchBars = useMemo(() => {
        if (!branchCount) return [];
        return Array.from({ length: branchCount }, (_, index) => index < activeBranches);
    }, [branchCount, activeBranches]);

    const toggleItems = [
        { key: 'ENABLE_DYNAMIC_BRANCHING', label: 'Enable Dynamic Branching' },
        { key: 'ENABLE_STEP_CONFIDENCE', label: 'Enable Step Confidence' },
        { key: 'ENABLE_PATTERN_ANALYTICS', label: 'Enable Pattern Analytics' }
    ];

    return (
        <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[90vw] rounded-xl border border-gray-700 bg-gray-900/95 text-gray-100 shadow-xl">
            <button
                type="button"
                onClick={() => setCollapsed(prev => !prev)}
                className="w-full border-b border-gray-700 px-4 py-3 text-left text-sm font-semibold"
            >
                Orchestrator Monitor {collapsed ? '▸' : '▾'}
            </button>

            {!collapsed && (
                <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4 text-xs">
                    <section>
                        <h3 className="mb-1 font-semibold text-gray-300">🧠 Model Routing</h3>
                        <div>Provider: {routing.provider || '—'}</div>
                        <div>Model: {routing.modelId || '—'}</div>
                        <div>Strategy: {routing.strategy || '—'}</div>
                        <div>Complexity: {routing.complexityScore ?? 0}</div>
                    </section>

                    <section>
                        <h3 className="mb-1 font-semibold text-gray-300">🌳 Branching</h3>
                        <div>Branches: {branchCount}</div>
                        <div>Pruned: {branchesPruned}</div>
                        <div>Active: {activeBranches}</div>
                        <div className="mt-2 flex gap-1">
                            {branchBars.length > 0 ? branchBars.map((isActive, index) => (
                                <div
                                    key={`branch-${index}`}
                                    className={`h-3 flex-1 rounded ${isActive ? 'bg-green-500' : 'bg-red-500'}`}
                                />
                            )) : <div className="text-gray-400">No branch data</div>}
                        </div>
                    </section>

                    <section>
                        <h3 className="mb-1 font-semibold text-gray-300">📊 Confidence</h3>
                        <div>Steps: {(reasoning.stepConfidences || []).join(', ') || '—'}</div>
                        <div className={`font-semibold ${getConfidenceColor(finalConfidence)}`}>
                            Final: {finalConfidence}%
                        </div>
                        <div className="mt-1 h-2 w-full rounded bg-gray-700">
                            <div
                                className={`h-2 rounded ${finalConfidence >= 75 ? 'bg-green-500' : finalConfidence >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${confidenceWidth}%` }}
                            />
                        </div>
                    </section>

                    <section>
                        <h3 className="mb-1 font-semibold text-gray-300">⚡ Performance</h3>
                        <div>Routing: {performance.routingTime ?? 0}ms</div>
                        <div>LLM: {performance.llmTime ?? 0}ms</div>
                        <div>Tools: {performance.toolTime ?? 0}ms</div>
                        <div>Redis: {performance.redisTime ?? 0}ms</div>
                        <div>Total: {performance.totalTime ?? 0}ms</div>
                    </section>

                    <section>
                        <h3 className="mb-1 font-semibold text-gray-300">🔁 Redis</h3>
                        <div>State Loaded: {redis.loadedState ? 'YES' : 'NO'}</div>
                        <div>Insights: {redis.priorInsightsCount ?? 0}</div>
                        <div>Branches in history: {redis.branchHistoryCount ?? 0}</div>
                    </section>

                    <section>
                        <h3 className="mb-1 font-semibold text-gray-300">🧪 Feature Flags</h3>
                        <div className="space-y-2">
                            {toggleItems.map(item => {
                                const checked = !!featureFlags?.[item.key];
                                return (
                                    <label key={item.key} className="flex items-center justify-between gap-3">
                                        <span>{item.label}</span>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(event) => onToggleFeature(item.key, event.target.checked)}
                                        />
                                    </label>
                                );
                            })}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

export default OrchestratorMonitor;
