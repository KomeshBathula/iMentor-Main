// frontend/src/components/landing/LandingPage.jsx
// Clean chat-style landing page for unauthenticated users.
// Shows a simple chat interface with send + mic buttons only.
// All advanced options are disabled until sign-in.
import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Mic, Server } from 'lucide-react';

// ─── Minimal top nav ──────────────────────────────────────
function LandingNav({ onLoginClick }) {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-4 sm:px-6 bg-black/90 backdrop-blur-md border-b border-white/10">
            {/* Brand */}
            <div className="flex items-center gap-2 text-white">
                <Server size={20} className="text-teal-400" />
                <span className="text-base font-bold tracking-tight">iMentor</span>
            </div>

            {/* Auth buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onLoginClick(true)}
                    className="px-4 py-1.5 text-sm font-semibold text-white border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                >
                    Sign In
                </button>
                <button
                    onClick={() => onLoginClick(false)}
                    className="px-4 py-1.5 text-sm font-semibold text-black bg-white rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Sign Up
                </button>
            </div>
        </nav>
    );
}

// ─── Single chat bubble ───────────────────────────────────
function ChatBubble({ role, text }) {
    const isUser = role === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
            <div
                className={`max-w-[75%] md:max-w-[60%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isUser
                        ? 'bg-white text-black rounded-br-md'
                        : 'bg-[#1a1a1a] border border-white/10 text-gray-200 rounded-bl-md'
                }`}
            >
                {text}
            </div>
        </div>
    );
}

// ─── Landing page component ───────────────────────────────
function LandingPage({ onLoginClick }) {
    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState([]);
    const [showAuthHint, setShowAuthHint] = useState(false);
    const textareaRef = useRef(null);
    const chatEndRef = useRef(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
        }
    }, [inputValue]);

    // Scroll to bottom when messages change
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;

        // Add user message to the chat
        const userMsg = { role: 'user', text: inputValue.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');

        // Show auth prompt after a brief delay
        setTimeout(() => {
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    text: 'Sign in to start chatting with iMentor \u2014 your personal AI learning assistant. It only takes a moment!'
                }
            ]);
            setShowAuthHint(true);
        }, 600);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleMicClick = () => {
        // Show an auth prompt so the user knows sign-in is required for voice
        setMessages(prev => [
            ...prev,
            { role: 'assistant', text: 'Sign in to use voice input with iMentor — your personal AI learning assistant.' }
        ]);
        setShowAuthHint(true);
    };

    return (
        <div className="flex flex-col h-screen bg-black text-white">
            <LandingNav onLoginClick={onLoginClick} />

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto pt-16 pb-4 px-4 sm:px-8 md:px-16 lg:px-32">
                {messages.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full gap-6 text-center select-none">
                        <div className="flex items-center gap-3">
                            <Server size={36} className="text-teal-400" />
                            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">iMentor</h1>
                        </div>
                        <p className="text-gray-400 text-base sm:text-lg max-w-md">
                            Your AI Mentor for limitless learning. Ask anything — sign in to unlock the full experience.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3 mt-4">
                            {['Explain neural networks', 'Help me study calculus', 'What is Big-O notation?'].map((q) => (
                                <button
                                    key={q}
                                    onClick={() => { setInputValue(q); textareaRef.current?.focus(); }}
                                    className="px-4 py-2 text-sm bg-[#111] border border-white/10 rounded-xl text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Message list */
                    <div className="flex flex-col gap-4 max-w-3xl mx-auto py-8">
                        {messages.map((msg, i) => (
                            <ChatBubble key={i} role={msg.role} text={msg.text} />
                        ))}

                        {/* Auth CTA after bot response */}
                        {showAuthHint && (
                            <div className="flex justify-center gap-3 mt-4">
                                <button
                                    onClick={() => onLoginClick(true)}
                                    className="px-5 py-2 text-sm font-semibold text-black bg-white rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Sign In to Continue
                                </button>
                                <button
                                    onClick={() => onLoginClick(false)}
                                    className="px-5 py-2 text-sm font-semibold text-white border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    Create Account
                                </button>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                )}
            </div>

            {/* Input bar */}
            <div className="flex-shrink-0 px-4 sm:px-8 md:px-16 lg:px-32 pb-4 pt-2">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-end gap-2 bg-[#111] border border-white/10 rounded-2xl px-4 py-2 focus-within:border-white/25 transition-colors">
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask iMentor anything about your studies..."
                            rows={1}
                            className="flex-1 bg-transparent text-white text-base leading-relaxed resize-none min-h-[28px] max-h-36 py-1.5 border-none outline-none placeholder:text-gray-500"
                        />

                        {/* Mic button */}
                        <button
                            onClick={handleMicClick}
                            className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                            title="Voice input — sign in required"
                            aria-label="Voice input"
                        >
                            <Mic size={18} />
                        </button>

                        {/* Send button */}
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                                inputValue.trim()
                                    ? 'bg-white text-black hover:bg-gray-200'
                                    : 'bg-white/10 text-gray-600 cursor-not-allowed'
                            }`}
                            title="Send message"
                            aria-label="Send message"
                        >
                            <ArrowUp size={18} />
                        </button>
                    </div>

                    <p className="text-center text-[11px] text-gray-600 mt-2">
                        Sign in to unlock Tutor Mode, Deep Research, Knowledge Base, and more.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default LandingPage;
