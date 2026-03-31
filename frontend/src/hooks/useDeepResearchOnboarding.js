import { useCallback, useEffect, useMemo, useState } from 'react';

const DEEP_RESEARCH_INTRO_KEY = 'deepResearchIntroSeen';

function getLegacyDeepResearchIntroKey(userScope) {
    return `imentor.featureIntroSeen.${userScope}.deep_research`;
}

export default function useDeepResearchOnboarding({ userId, isDeepResearchRoute, isBlocked }) {
    const [isTourOpen, setIsTourOpen] = useState(false);

    const userScope = useMemo(() => userId || 'anonymous', [userId]);
    const scopedKey = useMemo(() => `${DEEP_RESEARCH_INTRO_KEY}:${userScope}`, [userScope]);
    const legacyDeepResearchIntroKey = useMemo(() => getLegacyDeepResearchIntroKey(userScope), [userScope]);

    const hasSeenTour = useCallback(() => {
        try {
            const globalSeen = localStorage.getItem(DEEP_RESEARCH_INTRO_KEY);
            return (
                globalSeen === 'true' ||
                globalSeen === '1' ||
                localStorage.getItem(scopedKey) === '1'
            );
        } catch {
            return false;
        }
    }, [scopedKey]);

    const markSeen = useCallback(() => {
        try {
            localStorage.setItem(DEEP_RESEARCH_INTRO_KEY, 'true');
            localStorage.setItem(scopedKey, '1');
            // Keep old mode-intro gate in sync and prevent duplicate re-open.
            localStorage.setItem(legacyDeepResearchIntroKey, '1');
        } catch {
            // ignore storage issues
        }
    }, [scopedKey, legacyDeepResearchIntroKey]);

    const completeTour = useCallback(() => {
        markSeen();
        setIsTourOpen(false);
    }, [markSeen]);

    const skipTour = useCallback(() => {
        markSeen();
        setIsTourOpen(false);
    }, [markSeen]);

    const startTour = useCallback(() => {
        setIsTourOpen(true);
    }, []);

    const resetTour = useCallback(() => {
        try {
            localStorage.removeItem(DEEP_RESEARCH_INTRO_KEY);
            localStorage.removeItem(scopedKey);
            localStorage.removeItem(legacyDeepResearchIntroKey);
        } catch {
            // ignore storage issues
        }
        setIsTourOpen(true);
    }, [scopedKey, legacyDeepResearchIntroKey]);

    useEffect(() => {
        if (!isDeepResearchRoute || isBlocked) return;
        if (hasSeenTour()) return;
        setIsTourOpen(true);
    }, [isDeepResearchRoute, isBlocked, hasSeenTour]);

    return {
        isTourOpen,
        setIsTourOpen,
        startTour,
        completeTour,
        skipTour,
        resetTour,
        hasSeenTour,
        onboardingKey: DEEP_RESEARCH_INTRO_KEY,
        scopedOnboardingKey: scopedKey
    };
}
