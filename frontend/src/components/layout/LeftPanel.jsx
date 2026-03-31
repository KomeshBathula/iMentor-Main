import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import SubjectList from '../documents/SubjectList.jsx';
import {
    PanelLeftClose, ChevronDown, ChevronUp, FilePlus, Settings2,
    Bot, BookOpen, Lightbulb, Library, History, GraduationCap, Zap
} from 'lucide-react';
import IconButton from '../core/IconButton.jsx';
import Animate from '../core/Animate.jsx';
import toast from 'react-hot-toast';
import api from '../../services/api.js';

const PROMPT_PRESETS = [
    { id: 'friendly_tutor', name: 'Friendly Tutor', icon: Bot, text: "You are a friendly, patient, and encouraging tutor specializing in engineering and scientific topics for PhD students. Explain concepts clearly, break down complex ideas, use analogies, and offer positive reinforcement. Ask follow-up questions to ensure understanding." },
    { id: 'concept_explorer', name: 'Concept Explorer', icon: BookOpen, text: "You are an expert academic lecturer introducing a new, complex engineering or scientific concept. Your goal is to provide a deep, structured explanation. Define terms rigorously, outline the theory, provide relevant mathematical formulations (using Markdown), illustrative examples, and discuss applications or limitations pertinent to PhD-level research." },
    { id: 'knowledge_check', name: 'Knowledge Check', icon: Lightbulb, text: "You are assessing understanding of engineering/scientific topics. Ask targeted questions to test knowledge, identify misconceptions, and provide feedback on the answers. Start by asking the user what topic they want to be quizzed on." },
    { id: 'custom', name: 'Custom Prompt', icon: Settings2, text: "You are a helpful iMentor engineering tutor." }
];

