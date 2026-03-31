import React, { createContext, useState, useContext, useEffect } from 'react';

export const AppStateContext = createContext(null);

export const useAppState = () => {
    const context = useContext(AppStateContext);
    if (!context) throw new Error('useAppState must be used within an AppStateProvider');
    return context;
};

const defaultSystemPromptText = "You are a helpful AI engineering tutor.";

export const AppStateProvider = ({ children }) => {
    const theme = 'dark';
    if (typeof window !== 'undefined') {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
    }

    const [selectedLLM, setSelectedLLM] = useState(() => {
        const stored = localStorage.getItem('selectedLLM');
        // Migrate legacy 'ollama' → 'local_llm'
        if (stored === 'ollama' || stored === 'groq' || !stored) {
            localStorage.setItem('selectedLLM', 'local_llm');
            return 'local_llm';
        }
        return stored;
    });
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

    const [currentSessionId, setCurrentSessionIdState] = useState(() => {
        return localStorage.getItem('aiTutorSessionId') || null;
    });
    const [systemPrompt, setSystemPromptState] = useState(
        localStorage.getItem('aiTutorSystemPrompt') || defaultSystemPromptText
    );

    const [selectedDocumentForAnalysis, setSelectedDocumentForAnalysisState] = useState(null);
    const [selectedSubject, setSelectedSubjectState] = useState(
        localStorage.getItem('aiTutorSelectedSubject') || null
    );

    const [isAdminSessionActive, setIsAdminSessionActiveState] = useState(() => {
        return sessionStorage.getItem('isAdminSessionActive') === 'true';
    });

    const [initialPromptForNewSession, setInitialPromptForNewSession] = useState(null);
    const [initialActivityForNewSession, setInitialActivityForNewSession] = useState(null);

    const [lastGeneralSessionId, setLastGeneralSessionId] = useState(() => localStorage.getItem('lastGeneralSessionId') || null);
    const [lastTutorSessionId, setLastTutorSessionId] = useState(() => localStorage.getItem('lastTutorSessionId') || null);

    // Tutor Mode (Beta) feature flag - defaults to false
    const [tutorMode, setTutorMode] = useState(false);
    const [tutorModeType, setTutorModeType] = useState(null); // 'structured' | 'general_socratic' | 'assistant'

    const toggleTheme = () => {
        // Theme button is disabled, only dark mode is active
    };

    const switchLLM = (llm) => {
        setSelectedLLM(llm);
        localStorage.setItem('selectedLLM', llm);
    };

    const setSessionId = (sessionId) => {
        if (sessionId) {
            localStorage.setItem('aiTutorSessionId', sessionId);
        } else {
            localStorage.removeItem('aiTutorSessionId');

            localStorage.removeItem('aiTutorSelectedSubject');
            setSelectedSubjectState(null);

            setSelectedDocumentForAnalysisState(null);
        }
        setCurrentSessionIdState(sessionId);
    };

    const setSystemPrompt = (promptText) => {
        setSystemPromptState(promptText);
        localStorage.setItem('aiTutorSystemPrompt', promptText);
    };

    const selectDocumentForAnalysis = (documentFilename) => {
        setSelectedDocumentForAnalysisState(documentFilename);
        if (documentFilename && selectedSubject !== documentFilename) {
            if (selectedSubject !== null) {
                setSelectedSubjectState(null);
                localStorage.removeItem('aiTutorSelectedSubject');
            }
        }
    };

    const setSelectedSubject = (subjectName) => {
        const newSubject = subjectName === "none" || !subjectName ? null : subjectName;
        if (newSubject) {
            localStorage.setItem('aiTutorSelectedSubject', newSubject);
        } else {
            localStorage.removeItem('aiTutorSelectedSubject');
        }
        setSelectedSubjectState(newSubject);

        setSelectedDocumentForAnalysisState(newSubject);
        if (!newSubject && selectedDocumentForAnalysis === subjectName) {
            setSelectedDocumentForAnalysisState(null);
        }
    };

    const setIsAdminSessionActive = (isActive) => {
        if (isActive) {
            sessionStorage.setItem('isAdminSessionActive', 'true');
            setSessionId(null);
        } else {
            sessionStorage.removeItem('isAdminSessionActive');
        }
        setIsAdminSessionActiveState(isActive);
    };

    useEffect(() => {
        document.body.className = '';
        document.body.classList.add('bg-black');
    }, []);

    return (
        <AppStateContext.Provider value={{
            theme, toggleTheme,
            selectedLLM, switchLLM,
            isLeftPanelOpen, setIsLeftPanelOpen,
            isRightPanelOpen, setIsRightPanelOpen,
            currentSessionId, setSessionId,
            systemPrompt, setSystemPrompt,
            selectedDocumentForAnalysis, selectDocumentForAnalysis,
            selectedSubject, setSelectedSubject,
            isAdminSessionActive, setIsAdminSessionActive,
            initialPromptForNewSession, setInitialPromptForNewSession,
            initialActivityForNewSession, setInitialActivityForNewSession,
            tutorMode, setTutorMode,
            tutorModeType, setTutorModeType,
            lastGeneralSessionId, setLastGeneralSessionId,
            lastTutorSessionId, setLastTutorSessionId
        }}>
            {children}
        </AppStateContext.Provider>
    );

};