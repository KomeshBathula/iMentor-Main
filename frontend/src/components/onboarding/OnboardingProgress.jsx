// frontend/src/components/onboarding/OnboardingProgress.jsx
import React from 'react';

const OnboardingProgress = ({ current, total }) => {
    const progressPercentage = (current / total) * 100;

    return (
        <div className="mb-4 text-center">
            <p className="text-sm font-medium text-gray-300 mb-2">
                Step {current} of {total}
            </p>
            <div className="w-full bg-slate-700/50 rounded-full h-1.5">
                <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-in-out"
                    style={{ width: `${progressPercentage}%` }}
                />
            </div>
        </div>
    );
};

export default OnboardingProgress;