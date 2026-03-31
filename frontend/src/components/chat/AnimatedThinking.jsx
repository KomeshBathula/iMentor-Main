import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTypingEffect } from '../../hooks/useTypingEffect.js';
import { renderMarkdown } from '../../utils/markdownUtils';

const createMarkup = (markdownText) => {
    if (!markdownText) return { __html: '' };
    return renderMarkdown(markdownText);
};

const AnimatedThinking = ({ content, isComplete = false, className = "prose prose-xs dark:prose-invert max-w-none text-text-muted-light dark:text-text-muted-dark", cursorClassName = "bg-gray-500" }) => {
    const [completedTyping, setCompletedTyping] = useState('');
    const [currentTyping, setCurrentTyping] = useState('');
    const [isWaiting, setIsWaiting] = useState(true);
    const lastContentRef = useRef('');

    useEffect(() => {
        if (content && content.length > lastContentRef.current.length) {
            const newChunk = content.substring(lastContentRef.current.length);
            setCurrentTyping(newChunk);
            setIsWaiting(false);
            lastContentRef.current = content;
        } else if (!content) {
            setCompletedTyping('');
            setCurrentTyping('');
            lastContentRef.current = '';
        }
    }, [content]);

    const onTypingComplete = useCallback(() => {
        setCompletedTyping(prev => prev + currentTyping);
        setCurrentTyping('');
        setIsWaiting(true);
    }, [currentTyping]);

    const animatedChunk = useTypingEffect(currentTyping, 1, onTypingComplete); // Speed 1 for near-instant flow
    const combinedText = completedTyping + animatedChunk;

    return (
        <div className={className}>
            <div dangerouslySetInnerHTML={createMarkup(combinedText)} className="inline prose-inherit" />
            {!isComplete && <span className={`animate-pulse inline-block w-1.5 h-4 ml-0.5 translate-y-0.5 ${cursorClassName}`}></span>}
        </div>
    );
};

export default AnimatedThinking;
