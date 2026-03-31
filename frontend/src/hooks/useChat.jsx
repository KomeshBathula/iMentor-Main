import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { CheckCircle, Coins, Award, XCircle } from 'lucide-react';

export const useChat = ({
    messages,
    setMessages,
    currentSessionId,
    onChatProcessingChange,
    regularUserToken,
    systemPrompt,
    selectedSubject,
    selectedDocumentForAnalysis,
    tutorMode
}) => {
    const [isActuallySendingAPI, setIsActuallySendingAPI] = useState(false);
    const abortControllerRef = useRef(null);
    const [activeBountyId, setActiveBountyId] = useState(null);
    const [activeBountyMetadata, setActiveBountyMetadata] = useState(null);

    // Initial values for options
    const [useWebSearch, setUseWebSearch] = useState(false);
    const [useAcademicSearch, setUseAcademicSearch] = useState(false);
    const [criticalThinkingEnabled, setCriticalThinkingEnabled] = useState(false);

    const handleBountyCompletion = useCallback((bountyResult) => {
        if (bountyResult.isCorrect) {
            toast.custom((t) => (
                <div
                    className="bg-gradient-to-br from-green-500 to-emerald-600 text-white px-6 py-4 rounded-lg shadow-2xl max-w-md animate-in fade-in zoom-in duration-300"
                >
                    <div className="flex items-start gap-3">
                        <CheckCircle className="flex-shrink-0" size={32} />
                        <div>
                            <h3 className="font-bold text-xl mb-2">Bounty Completed! 🎉</h3>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="flex items-center gap-1">
                                    <Coins size={18} />
                                    +{bountyResult.creditsAwarded} Credits
                                </span>
                                <span className="flex items-center gap-1">
                                    <Award size={18} />
                                    +{bountyResult.learningCreditsAwarded} Learning Credits
                                </span>
                            </div>
                            <p className="text-sm opacity-90 mt-2">
                                Total: {bountyResult.newCreditsBalance} credits
                            </p>
                        </div>
                    </div>
                </div>
            ), { duration: 5000 });
        } else {
            toast.custom((t) => (
                <div
                    className="bg-gradient-to-br from-red-500 to-rose-600 text-white px-6 py-4 rounded-lg shadow-2xl max-w-md animate-in fade-in zoom-in duration-300"
                >
                    <div className="flex items-start gap-3">
                        <XCircle className="flex-shrink-0" size={32} />
                        <div>
                            <h3 className="font-bold text-xl mb-2">Incorrect Answer</h3>
                            <p className="text-sm opacity-90">
                                {bountyResult.message || 'Try again with a different approach!'}
                            </p>
                        </div>
                    </div>
                </div>
            ), { duration: 4000 });
        }
    }, []);

    const handleStreamingSendMessage = useCallback(async (inputText, placeholderId, options) => {
        const payload = {
            query: inputText.trim(),
            history: messages.slice(0, -2),
            sessionId: currentSessionId,
            useWebSearch: options.useWebSearch,
            useAcademicSearch: options.useAcademicSearch,
            systemPrompt,
            criticalThinkingEnabled: options.criticalThinkingEnabled,
            documentContextName: options.documentContextName,
            tutorMode,
            isKgRealtimeEnabled: options.isKgRealtimeEnabled ?? false,  // Issue 1.1
        };

        console.log('[useChat DEBUG] Payload being sent:', {
            useWebSearch: payload.useWebSearch,
            useAcademicSearch: payload.useAcademicSearch,
            criticalThinkingEnabled: payload.criticalThinkingEnabled,
            tutorMode: payload.tutorMode
        });

        if (activeBountyId && options.isBountyAnswer) {
            payload.bountyId = activeBountyId;
            payload.bountyAnswer = inputText.trim();
        }

        const apiUrl = `${import.meta.env.VITE_API_BASE_URL || '/api'}/chat/message`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${regularUserToken}` },
            body: JSON.stringify(payload),
            signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalBotMessageObject = null;
        let accumulatedThinking = '';
        let streamBuffer = '';
        let tokenBuffer = '';
        const BUFFER_SIZE = 1;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            streamBuffer += decoder.decode(value, { stream: true });

            let eventEndIndex;
            while ((eventEndIndex = streamBuffer.indexOf('\n\n')) !== -1) {
                const eventChunk = streamBuffer.slice(0, eventEndIndex).trim();
                streamBuffer = streamBuffer.slice(eventEndIndex + 2);

                if (!eventChunk.startsWith('data: ')) continue;

                const jsonString = eventChunk.replace('data: ', '');
                try {
                    const eventData = JSON.parse(jsonString);
                    if (eventData.type === 'token') {
                        tokenBuffer += eventData.content;
                        if (tokenBuffer.length >= BUFFER_SIZE || eventData.content.includes('\n')) {
                            const capturedBuffer = tokenBuffer;
                            tokenBuffer = '';
                            setMessages(prev => prev.map(msg => msg.id === placeholderId ? { ...msg, text: (msg.text || '') + capturedBuffer } : msg));
                        }
                    } else if (eventData.type === 'thought') {
                        accumulatedThinking += eventData.content;
                        setMessages(prev => prev.map(msg => msg.id === placeholderId ? { ...msg, thinking: accumulatedThinking } : msg));
                    } else if (eventData.type === 'step_update') {
                        const step = eventData.content;
                        setMessages(prev => prev.map(msg => {
                            if (msg.id === placeholderId) {
                                const currentSteps = msg.steps || [];
                                const existingIndex = currentSteps.findIndex(s => s.stepId === step.stepId);
                                let newSteps;
                                if (existingIndex >= 0) {
                                    newSteps = [...currentSteps];
                                    newSteps[existingIndex] = { ...newSteps[existingIndex], ...step };
                                } else {
                                    newSteps = [...currentSteps, step];
                                }
                                return { ...msg, steps: newSteps };
                            }
                            return msg;
                        }));
                    } else if (eventData.type === 'confidence_score') {
                        setMessages(prev => prev.map(msg => msg.id === placeholderId ? { ...msg, confidenceScore: eventData.content } : msg));
                    } else if (eventData.type === 'status_update') {
                        setMessages(prev => prev.map(msg => msg.id === placeholderId ? { ...msg, status: eventData.content } : msg));
                    } else if (eventData.type === 'final_answer') {
                        finalBotMessageObject = eventData.content;
                        if (eventData.bountyResult) {
                            handleBountyCompletion(eventData.bountyResult);
                        }
                    } else if (eventData.type === 'deep_research_update') {
                        setMessages(prev => prev.map(msg => msg.id === placeholderId ? { ...msg, status: eventData.content.message } : msg));
                    } else if (eventData.type === 'error') {
                        throw new Error(eventData.content);
                    }
                } catch (e) {
                    console.error('Error parsing SSE chunk:', jsonString, e);
                }
            }
        }

        if (tokenBuffer.length > 0) {
            setMessages(prev => prev.map(msg => msg.id === placeholderId ? { ...msg, text: (msg.text || '') + tokenBuffer } : msg));
        }

        if (finalBotMessageObject) {
            const finalMessage = {
                ...finalBotMessageObject,
                id: finalBotMessageObject.id || placeholderId,
                sender: 'bot',
                text: finalBotMessageObject.finalAnswer || finalBotMessageObject.text,
                isStreaming: false
            };

            setMessages(prev => [
                ...prev.filter(msg => msg.id !== placeholderId),
                finalMessage
            ]);

            if (finalBotMessageObject.action && finalBotMessageObject.action.type === 'DOWNLOAD_DOCUMENT') {
                toast.promise(
                    api.generateDocumentFromTopic(finalBotMessageObject.action.payload),
                    {
                        loading: `Generating your ${finalBotMessageObject.action.payload.docType.toUpperCase()}...`,
                        success: (data) => `Successfully downloaded '${data.filename}'!`,
                        error: (err) => `Download failed: ${err.message}`,
                    }
                );
            }
        }
    }, [currentSessionId, systemPrompt, regularUserToken, setMessages, tutorMode, messages, activeBountyId, handleBountyCompletion]);

    const handleSendMessage = useCallback(async (inputText, options = {}) => {
        if (!inputText.trim() || !regularUserToken || !currentSessionId || isActuallySendingAPI) return;

        const effectiveUseWebSearch = options.useWebSearch ?? useWebSearch;
        const effectiveUseAcademicSearch = options.useAcademicSearch ?? useAcademicSearch;
        const effectiveCriticalThinking = options.criticalThinkingEnabled ?? criticalThinkingEnabled;
        const effectiveDocumentContext = options.documentContextName ?? selectedSubject ?? selectedDocumentForAnalysis;

        abortControllerRef.current = new AbortController();

        const userMessage = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: inputText.trim(),
            timestamp: new Date().toISOString(),
        };

        const streamingPlaceholderId = `bot-streaming-${Date.now()}`;
        const placeholderMessage = {
            id: streamingPlaceholderId,
            sender: 'bot',
            text: '',
            thinking: effectiveCriticalThinking ? '' : null,
            isStreaming: true,
            timestamp: new Date().toISOString(),
            _accumulatedContent: ''
        };

        setMessages(prev => [...prev, userMessage, placeholderMessage]);
        onChatProcessingChange(true);
        setIsActuallySendingAPI(true);

        try {
            const handlerOptions = {
                useWebSearch: effectiveUseWebSearch,
                useAcademicSearch: effectiveUseAcademicSearch,
                criticalThinkingEnabled: effectiveCriticalThinking,
                documentContextName: effectiveDocumentContext
            };

            const enrichedOptions = {
                ...handlerOptions,
                isBountyAnswer: !!activeBountyId
            };

            // Always use streaming handler now
            await handleStreamingSendMessage(inputText, streamingPlaceholderId, enrichedOptions);
        } catch (error) {
            console.error("Error in handleSendMessage:", error);
            const errorMessage = error.response?.data?.message || error.message || "An unknown error occurred.";

            setMessages(prev => prev.map(msg =>
                msg.id === streamingPlaceholderId
                    ? { ...msg, isStreaming: false, text: `Error: ${error.message}` }
                    : msg
            ));
            toast.error(errorMessage);
        } finally {
            setIsActuallySendingAPI(false);
            onChatProcessingChange(false);
            setUseWebSearch(false);
            setUseAcademicSearch(false);
            if (activeBountyId) {
                setActiveBountyId(null);
                setActiveBountyMetadata(null);
            }
        }
    }, [
        regularUserToken, currentSessionId, isActuallySendingAPI, useWebSearch,
        useAcademicSearch, criticalThinkingEnabled, selectedSubject,
        selectedDocumentForAnalysis, setMessages, onChatProcessingChange,
        handleStreamingSendMessage, activeBountyId
    ]);

    return {
        handleSendMessage,
        isActuallySendingAPI,
        activeBountyId,
        setActiveBountyId,
        activeBountyMetadata,
        setActiveBountyMetadata,
        useWebSearch,
        setUseWebSearch,
        useAcademicSearch,
        setUseAcademicSearch,
        criticalThinkingEnabled,
        setCriticalThinkingEnabled
    };
};
