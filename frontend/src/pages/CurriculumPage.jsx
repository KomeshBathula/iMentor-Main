// frontend/src/pages/CurriculumPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    BookOpen, ChevronRight, ChevronDown, Rocket,
    CheckCircle2, Circle, Clock, ArrowLeft,
    Search, Filter, Map as MapIcon, Layers,
    GraduationCap, Info, Terminal, Target
} from 'lucide-react';
import Animate from '../components/core/Animate.jsx';
import api from '../services/api';
import toast from 'react-hot-toast';
import Button from '../components/core/Button';
import TopNav from '../components/layout/TopNav';
import { useAuth } from '../hooks/useAuth';
import { useAppState } from '../contexts/AppStateContext';

const CurriculumPage = () => {
    const { courseName } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { theme } = useAppState();

    const [curriculum, setCurriculum] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedModules, setExpandedModules] = useState({});
    const [expandedTopics, setExpandedTopics] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ modules: 0, topics: 0, subtopics: 0 });

    const fetchCurriculum = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.getCurriculum(courseName);
            setCurriculum(data);

            // Calculate stats
            let mCount = data.modules?.length || 0;
            let tCount = 0;
            let sCount = 0;

            data.modules?.forEach(m => {
                tCount += m.topics?.length || 0;
                m.topics?.forEach(t => {
                    sCount += t.subtopics?.length || 0;
                });
            });

            setStats({ modules: mCount, topics: tCount, subtopics: sCount });

            // Initialize first module as expanded
            if (data.modules && data.modules.length > 0) {
                setExpandedModules({ [data.modules[0].name]: true });
            }
        } catch (error) {
            console.error("Failed to fetch curriculum:", error);
            toast.error("Could not load curriculum data. It might be generating or missing.");
        } finally {
            setLoading(false);
        }
    }, [courseName]);

    useEffect(() => {
        fetchCurriculum();
    }, [fetchCurriculum]);

    const toggleModule = (moduleName) => {
        setExpandedModules(prev => ({ ...prev, [moduleName]: !prev[moduleName] }));
    };

    const toggleTopic = (topicName) => {
        setExpandedTopics(prev => ({ ...prev, [topicName]: !prev[topicName] }));
    };

    const handleJumpToChat = (topic) => {
        // Logic to navigate back to chat with a pre-set topic
        // We could use context to set an initial prompt
        navigate('/', { state: { initialTopic: topic } });
    };

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark">
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary"></div>
                        <p className="text-text-muted-light dark:text-text-muted-dark font-medium">Navigating your learning journey...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!curriculum) {
        return (
            <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark">
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-md p-8 bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl border border-border-light dark:border-border-dark">
                        <AlertTriangle size={48} className="mx-auto text-yellow-500 mb-4" />
                        <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-2">Curriculum Unavailable</h2>
                        <p className="text-text-muted-light dark:text-text-muted-dark mb-6">
                            We couldn't find a structured curriculum for "{courseName}". The graph may still be processing.
                        </p>
                        <Button variant="primary" onClick={() => navigate(-1)}>Go Back</Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark overflow-hidden font-sans pt-16">
            {/* Main Header */}
            <header className="flex-shrink-0 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark p-4 sm:p-6 z-10">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider mb-1">
                                <MapIcon size={16} /> Learning Journey Map
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-text-light dark:text-text-dark truncate max-w-xl">
                                {curriculum.course || courseName}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 px-4 py-2 rounded-xl border border-border-light dark:border-border-dark">
                            <div className="text-center">
                                <div className="text-xs text-text-muted-light dark:text-text-muted-dark font-bold uppercase">Modules</div>
                                <div className="text-lg font-black text-primary">{stats.modules}</div>
                            </div>
                            <div className="w-px h-8 bg-border-light dark:bg-border-dark"></div>
                            <div className="text-center">
                                <div className="text-xs text-text-muted-light dark:text-text-muted-dark font-bold uppercase">Topics</div>
                                <div className="text-lg font-black text-primary">{stats.topics}</div>
                            </div>
                            <div className="w-px h-8 bg-border-light dark:bg-border-dark"></div>
                            <div className="text-center">
                                <div className="text-xs text-text-muted-light dark:text-text-muted-dark font-bold uppercase">Explored</div>
                                <div className="text-lg font-black text-green-500">0%</div>
                            </div>
                        </div>
                        <Button variant="primary" className="shadow-lg shadow-primary/20" onClick={() => navigate('/')}>
                            <Rocket size={18} className="mr-2" /> Resume Learning
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-background-dark/30 p-4 sm:p-8">
                <div className="max-w-5xl mx-auto">

                    {/* Search & Filter Bar */}
                    <div className="mb-8 flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted-light dark:text-text-muted-dark" size={18} />
                            <input
                                type="text"
                                placeholder="Search concepts, modules, or subtopics..."
                                className="input-field pl-10 h-12 bg-surface-light dark:bg-surface-dark"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" className="bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark h-12">
                                <Filter size={18} className="mr-2" /> Filter
                            </Button>
                            <Button variant="ghost" className="bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark h-12" onClick={() => setExpandedModules({})}>
                                <Layers size={18} className="mr-2" /> Collapse All
                            </Button>
                        </div>
                    </div>

                    {/* Timeline/Hierarchy View */}
                    <div className="space-y-6">
                        {(curriculum.modules || []).map((module, mIdx) => {
                            const isModuleExpanded = expandedModules[module.name];
                            return (
                                <Animate
                                    key={module.name}
                                    animation="slide-up"
                                    delay={mIdx * 50}
                                    className="relative"
                                >
                                    {/* Module Card */}
                                    <div
                                        onClick={() => toggleModule(module.name)}
                                        className={`group relative z-10 p-5 rounded-2xl border cursor-pointer transition-all duration-300 shadow-sm
                                            ${isModuleExpanded
                                                ? 'bg-surface-light dark:bg-surface-dark border-primary dark:border-primary-light shadow-md'
                                                : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:border-primary/50 dark:hover:border-primary-light/50 hover:shadow-md'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors
                                                    ${isModuleExpanded ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-text-muted-light dark:text-text-muted-dark'}`}>
                                                    <span className="text-lg font-black">{mIdx + 1}</span>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-text-light dark:text-text-dark group-hover:text-primary transition-colors">
                                                        {module.name}
                                                    </h3>
                                                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                                        {module.topics?.length || 0} Topics • {module.status || 'Not Started'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="hidden xs:flex h-2 w-24 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary" style={{ width: '0%' }}></div>
                                                </div>
                                                {isModuleExpanded ? <ChevronDown size={24} className="text-primary" /> : <ChevronRight size={24} className="text-text-muted-light dark:text-text-muted-dark" />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Vertical Connector Line */}
                                    {mIdx < curriculum.modules.length - 1 && (
                                        <div className="absolute left-11 top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-800 -z-0"></div>
                                    )}

                                    {/* Topics Container */}
                                        {isModuleExpanded && (
                                            <div
                                                className="overflow-hidden ml-11 pl-6 pt-4 space-y-4 transition-all duration-300"
                                            >
                                                {(module.topics || []).map((topic, tIdx) => {
                                                    const isTopicExpanded = expandedTopics[topic.name];
                                                    return (
                                                        <div key={topic.name} className="relative">
                                                            {/* Topic Sub-card */}
                                                            <div
                                                                className={`p-4 rounded-xl border transition-all duration-200
                                                                    ${isTopicExpanded
                                                                        ? 'bg-surface-light dark:bg-surface-dark border-primary/30 dark:border-primary-light/30 shadow-sm'
                                                                        : 'bg-white/50 dark:bg-gray-800/30 border-transparent hover:border-primary/20 hover:bg-white dark:hover:bg-gray-800'}`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div
                                                                        className="flex items-center gap-3 cursor-pointer flex-grow"
                                                                        onClick={() => toggleTopic(topic.name)}
                                                                    >
                                                                        {topic.mastery > 80 ? (
                                                                            <CheckCircle2 size={18} className="text-green-500" />
                                                                        ) : (
                                                                            <Circle size={18} className="text-text-muted-light dark:text-text-muted-dark" />
                                                                        )}
                                                                        <span className="font-semibold text-text-light dark:text-text-dark">{topic.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => handleJumpToChat(topic.name)}
                                                                            className="p-1.5 hover:bg-primary/10 hover:text-primary rounded-md text-text-muted-light dark:text-text-muted-dark transition-colors"
                                                                            title="Learn Topic in Chat"
                                                                        >
                                                                            <Rocket size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => toggleTopic(topic.name)}
                                                                            className="p-1 text-text-muted-light dark:text-text-muted-dark"
                                                                        >
                                                                            {isTopicExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Subtopics */}
                                                                    {isTopicExpanded && (
                                                                        <div
                                                                            className="mt-3 pl-7 space-y-2 border-l border-primary/10 transition-all duration-300"
                                                                        >
                                                                            {(topic.subtopics || []).map(sub => (
                                                                                <div key={sub.name} className="flex items-center gap-2 py-1 group cursor-default">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-primary transition-colors"></div>
                                                                                    <span className="text-sm text-text-muted-light dark:text-text-muted-dark group-hover:text-text-light dark:group-hover:text-text-dark">
                                                                                        {sub.name}
                                                                                    </span>
                                                                                    <span className="text-[10px] uppercase font-bold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                        • Concept
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                            {(!topic.subtopics || topic.subtopics.length === 0) && (
                                                                                <p className="text-xs italic text-gray-400">Expand this topic to see core concepts.</p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                </Animate>
                            );
                        })}
                    </div>

                    {/* Empty State for Search */}
                    {curriculum.modules?.length === 0 && (
                        <div className="text-center py-20 bg-surface-light dark:bg-surface-dark rounded-3xl border border-dashed border-border-light dark:border-border-dark mt-8">
                            <GraduationCap size={64} className="mx-auto text-gray-200 dark:text-gray-800 mb-4" />
                            <h4 className="text-xl font-bold text-text-light dark:text-text-dark">Graph Construction in Progress</h4>
                            <p className="text-text-muted-light dark:text-text-muted-dark max-w-sm mx-auto">
                                We are still mapping out the cognitive structure of this course. Check back in a few minutes!
                            </p>
                        </div>
                    )}
                </div>
            </main>

            {/* Floating Footer / Status */}
            <footer className="flex-shrink-0 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark py-3 px-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-text-muted-light dark:text-text-muted-dark font-medium">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><Terminal size={12} className="text-primary" /> Course Verified</span>
                        <span className="flex items-center gap-1.5"><Info size={12} className="text-primary" /> Cognitive Map generated from source documents</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-green-500" /> System Active</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default CurriculumPage;
