// frontend/src/components/chat/TypingIndicator.jsx
import React, { useEffect, useMemo, useState } from 'react';

const PHASES = [
  { key: 'complexity', label: 'Understanding question depth…' },
  { key: 'planning', label: 'Designing reasoning strategy…' },
  { key: 'search', label: 'Gathering contextual signals…' },
  { key: 'modeling', label: 'Building causal model…' },
  { key: 'analysis', label: 'Testing scenario pathways…' },
  { key: 'synthesis', label: 'Constructing final explanation…' }
];

function resolvePhaseIndex(status = '') {
  const s = String(status || '').toLowerCase();
  if (!s) return 0;
  if (s.includes('complexity') || s.includes('understanding question')) return 0;
  if (s.includes('strategy') || s.includes('planning') || s.includes('decompos')) return 1;
  if (s.includes('gathering') || s.includes('retriev') || s.includes('search')) return 2;
  if (s.includes('model') || s.includes('causal') || s.includes('relationship')) return 3;
  if (s.includes('scenario') || s.includes('consistency') || s.includes('analyz')) return 4;
  if (s.includes('synth') || s.includes('formulating') || s.includes('final')) return 5;
  return 0;
}

function TypingIndicator({ status }) {
  const phaseIndex = useMemo(() => resolvePhaseIndex(status), [status]);
  const [rotationIndex, setRotationIndex] = useState(0);

  const rotatingFeed = [
    '🧠 Decomposing problem structure...',
    '🔎 Mapping causal relationships...',
    '📊 Evaluating competing scenarios...',
    '⚖️ Checking internal consistency...',
    '🧩 Integrating insights...',
    '✍️ Formulating explanation...'
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setRotationIndex(prev => (prev + 1) % rotatingFeed.length);
    }, 1900);
    return () => clearInterval(timer);
  }, []);

  const progressPct = ((phaseIndex + 1) / PHASES.length) * 100;

  return (
    <div className="flex items-center justify-start w-full group">
      <div className="w-full max-w-md rounded-xl border border-blue-500/30 bg-gradient-to-br from-slate-900/80 to-slate-800/70 px-3 py-2.5 shadow-md">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-blue-200 mb-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          <span>🧠 iMentor is reasoning</span>
        </div>

        <p className="text-xs text-slate-200 leading-snug min-h-[1.2rem]">
          {status || rotatingFeed[rotationIndex]}
        </p>

        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-700/70 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-400/90 transition-all duration-500 ease-out will-change-transform"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="mt-1 text-[10px] text-slate-400">
          {PHASES[phaseIndex]?.label || PHASES[0].label}
        </p>
      </div>
    </div>
  );
}

export default TypingIndicator;