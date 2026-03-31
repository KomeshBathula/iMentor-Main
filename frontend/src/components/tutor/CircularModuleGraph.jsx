import React, { useMemo, useState } from 'react';
import { Target, CheckCircle2, Brain } from 'lucide-react';

/**
 * CircularModuleGraph
 * Arranges course modules in a circular orbit around a central brain icon.
 * Clicking a module node triggers onModuleClick.
 */
const CircularModuleGraph = ({
    modules = [],
    completedModules = [],
    currentModuleId = null,
    onModuleClick = () => { },
}) => {
    const [hoveredModule, setHoveredModule] = useState(null);

    const svgSize = 260;
    const centerX = svgSize / 2;
    const centerY = svgSize / 2;
    const radius = 95;

    const positionedModules = useMemo(() => {
        if (!modules || modules.length === 0) return [];
        return modules.map((module, index) => {
            const angle = (index / modules.length) * 2 * Math.PI - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const isCompleted = completedModules.includes(module.id);
            const isCurrent = module.id === currentModuleId;
            return { ...module, x, y, isCompleted, isCurrent, index };
        });
    }, [modules, completedModules, currentModuleId]);

    if (!modules || modules.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="relative w-40 h-40 mb-4">
                    {/* Dashed orbit ring */}
                    <svg width="160" height="160" className="absolute inset-0">
                        <circle
                            cx="80" cy="80" r="65"
                            fill="none"
                            stroke="rgba(255,255,255,0.07)"
                            strokeWidth="1.5"
                            strokeDasharray="5 5"
                        />
                        {/* Placeholder nodes */}
                        {[0, 1, 2, 3, 4].map((i) => {
                            const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
                            const nx = 80 + 65 * Math.cos(angle);
                            const ny = 80 + 65 * Math.sin(angle);
                            return (
                                <rect
                                    key={i}
                                    x={nx - 12} y={ny - 12}
                                    width={24} height={24}
                                    rx={7}
                                    fill="rgba(55,65,81,0.5)"
                                    stroke="rgba(255,255,255,0.08)"
                                    strokeWidth={1}
                                />
                            );
                        })}
                    </svg>
                    {/* Center icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-gray-800/80 border border-white/10 flex items-center justify-center">
                            <Brain size={26} className="text-gray-500" />
                        </div>
                    </div>
                </div>
                <p className="text-sm font-medium text-gray-400">General Socratic Tutor Active</p>
                <p className="text-xs text-gray-600 mt-1 max-w-[160px] leading-relaxed">
                    Explore any topic. I’ll guide you Socratically.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center w-full py-2">
            <div className="relative" style={{ width: svgSize, height: svgSize }}>
                <svg width={svgSize} height={svgSize} className="overflow-visible">
                    {/* Orbit ring */}
                    <circle
                        cx={centerX} cy={centerY} r={radius}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="1.5"
                        strokeDasharray="5 5"
                    />

                    {/* Connection lines */}
                    {positionedModules.map((module, idx) => {
                        const next = positionedModules[(idx + 1) % positionedModules.length];
                        return (
                            <line
                                key={`line-${idx}`}
                                x1={module.x} y1={module.y}
                                x2={next.x} y2={next.y}
                                stroke={module.isCompleted ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.04)'}
                                strokeWidth={module.isCompleted ? 2 : 1}
                            />
                        );
                    })}

                    {/* Center Brain */}
                    <foreignObject x={centerX - 28} y={centerY - 28} width={56} height={56}>
                        <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-white/10 flex items-center justify-center shadow-xl overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/15 to-purple-500/15" />
                            <Brain size={24} className="text-teal-400 relative z-10" />
                        </div>
                    </foreignObject>

                    {/* Module Nodes */}
                    {positionedModules.map((module, idx) => (
                        <g key={module.id}>
                            <g
                                style={{
                                    transformOrigin: `${module.x}px ${module.y}px`,
                                    opacity: 1,
                                    transition: `opacity 0.35s ease ${idx * 0.07}s, transform 0.35s ease ${idx * 0.07}s`
                                }}
                                onClick={() => onModuleClick(module)}
                                onMouseEnter={() => setHoveredModule(module.id)}
                                onMouseLeave={() => setHoveredModule(null)}
                                className="cursor-pointer"
                            >
                                {/* Pulse ring for current module */}
                                {module.isCurrent && (
                                    <circle
                                        cx={module.x} cy={module.y} r={20}
                                        fill="rgba(20,184,166,0.12)"
                                        style={{ animation: 'pulse-ring 2s ease-in-out infinite' }}
                                    />
                                )}

                                {/* Node box */}
                                <rect
                                    x={module.x - 16} y={module.y - 16}
                                    width={32} height={32}
                                    rx={9}
                                    fill={
                                        module.isCurrent ? 'rgba(20,184,166,0.85)' :
                                            module.isCompleted ? 'rgba(34,197,94,0.18)' :
                                                hoveredModule === module.id ? 'rgba(255,255,255,0.08)' :
                                                    'rgba(31,41,55,0.9)'
                                    }
                                    stroke={
                                        module.isCurrent ? 'rgba(20,184,166,1)' :
                                            module.isCompleted ? 'rgba(34,197,94,0.45)' :
                                                'rgba(255,255,255,0.09)'
                                    }
                                    strokeWidth={module.isCurrent ? 2 : 1}
                                />

                                {/* Icon inside node */}
                                <foreignObject x={module.x - 9} y={module.y - 9} width={18} height={18}>
                                    <div className="w-[18px] h-[18px] flex items-center justify-center">
                                        {module.isCurrent ? (
                                            <Target size={12} className="text-white" />
                                        ) : module.isCompleted ? (
                                            <CheckCircle2 size={12} className="text-green-400" />
                                        ) : (
                                            <span className="text-[9px] font-bold text-gray-400">{idx + 1}</span>
                                        )}
                                    </div>
                                </foreignObject>

                                {/* Hover tooltip */}
                                {hoveredModule === module.id && (
                                        <g
                                            style={{ opacity: 1, transition: 'opacity 0.2s ease' }}
                                        >
                                            <rect
                                                x={module.x - 55} y={module.y + 20}
                                                width={110} height={26}
                                                rx={6}
                                                fill="rgba(17,24,39,0.95)"
                                                stroke="rgba(255,255,255,0.1)"
                                                strokeWidth={1}
                                            />
                                            <foreignObject x={module.x - 53} y={module.y + 22} width={106} height={22}>
                                                <div className="text-[10px] text-white font-medium text-center truncate px-1 leading-[22px]">
                                                    {module.name}
                                                </div>
                                            </foreignObject>
                                        </g>
                                    )}
                            </g>
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
};

export default CircularModuleGraph;
