// frontend/src/components/admin/SystemPerformanceAlert.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, Cpu, Zap, Activity } from 'lucide-react';
import * as adminApi from '../../services/adminApi.js';

const SEVERITY_STYLE = {
  CRITICAL: 'bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-700 text-red-900 dark:text-red-100',
  HIGH:     'bg-orange-100 dark:bg-orange-900/40 border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-100',
  MEDIUM:   'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-400 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100',
};
const SEVERITY_DOT = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡' };

function Metric({ label, value, sub, accent }) {
  return (
    <div className={`rounded p-2 text-xs ${accent || 'bg-gray-100 dark:bg-gray-700'}`}>
      <div className="text-gray-500 dark:text-gray-400 mb-0.5">{label}</div>
      <div className="font-mono font-semibold text-gray-900 dark:text-gray-100">{value ?? '—'}</div>
      {sub && <div className="text-gray-400 dark:text-gray-500 text-[10px]">{sub}</div>}
    </div>
  );
}

export default function SystemPerformanceAlert() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [lastFetched, setLastFetched] = useState(null);
  const [error, setError]           = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const authHeaders = adminApi.getFixedAdminAuthHeaders();
      const r = await fetch('/api/admin/system-performance', { headers: authHeaders });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setData(d);
      setLastFetched(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15000); // live refresh every 15s
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading) return (
    <div className="card-base p-4 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
      <Activity size={16} className="animate-pulse" /> Loading system health…
    </div>
  );

  if (error || !data) return (
    <div className="card-base p-4 text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
      <AlertCircle size={16} /> Could not fetch system metrics ({error || 'no data'})
    </div>
  );

  const { gpu, llm, issues = [], healthStatus, performance } = data;
  const isHealthy = healthStatus === 'healthy';

  const borderColor = healthStatus === 'critical' ? 'border-red-500'
                    : healthStatus === 'warning'  ? 'border-orange-500'
                    : healthStatus === 'degraded' ? 'border-yellow-500'
                    : 'border-emerald-500';

  const headerBg   = healthStatus === 'critical' ? 'from-red-50 dark:from-red-900/20'
                   : healthStatus === 'warning'  ? 'from-orange-50 dark:from-orange-900/20'
                   : healthStatus === 'degraded' ? 'from-yellow-50 dark:from-yellow-900/20'
                   : 'from-emerald-50 dark:from-emerald-900/20';

  const tok    = llm?.throughput?.actualTokPerSec;
  const theor  = llm?.throughput?.theoreticalMaxTokPerSec;
  const eff    = llm?.throughput?.efficiencyPercent;
  const memPct = gpu?.memUsedPercent;

  return (
    <div className={`card-base border-l-4 ${borderColor} bg-gradient-to-r ${headerBg} to-transparent`}>

      {/* ── Header ── */}
      <div className="flex items-center gap-3 p-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        {isHealthy
          ? <CheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
          : <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />}
        <div className="flex-1">
          <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">
            {isHealthy ? '✅ System Healthy' : '⚠️ System Performance Issue Detected'}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            LLM: <span className="font-mono">{llm?.model || '—'}</span>
            {llm?.status && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold
                ${llm.status === 'ready'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700'}`}>
                {llm.status}
              </span>
            )}
          </p>
        </div>
        <div className="text-[10px] text-gray-400 text-right whitespace-nowrap">
          Live · refreshes 15s<br />
          {lastFetched && lastFetched.toLocaleTimeString()}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ── Issues list ── */}
        {issues.length > 0 && (
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <div key={i} className={`border rounded p-3 text-xs ${SEVERITY_STYLE[issue.severity] || SEVERITY_STYLE.MEDIUM}`}>
                <div className="font-semibold mb-1">{SEVERITY_DOT[issue.severity] || '🟡'} {issue.component}</div>
                <div className="mb-1">{issue.issue}</div>
                {issue.rootCause     && <div className="opacity-75 mb-1"><strong>Root cause:</strong> {issue.rootCause}</div>}
                {issue.recommendation && <div className="opacity-75"><strong>Fix:</strong> {issue.recommendation}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── Throughput ── */}
        <div>
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
            <Zap size={12} /> Token Generation
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Metric
              label="Actual tok/s"
              value={tok != null ? tok.toFixed(1) : '—'}
              accent={tok != null && theor && tok < theor * 0.3 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'}
            />
            <Metric label="Theoretical max" value={theor ? `${theor} tok/s` : '—'} sub="448 GB/s ÷ weight GB" />
            <Metric
              label="GPU efficiency"
              value={eff ? `${parseFloat(eff).toFixed(1)}%` : '—'}
              accent={eff && parseFloat(eff) < 20 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'}
            />
            <Metric
              label="800-tok response"
              value={tok ? `~${Math.round(800 / tok)}s` : '—'}
              sub="estimated stream time"
            />
          </div>
        </div>

        {/* ── GPU ── */}
        {gpu && (
          <div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
              <Cpu size={12} /> GPU — {gpu.name}
            </div>
            {/* VRAM progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                <span>VRAM: {gpu.memUsedGb} GB / {gpu.memTotalGb} GB ({memPct}%)</span>
                <span>GPU util: {gpu.gpuUtilPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700
                    ${memPct >= 95 ? 'bg-red-500' : memPct >= 80 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(memPct, 100)}%` }}
                />
              </div>
            </div>
            {/* VRAM breakdown from SGLang */}
            {llm?.vramBreakdown && (
              <div className="grid grid-cols-4 gap-2">
                <Metric label="Weights"       value={`${llm.vramBreakdown.weightGb} GB`} />
                <Metric label="KV Cache"      value={`${llm.vramBreakdown.kvcacheGb} GB`} />
                <Metric label="CUDA graphs"   value={`${llm.vramBreakdown.graphGb} GB`} />
                <Metric label="Token capacity" value={llm.tokenCapacity?.toLocaleString()} sub="max concurrent tokens" />
              </div>
            )}
          </div>
        )}

        {/* ── LLM Config ── */}
        {llm && (
          <div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
              <Activity size={12} /> LLM Config
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Metric label="Quantization"   value={llm.quantization} />
              <Metric label="Context length"  value={llm.contextLength ? `${llm.contextLength.toLocaleString()} tok` : '—'} />
              <Metric label="Max concurrent" value={llm.maxRunningRequests ? `${llm.maxRunningRequests} req` : '—'} />
              {performance?.recentChatsAnalyzed > 0 && (
                <Metric
                  label="Chats analyzed"
                  value={performance.recentChatsAnalyzed}
                  sub={performance.avgResponseLatencyMs
                    ? `avg ${(performance.avgResponseLatencyMs / 1000).toFixed(1)}s`
                    : 'no latency data'}
                />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
