import React, { useState, useRef, useCallback } from 'react';
import { useTutorStatus } from '../hooks/useTutorStatus';
import TutorStatus from '../components/chat/TutorStatus';
import TutorSessionPanel from '../components/chat/TutorSessionPanel';
import ChatHistory from '../components/chat/ChatHistory';
import api from '../services/api';
import { Send, Square } from 'lucide-react';

export default function TutorPage() {
  const tutorStatus = useTutorStatus();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tutorSession, setTutorSession] = useState(null);
  const abortRef = useRef(null);
  const sessionIdRef = useRef(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user', parts: [{ text }] };
    const placeholderId = `a-${Date.now()}`;
    const placeholder = { id: placeholderId, role: 'model', parts: [{ text: '' }], isLoading: true };

    setMessages(prev => [...prev, userMsg, placeholder]);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await api.sendMessage(
        {
          query: text,
          history: messages.filter(m => !m.isLoading),
          sessionId: sessionIdRef.current,
          tutorMode: true,
          tutorModeType: 'structured',
        },
        controller.signal
      );

      if (response?.sessionId) sessionIdRef.current = response.sessionId;
      if (response?.tutorSession) setTutorSession(response.tutorSession);

      setMessages(prev =>
        prev.map(m =>
          m.id === placeholderId
            ? { ...response.reply, id: response.reply?.id || placeholderId }
            : m
        )
      );
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setMessages(prev =>
        prev.map(m =>
          m.id === placeholderId
            ? { id: placeholderId, role: 'model', parts: [{ text: `Error: ${err.message}` }] }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [input, isLoading, messages]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen pt-16 bg-slate-900 text-white overflow-hidden">
      {/* Main chat column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Status bar */}
        {tutorStatus && (
          <div className="px-4 py-2 border-b border-slate-700">
            <TutorStatus status={tutorStatus} />
          </div>
        )}

        {/* Message history */}
        <div className="flex-1 overflow-hidden">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
              <span className="text-4xl">🎓</span>
              <p className="text-lg font-medium text-slate-400">iMentor Tutor</p>
              <p className="text-sm">Ask a question and your Socratic tutor will guide you.</p>
            </div>
          ) : (
            <ChatHistory messages={messages} />
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-slate-700 p-4">
          <div className="flex items-end gap-2 bg-slate-800 rounded-xl px-4 py-3 border border-slate-600 focus-within:border-blue-500 transition-colors">
            <textarea
              className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-200 placeholder-slate-500 max-h-40"
              rows={1}
              placeholder="Ask your tutor..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            {isLoading ? (
              <button
                onClick={handleStop}
                className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
                title="Stop"
              >
                <Square size={20} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="text-blue-400 hover:text-blue-300 disabled:text-slate-600 transition-colors flex-shrink-0"
                title="Send"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right panel: tutor session info */}
      {tutorSession && (
        <div className="w-80 border-l border-slate-700 overflow-y-auto flex-shrink-0">
          <TutorSessionPanel tutorSessionData={tutorSession} />
        </div>
      )}
    </div>
  );
}
