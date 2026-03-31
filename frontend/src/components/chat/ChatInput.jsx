// frontend/src/components/chat/ChatInput.jsx
import { useAppState } from '../../contexts/AppStateContext.jsx';
import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api.js';
import { Send, Mic, Plus, Brain, Zap, Globe, BookMarked, Sparkles, Square, Database } from 'lucide-react';
import { useWebSpeech } from '../../hooks/useWebSpeech';
import { useDeepResearch } from '../../contexts/DeepResearchContext';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import toast from 'react-hot-toast';
import Animate from '../core/Animate.jsx';
import KnowledgeBaseDropdown from '../documents/KnowledgeBaseDropdown.jsx';

// Rotating placeholder texts for engagement
const PLACEHOLDER_TEXTS = [
    "Ask iMentor anything about your studies...",
    "What would you like to learn today?",
    "Type your question or paste code here...",
    "Explore any topic with AI guidance..."
];

function ChatInput({
    onSendMessage,
    onStop,
    isLoading,
    useWebSearch,
    setUseWebSearch,
    useAcademicSearch,
    setUseAcademicSearch,
    criticalThinkingEnabled,
    setCriticalThinkingEnabled,
    initialPrompt,
    setInitialPromptForNewSession,
    openCoachModalWithData,
    setCoachModalOpen
}) {
    const [inputValue, setInputValue] = useState('');
    const { transcript, listening, isSpeechSupported, startListening, stopListening, resetTranscript } = useWebSpeech();
    const textareaRef = useRef(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isKbOpen, setIsKbOpen] = useState(false);
    const menuRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);

    const { isResearchMode, setIsResearchMode } = useDeepResearch();
    const { selectDocumentForAnalysis, selectedDocumentForAnalysis } = useAppState();

    const [isCoaching, setIsCoaching] = useState(false);

    // ── Whisper STT state ─────────────────────────────────────────────────────
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    // Rotate placeholder text every 4 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDER_TEXTS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const handleRequestPromptCoaching = async () => {
        const trimmedInput = inputValue.trim();

        if (!trimmedInput) return;

        if (trimmedInput.length < 3) {
            toast("Prompt is too short for coaching. Please provide a bit more detail.", {
                icon: 'ℹ️',
                style: { background: '#000000', color: '#ffffff', border: '1px solid #ffffff' },
            });
            return;
        }

        if (isCoaching) return;

        setIsCoaching(true);

        const promise = api.analyzePrompt(trimmedInput);

        toast.promise(
            promise,
            {
                loading: 'Asking the coach for advice...',
                success: 'Suggestion received!',
                error: (err) => err.message || "The Prompt Coach is unavailable.",
            }
        );

        try {
            const response = await promise;
            openCoachModalWithData({
                original: trimmedInput,
                improved: response.improvedPrompt,
                explanation: response.explanation
            });
            setCoachModalOpen(true);
        } catch (error) {
            console.error("Error requesting prompt coaching:", error.message);
        } finally {
            setIsCoaching(false);
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();

        const pastedText = e.clipboardData.getData('text/plain');
        const trimmedText = pastedText.trim();

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const newValue = inputValue.substring(0, start) + trimmedText + inputValue.substring(end);
        setInputValue(newValue);

        setTimeout(() => {
            const newCursorPosition = start + trimmedText.length;
            textarea.selectionStart = newCursorPosition;
            textarea.selectionEnd = newCursorPosition;
        }, 0);
    };

    useEffect(() => {
        if (initialPrompt) {
            console.log("[ChatInput] Received initial prompt via props:", initialPrompt);
            setInputValue(initialPrompt);
            setInitialPromptForNewSession(null);
        }
    }, [initialPrompt, setInitialPromptForNewSession]);

    useEffect(() => {
        if (transcript) {
            setInputValue(prev => prev + (prev ? " " : "") + transcript);
            resetTranscript();
        }
    }, [transcript, resetTranscript]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
    }, [inputValue]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            onSendMessage(inputValue.trim(), {});
            setInputValue('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    // ── Whisper STT handlers ──────────────────────────────────────────────────
    const startRecording = async () => {
        // Fallback to browser Web Speech if MediaRecorder unavailable
        if (!navigator.mediaDevices?.getUserMedia) {
            if (isSpeechSupported) startListening();
            else toast.error('Microphone not supported in this browser.');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
            const recorder = new MediaRecorder(stream, { mimeType });
            recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                setIsTranscribing(true);
                try {
                    const ext = mimeType === 'audio/webm' ? 'webm' : 'ogg';
                    const { text } = await api.transcribeAudio(blob, `recording.${ext}`);
                    if (text?.trim()) {
                        setInputValue(prev => prev + (prev ? ' ' : '') + text.trim());
                        toast.success('Voice transcribed');
                    } else {
                        toast.error('No speech detected — try again.');
                    }
                } catch {
                    toast.error('Transcription failed. Check microphone and try again.');
                } finally {
                    setIsTranscribing(false);
                }
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch {
            toast.error('Microphone access denied.');
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };

    const handleVoiceClick = () => {
        if (isRecording) stopRecording();
        else startRecording();
    };

    const handleWebSearchToggle = () => {
        const newWebSearchState = !useWebSearch;
        setUseWebSearch(newWebSearchState);
        if (newWebSearchState) setUseAcademicSearch(false);
        toast(newWebSearchState ? "Web Search enabled." : "Web Search disabled.", { icon: newWebSearchState ? "🌐" : "📄" });
        setIsMenuOpen(false);
    };

    const handleAcademicSearchToggle = () => {
        const newState = !useAcademicSearch;
        setUseAcademicSearch(newState);
        if (newState) setUseWebSearch(false);
        toast(newState ? "Academic Search enabled." : "Academic Search disabled.", { icon: newState ? "🎓" : "📄" });
        setIsMenuOpen(false);
    };

    const handleDeepResearchToggle = () => {
        setIsResearchMode(!isResearchMode);
        setIsMenuOpen(false);
    }

    const currentPlaceholder = isResearchMode 
        ? "Ask a research question..." 
        : isLoading
        ? "iMentor is thinking..."
        : PLACEHOLDER_TEXTS[placeholderIndex];

    return (
        <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
            {/* Wrapper for dropdown + input */}
            <div className="relative">
            {/* Knowledge Base Dropdown (renders above input bar) */}
            <KnowledgeBaseDropdown
                isOpen={isKbOpen}
                onClose={() => setIsKbOpen(false)}
                onSelectSource={(title) => { selectDocumentForAnalysis(title); }}
                selectedSource={selectedDocumentForAnalysis}
            />

            {/* VS Code terminal-style input container */}
            <Animate
                data-tutor-tour="chat-input"
                className="relative flex items-end gap-2"
                style={{
                    background:   'var(--vs-panel)',
                    border:       isFocused
                        ? '1px solid var(--vs-border-hi)'
                        : '1px solid var(--vs-border)',
                    borderRadius: '4px',
                    transition:   'border-color 0.15s',
                    padding:      '6px 8px',
                }}
                animation="fade-in"
            >
                {/* Plus Menu Button */}
                <div className="relative flex-shrink-0" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        disabled={isLoading}
                        title="More options"
                        aria-label="More options"
                        style={{
                            padding:      '5px',
                            borderRadius: '3px',
                            background:   isMenuOpen ? 'var(--vs-active)' : 'transparent',
                            border:       '1px solid transparent',
                            color:        isMenuOpen ? 'var(--vs-text)' : 'var(--vs-text-dim)',
                            cursor:       'pointer',
                            transition:   'color 0.15s, background 0.15s',
                            flexShrink:   0,
                            opacity:      isLoading ? 0.4 : 1,
                        }}
                        onMouseEnter={e => { if (!isMenuOpen) e.currentTarget.style.color = 'var(--vs-text-lo)'; }}
                        onMouseLeave={e => { if (!isMenuOpen) e.currentTarget.style.color = 'var(--vs-text-dim)'; }}
                    >
                        <Plus
                            size={16}
                            style={{ transition: 'transform 0.2s', transform: isMenuOpen ? 'rotate(45deg)' : 'none' }}
                        />
                    </button>

                    {isMenuOpen && (
                            <Animate
                                animation="scale-in"
                                className="absolute bottom-full left-0 mb-2 z-20"
                                style={{
                                    width:        '220px',
                                    background:   'var(--vs-panel)',
                                    border:       '1px solid var(--vs-border-hi)',
                                    borderRadius: '4px',
                                    boxShadow:    '0 8px 24px rgba(0,0,0,0.5)',
                                    padding:      '4px',
                                }}
                            >
                                {[
                                    { onClick: handleWebSearchToggle,      Icon: Globe,     active: useWebSearch,      label: useWebSearch      ? 'Web Search ON'      : 'Enable Web Search'     },
                                    { onClick: handleAcademicSearchToggle, Icon: BookMarked, active: useAcademicSearch, label: useAcademicSearch ? 'Academic Search ON'  : 'Enable Academic Search' },
                                ].map(({ onClick, Icon, active, label }) => (
                                    <button
                                        key={label}
                                        onClick={onClick}
                                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs"
                                        style={{
                                            borderRadius: '3px',
                                            background:   active ? 'var(--vs-active)' : 'transparent',
                                            color:        active ? 'var(--vs-text)'   : 'var(--vs-text-lo)',
                                            border:       'none',
                                            cursor:       'pointer',
                                            fontWeight:   active ? 500 : 400,
                                            transition:   'background 0.1s, color 0.1s',
                                        }}
                                        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--vs-hover)'; e.currentTarget.style.color = 'var(--vs-text)'; }}}
                                        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent';     e.currentTarget.style.color = 'var(--vs-text-lo)'; }}}
                                    >
                                        <Icon size={13} />
                                        {label}
                                    </button>
                                ))}

                                {/* Mobile-only options */}
                                <div
                                    className="sm:hidden mt-1 pt-1"
                                    style={{ borderTop: '1px solid var(--vs-border)' }}
                                >
                                    <button
                                        onClick={() => { handleVoiceClick(); setIsMenuOpen(false); }}
                                        disabled={isTranscribing}
                                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs"
                                        style={{ borderRadius:'3px', color: isRecording ? '#f87171' : 'var(--vs-text-lo)', background: isRecording ? 'var(--vs-active)' : 'transparent', border:'none', cursor: isTranscribing ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isTranscribing
                                            ? <div className="w-3 h-3 border border-[color:var(--vs-accent)] border-t-transparent rounded-full animate-spin" />
                                            : <Mic size={13} className={isRecording ? 'animate-pulse' : ''} />
                                        }
                                        {isRecording ? 'Stop Recording' : isTranscribing ? 'Transcribing…' : 'Voice Input'}
                                    </button>
                                    {[
                                        { onClick: () => { handleRequestPromptCoaching(); setIsMenuOpen(false); }, Icon: Sparkles, label: 'Prompt Coach', active: false },
                                        { onClick: () => { setCriticalThinkingEnabled(!criticalThinkingEnabled); setIsMenuOpen(false); }, Icon: Brain, label: `Tree of Thought ${criticalThinkingEnabled ? 'ON' : 'OFF'}`, active: criticalThinkingEnabled },
                                        { onClick: () => { setIsKbOpen(prev => !prev); setIsMenuOpen(false); }, Icon: Database, label: selectedDocumentForAnalysis ? `RAG: ${selectedDocumentForAnalysis}` : 'RAG / Knowledge Base', active: !!(isKbOpen || selectedDocumentForAnalysis) },
                                    ].map(({ onClick, Icon, label, active }) => (
                                        <button
                                            key={label}
                                            onClick={onClick}
                                            className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-xs"
                                            style={{
                                                borderRadius: '3px',
                                                background:   active ? 'var(--vs-active)' : 'transparent',
                                                color:        active ? 'var(--vs-text)'   : 'var(--vs-text-lo)',
                                                border:       'none',
                                                cursor:       'pointer',
                                                fontWeight:   active ? 500 : 400,
                                                transition:   'background 0.1s, color 0.1s',
                                            }}
                                        >
                                            <Icon size={13} />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </Animate>
                    )}
                </div>

                {/* Premium Textarea */}
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={currentPlaceholder}
                        className={`
                            w-full
                            bg-transparent
                            text-white text-base leading-relaxed
                            placeholder:text-gray-500 placeholder:transition-opacity
                            resize-none
                            min-h-[28px] max-h-40
                            py-2 px-1
                            border-none outline-none
                            custom-scrollbar
                            transition-all duration-200
                            ${isLoading ? 'opacity-60' : ''}
                        `}
                        style={{
                            caretColor:  'var(--vs-text)',
                            color:       'var(--vs-text)',
                            fontSize:    '0.875rem',
                            lineHeight:  '1.6',
                            opacity:     isLoading ? 0.5 : 1,
                        }}
                        rows="1"
                        disabled={isLoading}
                        aria-label="Message input"
                    />
                </div>

                {/* Right-side Action Buttons */}
                <div className="flex items-center gap-0.5 flex-shrink-0">

                    {/* Helper: uniform icon button */}
                    {/* (inline — keeps this component self-contained) */}

                    {/* Voice - Desktop (Whisper backend STT) */}
                    <button
                        onClick={handleVoiceClick}
                        disabled={isLoading || isTranscribing}
                        className="hidden sm:flex items-center justify-center"
                        title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing…' : 'Voice input (Whisper)'}
                        aria-label={isRecording ? 'Stop recording' : 'Voice input'}
                        style={{
                            padding: '5px', borderRadius: '3px',
                            background: isRecording ? 'var(--vs-active)' : 'transparent',
                            border: isRecording ? '1px solid var(--vs-accent)' : '1px solid transparent',
                            color: isRecording ? '#f87171' : isTranscribing ? 'var(--vs-accent)' : 'var(--vs-text-dim)',
                            cursor: (isLoading || isTranscribing) ? 'not-allowed' : 'pointer',
                            opacity: (isLoading) ? 0.4 : 1,
                            transition: 'color 0.15s, background 0.15s',
                        }}
                    >
                        {isTranscribing
                            ? <div className="w-3.5 h-3.5 border border-[color:var(--vs-accent)] border-t-transparent rounded-full animate-spin" />
                            : <Mic size={15} className={isRecording ? 'animate-pulse' : ''} />
                        }
                    </button>

                    {/* Prompt Coach - Desktop */}
                    <button
                        onClick={handleRequestPromptCoaching}
                        disabled={isLoading || isCoaching || !inputValue.trim()}
                        className="hidden sm:flex items-center justify-center"
                        title="Prompt Coach"
                        aria-label="Prompt Coach"
                        style={{
                            padding: '5px', borderRadius: '3px',
                            background: 'transparent', border: '1px solid transparent',
                            color: inputValue.trim() ? 'var(--vs-text-dim)' : 'var(--vs-text-dim)',
                            cursor: (!inputValue.trim() || isLoading || isCoaching) ? 'not-allowed' : 'pointer',
                            opacity: (!inputValue.trim() || isLoading || isCoaching) ? 0.35 : 1,
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => { if (inputValue.trim() && !isLoading) e.currentTarget.style.color = 'var(--vs-text-lo)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--vs-text-dim)'; }}
                    >
                        {isCoaching
                            ? <div className="w-3.5 h-3.5 border border-[color:var(--vs-text-dim)] border-t-transparent rounded-full animate-spin" />
                            : <Sparkles size={15} />
                        }
                    </button>

                    {/* Divider */}
                    <div style={{ width:'1px', height:'16px', background:'var(--vs-border)', margin:'0 3px' }} />

                    {/* ToT - Desktop */}
                    <button
                        onClick={() => setCriticalThinkingEnabled(!criticalThinkingEnabled)}
                        disabled={isLoading}
                        className="hidden sm:flex items-center gap-1"
                        title={criticalThinkingEnabled ? 'Tree of Thought ON' : 'Enable Tree of Thought'}
                        aria-label="Toggle Tree of Thought"
                        aria-pressed={criticalThinkingEnabled}
                        style={{
                            padding: '4px 6px', borderRadius: '3px',
                            background: criticalThinkingEnabled ? 'var(--vs-active)' : 'transparent',
                            border: criticalThinkingEnabled ? '1px solid var(--vs-border-hi)' : '1px solid transparent',
                            color: criticalThinkingEnabled ? 'var(--vs-text)' : 'var(--vs-text-dim)',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.4 : 1,
                            fontSize: '0.6875rem', fontWeight: criticalThinkingEnabled ? 600 : 400,
                            transition: 'color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => { if (!criticalThinkingEnabled && !isLoading) e.currentTarget.style.color = 'var(--vs-text-lo)'; }}
                        onMouseLeave={e => { if (!criticalThinkingEnabled) e.currentTarget.style.color = 'var(--vs-text-dim)'; }}
                    >
                        <Brain size={13} />
                        <span>ToT</span>
                    </button>

                    {/* RAG / Knowledge Base - Desktop */}
                    <button
                        onClick={() => setIsKbOpen(prev => !prev)}
                        disabled={isLoading}
                        className="hidden sm:flex items-center gap-1"
                        title={selectedDocumentForAnalysis ? `RAG active: ${selectedDocumentForAnalysis}` : 'Enable RAG / Knowledge Base'}
                        aria-label="Toggle RAG / Knowledge Base"
                        aria-pressed={!!(isKbOpen || selectedDocumentForAnalysis)}
                        style={{
                            padding: '4px 6px', borderRadius: '3px',
                            background: (isKbOpen || selectedDocumentForAnalysis) ? 'var(--vs-active)' : 'transparent',
                            border: (isKbOpen || selectedDocumentForAnalysis) ? '1px solid var(--vs-border-hi)' : '1px solid transparent',
                            color: (isKbOpen || selectedDocumentForAnalysis) ? 'var(--vs-text)' : 'var(--vs-text-dim)',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.4 : 1,
                            fontSize: '0.6875rem', fontWeight: (isKbOpen || selectedDocumentForAnalysis) ? 600 : 400,
                            transition: 'color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => { if (!(isKbOpen || selectedDocumentForAnalysis) && !isLoading) e.currentTarget.style.color = 'var(--vs-text-lo)'; }}
                        onMouseLeave={e => { if (!(isKbOpen || selectedDocumentForAnalysis)) e.currentTarget.style.color = 'var(--vs-text-dim)'; }}
                    >
                        <Database size={13} />
                        <span>RAG</span>
                    </button>

                    {/* Divider */}
                    <div style={{ width:'1px', height:'16px', background:'var(--vs-border)', margin:'0 3px' }} />

                    {/* Send / Stop */}
                    {isLoading ? (
                        <button
                            key="stop-button"
                            type="button"
                            onClick={onStop}
                            className="flex items-center justify-center"
                            title="Stop generating"
                            style={{
                                padding: '6px', borderRadius: '3px',
                                background: 'var(--vs-surface)',
                                border: '1px solid var(--vs-border-hi)',
                                color: 'var(--vs-text-lo)',
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ width:'10px', height:'10px', background:'var(--vs-text-lo)', borderRadius:'1px' }} />
                        </button>
                    ) : (
                        <button
                            key="send-button"
                            type="submit"
                            onClick={handleSubmit}
                            disabled={!inputValue.trim()}
                            title="Send message (Enter)"
                            style={{
                                padding: '6px', borderRadius: '3px',
                                background: inputValue.trim() ? 'var(--vs-text)' : 'var(--vs-surface)',
                                border: '1px solid transparent',
                                color: inputValue.trim() ? 'var(--vs-text-inv)' : 'var(--vs-text-dim)',
                                cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                                transition: 'background 0.15s, color 0.15s',
                            }}
                        >
                            <Send size={15} />
                        </button>
                    )}
                </div>
            </Animate >
            </div>{/* end relative wrapper */}

            {/* Status Indicators — flat VS Code statusbar style */}
            {(useWebSearch || useAcademicSearch || criticalThinkingEnabled || selectedDocumentForAnalysis) && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1.5 px-1">
                    {[
                        useWebSearch        && { key: 'ws',  Icon: Globe,      label: 'Web Search'        },
                        useAcademicSearch   && { key: 'as',  Icon: BookMarked, label: 'Academic Search'   },
                        criticalThinkingEnabled && { key: 'tot', Icon: Brain,  label: 'Tree of Thought'   },
                    ].filter(Boolean).map(({ key, Icon, label }) => (
                        <Animate key={key} animation="slide-up-sm">
                            <span
                                className="inline-flex items-center gap-1 text-2xs"
                                style={{
                                    padding:      '2px 6px',
                                    borderRadius: '2px',
                                    background:   'var(--vs-surface)',
                                    border:       '1px solid var(--vs-border)',
                                    color:        'var(--vs-text-lo)',
                                }}
                            >
                                <Icon size={10} />
                                {label}
                            </span>
                        </Animate>
                    ))}
                    {selectedDocumentForAnalysis && (
                        <Animate key="rag" animation="slide-up-sm">
                            <button
                                onClick={() => selectDocumentForAnalysis(null)}
                                title="RAG active — click to deselect"
                                className="inline-flex items-center gap-1 text-2xs cursor-pointer"
                                style={{
                                    padding:      '2px 6px',
                                    borderRadius: '2px',
                                    background:   'var(--vs-surface)',
                                    border:       '1px solid var(--vs-border-hi)',
                                    color:        'var(--vs-text)',
                                }}
                            >
                                <Database size={10} />
                                <span style={{ fontWeight: 600, marginRight: '2px' }}>RAG:</span>
                                <span className="max-w-[100px] truncate">{selectedDocumentForAnalysis}</span>
                                <span style={{ color: 'var(--vs-text-dim)', marginLeft: '1px' }}>×</span>
                            </button>
                        </Animate>
                    )}
                </div>
            )}
        </div >
    );
}

export default ChatInput;
