import React, { useEffect, useMemo, useState } from 'react';
import HighlightOverlay from './HighlightOverlay.jsx';
import OnboardingStep from './OnboardingStep.jsx';

const TOUR_STEPS = [
    {
        id: 'engine',
        order: 1,
        selector: '[data-deep-research-tour="hero-input"]',
        title: 'Deep Research Engine',
        description:
            'Deep Research analyzes information from academic papers, technical documentation, and real-time web sources to produce research-grade insights.\n\nUnlike normal chat responses, this tool gathers information from multiple research sources and synthesizes them into structured analysis.'
    },
    {
        id: 'question',
        order: 2,
        selector: '[data-deep-research-tour="query-input"]',
        title: 'Ask a Research Question',
        description: 'Enter the topic or claim you want to verify or research.',
        examples: [
            'Impact of AI in healthcare',
            'How transformers improved NLP',
            'Climate change mitigation strategies'
        ]
    },
    {
        id: 'depth',
        order: 3,
        selector: '[data-deep-research-tour="depth-controls"]',
        title: 'Customize Your Research',
        description:
            'You can control how deep the research should go.\n\nOptions include:\n- Standard (5 sources) - quick research\n- Deep (8 sources) - balanced analysis\n- Extensive (12 sources) - comprehensive study\n- Custom - define your own depth\n\nYou can also adjust the Empirical % to determine how much of the research relies on empirical studies and experimental results.'
    },
    {
        id: 'start',
        order: 4,
        selector: '[data-deep-research-tour="start-button"]',
        title: 'Run the Research Engine',
        description:
            'Click Start Research to begin the analysis.\n\nThe system gathers information from research papers and trusted sources, then synthesizes the results into a structured explanation.'
    },
    {
        id: 'recent',
        order: 5,
        selector: '[data-deep-research-tour="recent-research"]',
        title: 'Access Your Recent Research',
        description:
            'Your latest research topics appear in the Recent Research section below.\n\n- The last 5 research topics are displayed here.\n- Topics automatically disappear after 24 hours.\n\nTo view all saved research reports, use the Library button at the top-right.'
    },
    {
        id: 'final',
        order: 6,
        selector: '[data-deep-research-tour="library-button"]',
        title: 'Export Your Research',
        description:
            'Inside the Library, you can access all saved research sessions.\n\nEach research result can be downloaded as a formatted research paper for reference or sharing.'
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

function DeepResearchOnboarding({ isOpen, onComplete, onSkip, onReplay }) {
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
    }, [isOpen, step, updateTarget]);

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
                totalSteps={TOUR_STEPS.length}
                cardPosition={cardPosition}
                isMobile={isMobile}
                onNext={handleNext}
                onSkip={onSkip}
                onReplay={handleReplay}
                onStart={onComplete}
                finalPrimaryLabel="Start Exploring"
            />
        </>
    );
}

export default DeepResearchOnboarding;
