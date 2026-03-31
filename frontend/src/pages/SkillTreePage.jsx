import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import api from '../services/api';
import { Zap, ArrowLeft } from 'lucide-react';

// Bloom's fallback shown when no skills are seeded in DB
const BLOOMS_NODES = [
    { id: 'root', type: 'input', data: { label: 'Novice Learner' }, position: { x: 250, y: 0 }, style: { background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '10px', width: 150 } },
    { id: 'remember',   data: { label: 'Remember' },  position: { x: 50,  y: 150 }, style: { background: '#cbd5e1', color: '#64748b' } },
    { id: 'understand', data: { label: 'Understand' }, position: { x: 250, y: 150 }, style: { background: '#cbd5e1', color: '#64748b' } },
    { id: 'apply',      data: { label: 'Apply' },      position: { x: 450, y: 150 }, style: { background: '#cbd5e1', color: '#64748b' } },
    { id: 'analyze',    data: { label: 'Analyze' },    position: { x: 100, y: 300 }, style: { background: '#cbd5e1', color: '#64748b' } },
    { id: 'evaluate',   data: { label: 'Evaluate' },   position: { x: 400, y: 300 }, style: { background: '#cbd5e1', color: '#64748b' } },
    { id: 'create',     data: { label: 'Create' },     position: { x: 250, y: 450 }, style: { background: '#cbd5e1', color: '#64748b' } },
];
const BLOOMS_EDGES = [
    { id: 'e1-2', source: 'root', target: 'remember',   animated: true },
    { id: 'e1-3', source: 'root', target: 'understand', animated: true },
    { id: 'e1-4', source: 'root', target: 'apply',      animated: true },
    { id: 'e2-5', source: 'remember',   target: 'analyze' },
    { id: 'e3-5', source: 'understand', target: 'analyze' },
    { id: 'e3-6', source: 'understand', target: 'evaluate' },
    { id: 'e4-6', source: 'apply',      target: 'evaluate' },
    { id: 'e5-7', source: 'analyze',    target: 'create' },
    { id: 'e6-7', source: 'evaluate',   target: 'create' },
];

function statusStyle(status) {
    if (status === 'mastered')  return { background: '#10b981', color: 'white', border: '2px solid #059669', boxShadow: '0 0 12px rgba(16,185,129,0.5)' };
    if (status === 'unlocked')  return { background: '#3b82f6', color: 'white', border: '2px solid #2563eb', boxShadow: '0 0 12px rgba(59,130,246,0.4)' };
    return { background: '#334155', color: '#94a3b8', border: '1px solid #475569' };
}

function buildFlowFromSkills(skills) {
    // Group by tier to auto-space positions
    const tiers = {};
    for (const s of skills) {
        const tier = s.position?.tier ?? 0;
        if (!tiers[tier]) tiers[tier] = [];
        tiers[tier].push(s);
    }

    const nodes = skills.map(skill => {
        const tier = skill.position?.tier ?? 0;
        const tierSkills = tiers[tier];
        const idx = tierSkills.indexOf(skill);
        const spacing = 180;
        const x = (idx - (tierSkills.length - 1) / 2) * spacing + 400;
        const y = tier * 160;
        return {
            id: skill.skillId,
            data: {
                label: `${skill.name}\n${skill.masteryPercentage ?? 0}%`,
            },
            position: { x, y },
            style: { ...statusStyle(skill.status), borderRadius: '8px', padding: '8px', width: 140, fontSize: '12px', whiteSpace: 'pre-line' },
        };
    });

    const edges = [];
    for (const skill of skills) {
        for (const prereqId of (skill.prerequisites || [])) {
            edges.push({
                id: `e-${prereqId}-${skill.skillId}`,
                source: prereqId,
                target: skill.skillId,
                animated: skill.status !== 'locked',
            });
        }
    }
    return { nodes, edges };
}

const SkillTreePage = () => {
    const navigate = useNavigate();
    const [nodes, setNodes, onNodesChange] = useNodesState(BLOOMS_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState(BLOOMS_EDGES);
    const [profile, setProfile] = useState(null);
    const [isFallback, setIsFallback] = useState(true);

    useEffect(() => {
        Promise.all([
            api.getUserSkillTree().catch(() => null),
            api.getGamificationProfile().catch(() => null),
        ]).then(([skillTreeData, profileData]) => {
            if (profileData) setProfile(profileData);
            const skills = skillTreeData?.skillTree;
            if (skills && skills.length > 0) {
                const { nodes: n, edges: e } = buildFlowFromSkills(skills);
                setNodes(n);
                setEdges(e);
                setIsFallback(false);
            }
        });
    }, []);

    return (
        <div className="h-screen w-full bg-slate-900 pt-20">
            <button
                onClick={() => navigate(-1)}
                className="absolute top-24 left-8 z-20 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
                <ArrowLeft size={20} />
                <span>Back</span>
            </button>

            <div className="absolute top-36 left-8 z-10 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-xl text-white min-w-[160px]">
                <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    <Zap className="text-yellow-400" /> Skill Tree
                </h1>
                {isFallback && (
                    <p className="text-slate-500 text-xs mb-3">Bloom's taxonomy (no skills seeded)</p>
                )}
                {profile && (
                    <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500">Your Stats</div>
                        <div className="flex justify-between text-sm">
                            <span>Level</span>
                            <span className="font-bold text-blue-400">{profile.level}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>XP</span>
                            <span className="font-bold text-yellow-500">{profile.totalXP ?? profile.learningCredits}</span>
                        </div>
                        {profile.skillTree && (
                            <div className="flex justify-between text-sm">
                                <span>Mastered</span>
                                <span className="font-bold text-emerald-400">{profile.skillTree.masteredCount}/{profile.skillTree.totalSkills}</span>
                            </div>
                        )}
                    </div>
                )}
                <div className="mt-3 space-y-1 text-xs">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"/> Mastered</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block"/> Unlocked</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-slate-600 inline-block"/> Locked</div>
                </div>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                className="bg-slate-900"
            >
                <Background color="#334155" gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    );
};

export default SkillTreePage;
