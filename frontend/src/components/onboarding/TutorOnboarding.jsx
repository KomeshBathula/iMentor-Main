import React, { useEffect, useMemo, useState } from 'react';
import HighlightOverlay from './HighlightOverlay.jsx';
import OnboardingStep from './OnboardingStep.jsx';

const TOUR_STEPS = [
    {
        id: 'welcome',
        order: 1,
        selector: '[data-tutor-tour="hero"]',
        title: 'Welcome to Tutor Mode',
        description:
            'This is Socratic Mode - instead of giving answers directly, iMentor guides you through questions so you learn by thinking.\n\nChoose a subject and start asking questions to begin learning.'
    },
    {
        id: 'subject',
        order: 2,
        selector: '[data-tutor-tour="subject-select"]',
        title: 'Choose Your Subject',
        description:
            'Choose the subject you want to learn.\n\nSelecting a subject unlocks structured learning paths, roadmaps, and quizzes specific to that topic.'
    },
    {
        id: 'input',
        order: 3,
        selector: '[data-tutor-tour="chat-input"]',
        title: 'Ask Your First Question',
        description:
            'Start by asking a question or pasting code.\n\nTutor Mode will guide you with questions that help you understand concepts step-by-step instead of just giving answers.',
        examples: [
            'What is normalization in DBMS?',
            'Explain gradient descent simply.',
            'How does binary search work?'
        ]
    },
    {
        id: 'roadmap',
        order: 4,
        selector: '[data-tutor-tour="roadmap-panel"]',
        title: 'Learning Roadmap',
        description:
            'Your learning roadmap shows structured modules.\n\nEach module contains:\n- Concepts\n- Guided learning\n- Practice quizzes\n- Progress tracking\n\nProgress like Module 1 - 22% completed helps you track learning clearly.'
    },
    {
        id: 'quiz',
        order: 5,
        selector: '[data-tutor-tour="quiz-tab"]',
        title: 'Practice Quiz',
        description:
            'Test your understanding with quizzes.\n\nQuizzes unlock as you progress through modules and help reinforce what you\'ve learned.'
    },
    {
        id: 'final',
        order: 6,
        selector: null,
        title: "You're Ready to Learn",
        description:
            'Pick a topic, ask a question, and start exploring concepts through guided Socratic learning.'
    }
];

function getCardPosition(targetRect) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const cardWidth = Math.min(420, viewportWidth * 0.92);
    const cardHeight = 360;
    const margin = 16;
    const gap = 14;

    if (!targetRect) {
        return {
            left: Math.max(margin, Math.min(viewportWidth / 2 - cardWidth / 2, viewportWidth - cardWidth - margin)),
            top: Math.max(margin, Math.min(viewportHeight / 2 - cardHeight / 2, viewportHeight - cardHeight - margin))
        };
    }

    const fitsRight = targetRect.right + gap + cardWidth <= viewportWidth - margin;
    const fitsLeft = targetRect.left - gap - cardWidth >= margin;
    const fitsBelow = targetRect.bottom + gap + cardHeight <= viewportHeight - margin;
    const fitsAbove = targetRect.top - gap - cardHeight >= margin;

    if (fitsRight) {
        return {
            left: targetRect.right + gap,
            top: Math.max(margin, Math.min(targetRect.top, viewportHeight - cardHeight - margin))
        };
    }

    if (fitsLeft) {
        return {
            left: targetRect.left - cardWidth - gap,
            top: Math.max(margin, Math.min(targetRect.top, viewportHeight - cardHeight - margin))
        };
    }

    if (fitsBelow) {
        return {
            left: Math.max(margin, Math.min(targetRect.left, viewportWidth - cardWidth - margin)),
            top: targetRect.bottom + gap
        };
    }

    if (fitsAbove) {
        return {
            left: Math.max(margin, Math.min(targetRect.left, viewportWidth - cardWidth - margin)),
            top: targetRect.top - cardHeight - gap
        };
    }

    return {
        left: Math.max(margin, Math.min(targetRect.left, viewportWidth - cardWidth - margin)),
        top: Math.max(margin, Math.min(targetRect.bottom + gap, viewportHeight - cardHeight - margin))
    };
}

function TutorOnboarding({
    isOpen,
    selectedSubject,
    availableSubjects,
    showCurriculumPanel,
    setShowCurriculumPanel,
    setRightPanelTab,
    setSelectedSubject,
    onComplete,
    onSkip,
    onReplay
}) {
    const [stepIndex, setStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

    const step = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];

    const updateTarget = useMemo(() => {
        return () => {
            if (!isOpen || !step?.selector) {
                setTargetRect(null);
                return;
            }

            const target = document.querySelector(step.selector);
            if (!target) {
                setTargetRect(null);
                return;
            }

            const rect = target.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                setTargetRect(null);
                return;
            }

            setTargetRect(rect);
        };
    }, [isOpen, step]);

    useEffect(() => {
        if (!isOpen) return;
        setStepIndex(0);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        if (step.id === 'roadmap') {
            setShowCurriculumPanel(true);
            setRightPanelTab('roadmap');
            if (!selectedSubject) {
                const preferredSubject = availableSubjects.find((s) => s.toLowerCase() === 'machine learning');
                const fallbackSubject = preferredSubject || availableSubjects[0] || null;
                if (fallbackSubject) {
                    setSelectedSubject(fallbackSubject);
                }
            }
        }

        if (step.id === 'quiz') {
            setShowCurriculumPanel(true);
            setRightPanelTab('quiz');
        }

        updateTarget();

        const onResize = () => {
            setIsMobile(window.innerWidth < 900);
            updateTarget();
        };

        const onScroll = () => updateTarget();

        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onScroll, true);

        const observer = new MutationObserver(() => updateTarget());
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });

        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', onScroll, true);
            observer.disconnect();
        };
    }, [
        isOpen,
        step,
        updateTarget,
        setShowCurriculumPanel,
        setRightPanelTab,
        setSelectedSubject,
        selectedSubject,
        availableSubjects
    ]);

    const handleNext = () => {
        if (stepIndex >= TOUR_STEPS.length - 1) {
            onComplete();
            return;
        }
        setStepIndex((prev) => prev + 1);
    };

    const handleReplay = () => {
        setStepIndex(0);
        if (onReplay) onReplay();
    };

    const cardPosition = isMobile ? { left: 0, top: 0 } : getCardPosition(targetRect);

    return (
        <>
            {isOpen ? <HighlightOverlay targetRect={step.selector ? targetRect : null} /> : null}
            <OnboardingStep
                isOpen={isOpen}
                step={step}
                totalSteps={5}
                cardPosition={cardPosition}
                isMobile={isMobile}
                onNext={handleNext}
                onSkip={onSkip}
                onReplay={handleReplay}
                onStart={onComplete}
            />
        </>
    );
}

export default TutorOnboarding;
