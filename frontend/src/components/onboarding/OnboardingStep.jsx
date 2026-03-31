import React from 'react';
import Animate from '../core/Animate.jsx';

function OnboardingStep({
    isOpen,
    step,
    totalSteps,
    cardPosition,
    isMobile,
    onNext,
    onSkip,
    onReplay,
    onStart,
    finalPrimaryLabel = 'Start Learning'
}) {
    if (!step) return null;

    const style = isMobile
        ? undefined
        : {
            left: `${cardPosition.left}px`,
            top: `${cardPosition.top}px`
        };

    const showReplay = step.id === 'final';
    const primaryLabel = step.id === 'final' ? finalPrimaryLabel : 'Next';

    return (
        <Animate show={isOpen} unmount animation="fade-in"
            className="fixed inset-0 z-[130] pointer-events-none"
        >
            <Animate
                animation="slide-up"
                duration="0.22s"
                className={`pointer-events-auto fixed w-[min(92vw,420px)] max-h-[min(82vh,560px)] overflow-y-auto rounded-2xl border border-white/15 bg-slate-900/80 p-4 text-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl ${isMobile ? 'left-1/2 -translate-x-1/2 bottom-3 sm:bottom-5' : ''}`}
                style={style}
            >
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300/90">
                                {showReplay ? 'Ready' : `Step ${Math.min(totalSteps, step.order)}/${totalSteps}`}
                            </p>
                            <button
                                onClick={onSkip}
                                className="text-xs text-slate-300 hover:text-white transition-colors"
                            >
                                Skip Tour
                            </button>
                        </div>

                        <h3 className="mt-2 text-lg font-semibold text-white">{step.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-300 whitespace-pre-line">{step.description}</p>

                        {Array.isArray(step.examples) && step.examples.length > 0 && (
                            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                                <p className="text-xs uppercase tracking-wider text-teal-200/90">Example Questions</p>
                                <ul className="mt-2 space-y-1 text-sm text-slate-200">
                                    {step.examples.map((item) => (
                                        <li key={item}>- {item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="mt-4 flex items-center justify-end gap-2">
                            {showReplay ? (
                                <button
                                    onClick={onReplay}
                                    className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 transition-colors"
                                >
                                    Replay Tour
                                </button>
                            ) : null}
                            <button
                                onClick={showReplay ? onStart : onNext}
                                className="rounded-lg bg-teal-400 px-3.5 py-2 text-sm font-semibold text-slate-900 hover:bg-teal-300 transition-colors"
                            >
                                {primaryLabel}
                            </button>
                        </div>
            </Animate>
        </Animate>
    );
}

export default OnboardingStep;
