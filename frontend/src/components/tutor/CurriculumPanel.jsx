// frontend/src/components/tutor/CurriculumPanel.jsx
import React, { useState, useEffect } from 'react';
import Animate from '../core/Animate.jsx';
import {
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    Circle,
    FileText,
    Target,
    Loader2,
    Lock,
    Play,
    GraduationCap
} from 'lucide-react';
import api from '../../services/api';

function CurriculumPanel({
    selectedCourse,
    currentTopic = null,
    currentSubtopic = null,
    completedSubtopics = [],
    completedTopics = [],
    completedModules = [],
    onTopicSelect,
    onModuleSelect
}) {
    const [curriculum, setCurriculum] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expandedModules, setExpandedModules] = useState({});
    const [expandedTopics, setExpandedTopics] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!selectedCourse) {
            setCurriculum(null);
            return;
        }

        const fetchCurriculum = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.getTutorCurriculumStructure(selectedCourse);
                if (response?.success && response?.curriculum) {
                    setCurriculum(response.curriculum);
                    // Auto-expand first module
                    if (response.curriculum.modules?.length > 0) {
                        setExpandedModules({ [response.curriculum.modules[0].id]: true });
                    }
                }
            } catch (err) {
                console.error('[CurriculumPanel] Failed to fetch curriculum:', err);
                setError('Could not load curriculum structure');
            } finally {
                setLoading(false);
            }
        };

        fetchCurriculum();
    }, [selectedCourse]);

    const toggleModule = (moduleId) => {
        setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
    };

    const toggleTopic = (topicId) => {
        setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
    };

    const isSubtopicCompleted = (id) => completedSubtopics.includes(id);
    const isTopicCompleted = (id) => completedTopics.includes(id);
    const isModuleCompleted = (id) => completedModules.includes(id);

    const areAllSubtopicsCompleted = (subtopics) =>
        subtopics?.length > 0 && subtopics.every(s => isSubtopicCompleted(s.id));

    const areAllTopicsCompleted = (topics) =>
        topics?.length > 0 && topics.every(t => isTopicCompleted(t.id) || areAllSubtopicsCompleted(t.subtopics));

    const getModuleProgress = (module) => {
        if (!module.topics?.length) return 0;
        const done = module.topics.filter(t =>
            isTopicCompleted(t.id) || areAllSubtopicsCompleted(t.subtopics)
        ).length;
        return Math.round((done / module.topics.length) * 100);
    };

    const modules = curriculum?.modules || [];

    // Overall progress
    const totalTopics = modules.reduce((acc, m) => acc + (m.topics?.length || 0), 0);
    const doneTopics = modules.reduce((acc, m) => acc + (m.topics?.filter(t =>
        isTopicCompleted(t.id) || areAllSubtopicsCompleted(t.subtopics)
    ).length || 0), 0);
    const overallPct = totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : 0;

    return (
        <div className="h-full flex flex-col" style={{ background: 'rgba(10,12,18,0.97)' }}>

            {/* ── Header ── */}
            <div className="px-4 pt-4 pb-3 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <GraduationCap size={15} className="text-teal-400" />
                    <span className="text-sm font-semibold text-white">Curriculum Progress</span>
                </div>
                {selectedCourse && (
                    <p className="text-[11px] text-gray-500 ml-6 truncate">{selectedCourse}</p>
                )}
            </div>

            {/* ── Loading ── */}
            {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-500">
                    <Loader2 size={14} className="animate-spin text-teal-400" />
                    <span>Loading curriculum...</span>
                </div>
            )}

            {/* ── Error ── */}
            {error && !loading && (
                <div className="px-4 py-4">
                    <p className="text-xs text-red-400 text-center">{error}</p>
                </div>
            )}

            {/* ── No course selected ── */}
            {!selectedCourse && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-gray-800/60 flex items-center justify-center mb-3">
                        <GraduationCap size={22} className="text-gray-600" />
                    </div>
                    <p className="text-sm text-gray-500">General Socratic Tutor Active</p>
                    <p className="text-xs text-gray-600 mt-1">Explore any topic. I’ll guide you Socratically.</p>
                </div>
            )}

            {/* ── Module List ── */}
            {!loading && !error && curriculum && modules.length > 0 && (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-3 space-y-1">
                        {modules.map((module, moduleIndex) => {
                            const moduleCompleted = isModuleCompleted(module.id) || areAllTopicsCompleted(module.topics);
                            const isExpanded = !!expandedModules[module.id];
                            const isFirstIncomplete = !moduleCompleted && moduleIndex === modules.findIndex(m =>
                                !isModuleCompleted(m.id) && !areAllTopicsCompleted(m.topics)
                            );
                            const modPct = getModuleProgress(module);

                            return (
                                <div key={module.id}>
                                    {/* Module Row */}
                                    <div
                                        className={`
                                            w-full flex items-center gap-1 group rounded-lg transition-all duration-150
                                            ${isFirstIncomplete
                                                ? 'bg-gray-800/70 border border-white/8'
                                                : 'bg-transparent hover:bg-gray-800/20'
                                            }
                                        `}
                                    >
                                        {/* Toggle area (Arrow) */}
                                        <button
                                            onClick={() => toggleModule(module.id)}
                                            className="p-2.5 text-gray-500 hover:text-white transition-colors"
                                        >
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>

                                        {/* Select area (Status + Name) */}
                                        <div
                                            onClick={() => onModuleSelect?.(module)}
                                            className="flex-1 flex items-center gap-2.5 py-2.5 cursor-pointer pr-3"
                                        >
                                            <span className="flex-shrink-0">
                                                {moduleCompleted
                                                    ? <CheckCircle2 size={16} className="text-teal-400" />
                                                    : isFirstIncomplete
                                                        ? <div style={{ animation: 'pulse 2s ease-in-out infinite' }}><Circle size={16} className="text-gray-400" /></div>
                                                        : <Circle size={16} className="text-gray-600" />
                                                }
                                            </span>
                                            <span className={`flex-1 text-sm font-medium truncate ${moduleCompleted ? 'text-teal-400' : isFirstIncomplete ? 'text-white' : 'text-gray-400'}`}>
                                                {module.name}
                                            </span>
                                            {!moduleCompleted && modPct > 0 && (
                                                <span className="text-[10px] text-gray-500 flex-shrink-0">{modPct}%</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Topics */}
                                        {isExpanded && module.topics?.length > 0 && (
                                            <div
                                                className="overflow-hidden transition-all duration-200"
                                            >
                                                <div className="ml-6 mt-0.5 mb-1 space-y-0.5">
                                                    {module.topics.map((topic, topicIndex) => {
                                                        const topicCompleted = isTopicCompleted(topic.id) || areAllSubtopicsCompleted(topic.subtopics);
                                                        const isCurrentTopic = currentTopic === topic.id;
                                                        const isTopicExpanded = !!expandedTopics[topic.id];
                                                        const isNextTopic = !topicCompleted && topicIndex === module.topics.findIndex(t =>
                                                            !isTopicCompleted(t.id) && !areAllSubtopicsCompleted(t.subtopics)
                                                        );

                                                        return (
                                                            <div key={topic.id}>
                                                                {/* Topic Row */}
                                                                <div
                                                                    onClick={() => topic.subtopics?.length > 0 && toggleTopic(topic.id)}
                                                                    className={`
                                                                        flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-150
                                                                        ${topic.subtopics?.length > 0 ? 'cursor-pointer' : 'cursor-default'}
                                                                        ${isCurrentTopic ? 'bg-teal-500/10' : 'hover:bg-gray-800/30'}
                                                                    `}
                                                                >
                                                                    {/* Subtopic expand arrow */}
                                                                    {topic.subtopics?.length > 0 ? (
                                                                        <span className="text-gray-600 flex-shrink-0">
                                                                            {isTopicExpanded
                                                                                ? <ChevronDown size={11} />
                                                                                : <ChevronRight size={11} />
                                                                            }
                                                                        </span>
                                                                    ) : (
                                                                        <span className="w-[11px] flex-shrink-0" />
                                                                    )}

                                                                    {/* Topic status dot */}
                                                                    <span className="flex-shrink-0">
                                                                        {topicCompleted ? (
                                                                            <div className="w-3 h-3 rounded-full bg-teal-400/30 flex items-center justify-center">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                                                                            </div>
                                                                        ) : isCurrentTopic ? (
                                                                            <div
                                                                                style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
                                                                                className="w-3 h-3 rounded-full bg-teal-500/20 flex items-center justify-center"
                                                                            >
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="w-3 h-3 rounded-full border border-gray-600 flex items-center justify-center">
                                                                                <div className="w-1 h-1 rounded-full bg-gray-600" />
                                                                            </div>
                                                                        )}
                                                                    </span>

                                                                    {/* Topic name */}
                                                                    <span className={`
                                                                        text-xs truncate flex-1
                                                                        ${isCurrentTopic ? 'text-teal-300 font-medium'
                                                                            : topicCompleted ? 'text-gray-400'
                                                                                : isNextTopic ? 'text-gray-300'
                                                                                    : 'text-gray-500'
                                                                        }
                                                                    `}>
                                                                        {topic.name}
                                                                    </span>
                                                                </div>

                                                                {/* Subtopics */}
                                                                    {isTopicExpanded && topic.subtopics?.length > 0 && (
                                                                        <div
                                                                            className="ml-5 mt-0.5 space-y-0.5 overflow-hidden transition-all duration-150"
                                                                        >
                                                                            {topic.subtopics.map((subtopic) => {
                                                                                const subtopicCompleted = isSubtopicCompleted(subtopic.id);
                                                                                const isCurrentSub = currentSubtopic === subtopic.id || currentTopic === subtopic.id;

                                                                                return (
                                                                                    <div
                                                                                        key={subtopic.id}
                                                                                        className={`
                                                                                            flex items-center gap-2 px-2 py-1 rounded text-[11px]
                                                                                            ${isCurrentSub ? 'bg-teal-500/10 text-teal-300' : subtopicCompleted ? 'text-gray-500' : 'text-gray-600'}
                                                                                        `}
                                                                                    >
                                                                                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${subtopicCompleted ? 'bg-teal-400' : isCurrentSub ? 'bg-teal-400' : 'bg-gray-700'}`} />
                                                                                        <span className="truncate">{subtopic.name}</span>
                                                                                        {isCurrentSub && (
                                                                                            <span className="ml-auto text-[9px] text-teal-400 uppercase tracking-wider flex-shrink-0">Now</span>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── No curriculum found ── */}
            {selectedCourse && !loading && !error && (!curriculum || modules.length === 0) && (
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="text-center">
                        <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-gray-800/50 flex items-center justify-center">
                            <FileText size={18} className="text-gray-600" />
                        </div>
                        <p className="text-xs text-gray-500">No curriculum found for this course</p>
                    </div>
                </div>
            )}

            {/* ── Footer stats ── */}
            {!loading && curriculum && modules.length > 0 && (
                <div className="px-4 py-2.5 border-t border-white/5 flex-shrink-0 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">
                        Modules: <span className="text-gray-300">{completedModules.length}/{modules.length}</span>
                    </span>
                    <span className="text-[11px] text-gray-500">
                        Topics: <span className="text-teal-400 font-medium">{overallPct}%</span>
                    </span>
                </div>
            )}
        </div>
    );
}

export default CurriculumPanel;
