// frontend/src/components/onboarding/OnboardingCard.jsx
import React from 'react';
import Animate from '../core/Animate.jsx';
import Button from '../core/Button';

const OnboardingCard = ({
    icon: Icon, title, description, visual,
    isFinalStep, isFirstStep, onNext, onPrev, onSkip, onFinish
}) => {
    const handleNext = () => { onNext(); };
    const handlePrev = () => { onPrev(); };

    return (
        <Animate
            animation="scale-in"
            duration="0.3s"
            className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden"
        >
            <div className="text-center">
                <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-4">
                    <Icon className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">{title}</h2>
                <p className="mt-2 text-base text-text-muted-light dark:text-text-muted-dark max-w-md mx-auto">{description}</p>
            </div>

            <div className="my-8 h-32 flex items-center justify-center">
                <div className="w-48 h-full flex items-center justify-center text-center bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-lg">
                    {visual}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={onSkip} className="text-text-muted-light dark:text-text-muted-dark">
                    {isFinalStep ? "Go to App" : "Skip Tutorial"}
                </Button>
                <div className="flex items-center gap-2">
                    {!isFirstStep && (
                        <Button variant="outline" size="sm" onClick={handlePrev}>
                            Back
                        </Button>
                    )}
                    {isFinalStep ? (
                        <Button size="sm" onClick={onFinish}>
                            Start Learning!
                        </Button>
                    ) : (
                         <Button size="sm" onClick={handleNext}>
                            Next
                        </Button>
                    )}
                </div>
            </div>
        </Animate>
    );
};

export default OnboardingCard;