function LeftPanel({ isChatProcessing, onHistoryClick, onKnowledgeBaseClick }) {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        setIsLeftPanelOpen,
        systemPrompt, setSystemPrompt,
        selectedSubject, setSelectedSubject,
        tutorMode, setTutorMode
    } = useAppState();

    const [isPromptSectionOpen, setIsPromptSectionOpen] = useState(false);
    const [isSubjectSectionOpen, setIsSubjectSectionOpen] = useState(false);
    const [selectedPresetId, setSelectedPresetId] = useState('custom');
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
    const [subjectFetchError, setSubjectFetchError] = useState('');

    useEffect(() => {
        const matchedPreset = PROMPT_PRESETS.find(p => p.text === systemPrompt);
        setSelectedPresetId(matchedPreset ? matchedPreset.id : 'custom');
    }, [systemPrompt]);

    const fetchSubjects = useCallback(async () => {
        setIsLoadingSubjects(true);
        setSubjectFetchError('');
        try {
            const response = await api.getSubjects();
            const subjects = Array.isArray(response.subjects) ? response.subjects : [];
            setAvailableSubjects(subjects);
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || "Failed to load subjects.";
            toast.error(errorMsg);
            setSubjectFetchError(errorMsg);
        } finally {
            setIsLoadingSubjects(false);
        }
    }, []);

    useEffect(() => {
        fetchSubjects();
    }, [fetchSubjects]);

    const handlePresetChange = (event) => {
        const presetId = event.target.value;
        setSelectedPresetId(presetId);
        const selectedPreset = PROMPT_PRESETS.find(p => p.id === presetId);
        if (selectedPreset) setSystemPrompt(selectedPreset.text);
    };

    const togglePromptSection = () => {
        const nextState = !isPromptSectionOpen;
        setIsPromptSectionOpen(nextState);
        if (nextState) {
            setIsSubjectSectionOpen(false);
        }
    };

    const toggleSubjectSection = () => {
        const nextState = !isSubjectSectionOpen;
        setIsSubjectSectionOpen(nextState);
        if (nextState) {
            setIsPromptSectionOpen(false);
        }
    };

    const SelectedPresetIcon = PROMPT_PRESETS.find(p => p.id === selectedPresetId)?.icon || Settings2;

    return (
        <div className={`flex flex-col h-full ${isChatProcessing ? 'processing-overlay' : ''}`}>
            <div className="flex items-center justify-between mb-3 px-1 pt-1">
                <h2 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wider">Assistant Controls</h2>
                <IconButton
                    icon={PanelLeftClose}
                    onClick={() => setIsLeftPanelOpen(false)}
                    title="Close Assistant Panel"
                    variant="ghost" size="sm"
                    className="text-text-muted-light dark:text-text-muted-dark hover:text-black dark:hover:text-white"
                />
            </div>

            {/* Custom Prompt Section */}
            <div className="mb-4">
                <button onClick={togglePromptSection} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left text-text-light dark:text-text-dark bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl focus:outline-none shadow-sm border border-border-light dark:border-border-dark transition-all duration-200" aria-expanded={isPromptSectionOpen}>
                    <span className="flex items-center gap-2"><SelectedPresetIcon size={16} className="text-primary dark:text-primary-light" /> Custom Prompt</span>
                    {isPromptSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <Animate
                    show={isPromptSectionOpen}
                    unmount
                    animation="height-in"
                >
                    <div
                        className="mt-2 p-3 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-md shadow-inner overflow-hidden">
                            <label htmlFor="prompt-preset-select" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Prompt Mode:</label>
                            <select id="prompt-preset-select" value={selectedPresetId} onChange={handlePresetChange} className="input-field mb-2 text-xs py-1.5">
                                {PROMPT_PRESETS.map(preset => (<option key={preset.id} value={preset.id}>{preset.name}</option>))}
                            </select>
                            <label htmlFor="system-prompt-area" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">System Prompt (Editable):</label>
                            <textarea id="system-prompt-area" value={systemPrompt} onChange={(e) => { setSystemPrompt(e.target.value); setSelectedPresetId('custom'); }} rows="5" className="input-field text-xs custom-scrollbar" placeholder="Enter system prompt..." />
                    </div>
                </Animate>
            </div>

            {/* Admin Subjects Section */}
            <div className="mb-4">
                <button onClick={toggleSubjectSection} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left text-text-light dark:text-text-dark bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl focus:outline-none shadow-sm border border-border-light dark:border-border-dark transition-all duration-200" aria-expanded={isSubjectSectionOpen}>
                    <span className="flex items-center gap-2"><Library size={16} className="text-primary dark:text-primary-light" /> Admin Subjects</span>
                    {isSubjectSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <Animate
                    show={isSubjectSectionOpen}
                    unmount
                    animation="height-in"
                >
                    <div
                        className="mt-2 p-3 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-md shadow-inner overflow-hidden">
                            <SubjectList
                                subjects={availableSubjects}
                                selectedSubject={selectedSubject}
                                onSelectSubject={setSelectedSubject}
                                isLoading={isLoadingSubjects}
                                error={subjectFetchError}
                            />
                    </div>
                </Animate>
            </div>

            {/* Tutor Mode (Selectable Option) */}
            <div className="mb-4">
                <button
                    onClick={() => {
                        if (location.pathname === '/tutor') {
                            navigate('/');
                        } else {
                            navigate('/tutor');
                            toast.success("🎓 Tutor Mode activated!");
                        }
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-left transition-all duration-200 rounded-xl shadow-sm border ${tutorMode
                        ? 'bg-primary/10 border-primary text-primary dark:text-primary-light ring-1 ring-primary/20'
                        : 'bg-gray-50 dark:bg-gray-800 border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                >
                    <GraduationCap size={16} className={tutorMode ? 'text-primary' : 'text-primary dark:text-primary-light'} />
                    <span className="flex-1">Tutor Mode</span>
                    {tutorMode && (
                        <Animate
                            animation="scale-in"
                            className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_theme(colors.primary.DEFAULT)]"
                        />
                    )}
                </button>
            </div>

            {/* Deep Research Mode */}
            <div className="mb-4">
                <button
                    onClick={() => {
                        navigate('/tools/deep-research');
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-left transition-all duration-200 rounded-xl shadow-sm border bg-gray-50 dark:bg-gray-800 border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700`}
                >
                    <Zap size={16} className="text-blue-500" />
                    <span className="flex-1">Deep Research</span>
                </button>
            </div>

            {/* Chat History Section */}
            <div className="mb-4">
                <button
                    onClick={onHistoryClick}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-left text-text-light dark:text-text-dark bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl focus:outline-none shadow-sm transition-all duration-200"
                >
                    <History size={16} className="text-primary dark:text-primary-light" />
                    <span>Chat History</span>
                </button>
            </div>

            {/* User's Knowledge Base Section (floating modal trigger) */}
            <div className="mb-4">
                <button
                    onClick={onKnowledgeBaseClick}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-left text-text-light dark:text-text-dark bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl focus:outline-none shadow-sm transition-all duration-200"
                >
                    <FilePlus size={16} className="text-primary dark:text-primary-light" />
                    <span>My Knowledge Base</span>
                </button>
            </div>
        </div>
    );
}

export default LeftPanel;