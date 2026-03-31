// frontend/src/components/chat/ChatHistory.jsx

import React, { useRef, useEffect, useState } from 'react';
import MessageBubble from './MessageBubble';
import Animate from '../core/Animate.jsx';
import { ArrowDownCircle } from 'lucide-react';

function ChatHistory({ messages, onCueClick, onAnalyze }) {

    const scrollRef = useRef(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const isNearBottomRef = useRef(true);
    const lastStreamAutoScrollAtRef = useRef(0);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        isNearBottomRef.current = distanceFromBottom < 200;
        if (distanceFromBottom > 200) {
            setShowScrollButton(true);
        } else {
            setShowScrollButton(false);
        }
    };

    const scrollToBottom = (behavior = 'smooth') => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: behavior,
            });
        }
    };

    // Auto-scroll on newly added messages (user always; bot only if user is following near-bottom).
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.sender === 'user') {
                scrollToBottom('auto');
                isNearBottomRef.current = true;
            } else if (lastMessage.sender === 'bot' && isNearBottomRef.current) {
                scrollToBottom('auto');
            }
        }
    }, [messages.length]);

    // Throttle auto-follow while streaming so the bubble grows in place without jumpy per-token scrolling.
    useEffect(() => {
        if (messages.length === 0) return;
        const lastMessage = messages[messages.length - 1];
        const shouldAutoFollowStream = lastMessage?.isStreaming && isNearBottomRef.current;
        if (shouldAutoFollowStream) {
            const now = Date.now();
            if (now - lastStreamAutoScrollAtRef.current < 120) {
                return;
            }
            lastStreamAutoScrollAtRef.current = now;
            scrollToBottom('auto');
        }
    }, [messages]);


    // --- GROUPING LOGIC START ---
    const groupedMessages = [];
    messages.forEach(msg => {
        if (msg.sender === 'bot') {
            const lastGroup = groupedMessages.length > 0 ? groupedMessages[groupedMessages.length - 1] : null;

            // Check if last item is a bot message (or group of bot messages)
            if (lastGroup && (lastGroup.sender === 'bot' || lastGroup.isBotGroup)) {
                if (lastGroup.isBotGroup) {
                    lastGroup.versions.push(msg);
                } else {
                    // Convert previous single bot message to a group
                    groupedMessages[groupedMessages.length - 1] = {
                        id: lastGroup.id,
                        sender: 'bot',
                        isBotGroup: true,
                        versions: [lastGroup, msg],
                        timestamp: msg.timestamp
                    };
                }
            } else {
                // New bot message, not consecutive
                groupedMessages.push(msg);
            }
        } else {
            groupedMessages.push(msg);
        }
    });
    // --- GROUPING LOGIC END ---

    return (
        <div className="relative flex-1">
            <div ref={scrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {groupedMessages.map((msg) => {
                        const isStreamingGroup = !!msg.isStreaming || (msg.isBotGroup && msg.versions?.some(version => version.isStreaming));
                        return (
                        <Animate
                            key={msg.id}
                            animation="slide-up"
                            duration="0.3s"
                        >
                            <MessageBubble
                                id={msg.id}
                                sender={msg.sender}
                                text={msg.text}
                                thinking={msg.thinking}
                                references={msg.references}
                                timestamp={msg.timestamp}
                                sourcePipeline={msg.source_pipeline}
                                isStreaming={msg.isStreaming}
                                criticalThinkingCues={msg.criticalThinkingCues}
                                onCueClick={onCueClick}
                                messageId={msg.id}
                                logId={msg.logId}
                                status={msg.status}
                                onAnalyze={onAnalyze}
                                steps={msg.steps}
                                confidenceScore={msg.confidenceScore}
                                historyVersions={msg.isBotGroup ? msg.versions : undefined}
                                isError={msg.isError}
                                isLastAiMessage={
                                    groupedMessages.length > 0 &&
                                    groupedMessages[groupedMessages.length - 1].id === msg.id &&
                                    (msg.sender === 'bot' || msg.isBotGroup)
                                }
                                onTryAgain={() => {
                                    // Find the user message immediately preceding this bot group/message
                                    const groupIndex = groupedMessages.findIndex(m => m.id === msg.id);
                                    if (groupIndex > 0) {
                                        const previousMessage = groupedMessages[groupIndex - 1];
                                        if (previousMessage && previousMessage.sender === 'user') {
                                            onCueClick(previousMessage.text, { isTryAgain: true });
                                        }
                                    }
                                }}
                            />
                        </Animate>
                        );
                    })}
            </div>

            {showScrollButton && (
                <Animate
                    show={showScrollButton}
                    animation="scale-in"
                    unmount
                    as="button"
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-5 right-5 z-20 p-2 bg-primary dark:bg-primary-dark text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                    title="Scroll to bottom"
                >
                    <ArrowDownCircle size={24} />
                </Animate>
            )}
        </div>
    );
}

export default ChatHistory;