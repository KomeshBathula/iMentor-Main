import { useCallback, useEffect, useMemo, useState } from 'react';

const TUTOR_ONBOARDING_KEY = 'mentor:tutor_onboarding_seen';

function getLegacyTutorIntroKey(userScope) {
    return `imentor.featureIntroSeen.${userScope}.tutor_mode`;
}

export default function useTutorOnboarding({ userId, isTutorRoute, isBlocked }) {
    const [isTourOpen, setIsTourOpen] = useState(false);

    const userScope = useMemo(() => userId || 'anonymous', [userId]);
    const scopedKey = useMemo(() => `${TUTOR_ONBOARDING_KEY}:${userScope}`, [userScope]);
    const legacyTutorIntroKey = useMemo(() => getLegacyTutorIntroKey(userScope), [userScope]);

    const hasSeenTour = useCallback(() => {
        try {
            return (
                localStorage.getItem(TUTOR_ONBOARDING_KEY) === '1' ||
                localStorage.getItem(scopedKey) === '1' ||
                localStorage.getItem(legacyTutorIntroKey) === '1'
            );
        } catch {
            return false;
        }
    }, [scopedKey, legacyTutorIntroKey]);

    const markSeen = useCallback(() => {
        try {
            localStorage.setItem(TUTOR_ONBOARDING_KEY, '1');
            localStorage.setItem(scopedKey, '1');
            // Keep existing mode intro state in sync so the old gate does not re-open.
            localStorage.setItem(legacyTutorIntroKey, '1');
        } catch {
            // ignore storage issues in private mode environments
        }
    }, [scopedKey, legacyTutorIntroKey]);

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

    useEffect(() => {
        if (!isTutorRoute || isBlocked) return;
        if (hasSeenTour()) return;
        setIsTourOpen(true);
    }, [isTutorRoute, isBlocked, hasSeenTour]);

    return {
        isTourOpen,
        setIsTourOpen,
        startTour,
        completeTour,
        skipTour,
        hasSeenTour,
        onboardingKey: TUTOR_ONBOARDING_KEY,
        scopedOnboardingKey: scopedKey
    };
}
