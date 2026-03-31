import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Animate from '../core/Animate.jsx';
import {
    GraduationCap,
    Telescope,
    Target,
    Brain,
    TreePine,
    Swords,
    Award,
    CheckCircle2
} from 'lucide-react';
import Button from '../core/Button.jsx';

const FEATURE_INTROS = [
    {
        id: 'tutor_mode',
        match: (path) => path.startsWith('/tutor'),
        icon: GraduationCap,
        title: 'Tutor Mode',
        description: 'This mode uses a Socratic teaching flow. You will get guided explanations, targeted questions, and adaptive follow-ups based on your responses.',
        highlights: [
            'Learn through guided questions instead of answer dumps',
            'Track progress across topics and subtopics',
            'Resume your tutor journey from saved progress'
        ]
    },
    {
        id: 'deep_research',
        match: (path) => path.startsWith('/tools/deep-research'),
        icon: Telescope,
        title: 'Deep Research',
        description: 'Run a structured research pipeline that combines web and academic evidence into one report with citations and confidence signals.',
        highlights: [
            'Hybrid academic plus web source retrieval',
            'Step-by-step pipeline visibility',
            'Saved research sessions and report library'
        ]
    },
    {
        id: 'study_plan',
        match: (path) => path.startsWith('/study-plan'),
        icon: Target,
        title: 'Study Plan',
        description: 'Generate personalized learning paths with actionable modules that can launch directly into guided chat or tools.',
        highlights: [
            'Auto-generated module roadmap for your goal',
            'Track completion status per module',
            'Start module activities in one click'
        ]
    },
    {
        id: 'learning_profile',
        match: (path) => path.startsWith('/learning-profile'),
        icon: Brain,
        title: 'Learning Memory',
        description: 'See what the system has learned about your strengths, struggles, and learning patterns to personalize future tutoring.',
        highlights: [
            'Mastered and struggling concept tracking',
            'Session insights and focus areas',
            'Export and reset controls for privacy'
        ]
    },
    {
        id: 'skill_tree',
        match: (path) => path.startsWith('/gamification/skill-tree'),
        icon: TreePine,
        title: 'Skill Tree',
        description: 'Turn your topic mastery into a playable progression map with unlocks, level challenges, and credit-based advancement.',
        highlights: [
            'Build a topic game map from assessment results',
            'Play levels and unlock new nodes',
            'Spend and earn learning credits as you progress'
        ]
    },
    {
        id: 'bounties',
        match: (path) => path.startsWith('/gamification/bounties') || path.startsWith('/gamification/credits'),
        icon: Target,
        title: 'Bounty Questions',
        description: 'Complete personalized challenge prompts tied to your gaps and earn credits plus XP bonuses.',
        highlights: [
            'Daily personalized challenge questions',
            'Earn credits and bonus XP on completion',
            'Build consistency with challenge streaks'
        ]
    },
    {
        id: 'boss_battles',
        match: (path) => path.startsWith('/gamification/boss-battles'),
        icon: Swords,
        title: 'Boss Battles',
        description: 'Take focused multi-question battles on weak topics and get rewards, badges, and review guidance based on your score.',
        highlights: [
            '5-question challenge rounds',
            'XP and badge rewards for strong performance',
            'Revision guidance after weak attempts'
        ]
    },
    {
        id: 'badges',
        match: (path) => path.startsWith('/gamification/badges'),
        icon: Award,
        title: 'Badge Collection',
        description: 'Track your achievements across the platform and monitor completion progress across milestone categories.',
        highlights: [
            'Unlocked and locked badge visibility',
            'Completion progress tracking',
            'Achievement-based motivation'
        ]
    }
];

function ModeFeatureIntroGate({ userId, isBlocked = false }) {
    const location = useLocation();
    const [activeIntro, setActiveIntro] = useState(null);
    const [isOpen, setIsOpen] = useState(false);

    const userScope = useMemo(() => userId || 'anonymous', [userId]);

    useEffect(() => {
        if (isBlocked) {
            setIsOpen(false);
            return;
        }

        const match = FEATURE_INTROS.find((feature) => feature.match(location.pathname));
        if (!match) {
            setIsOpen(false);
            return;
        }

        // Tutor Mode and Deep Research now have dedicated multi-step contextual onboarding tours.
        if (match.id === 'tutor_mode' || match.id === 'deep_research') {
            setIsOpen(false);
            return;
        }

        const key = `imentor.featureIntroSeen.${userScope}.${match.id}`;
        const seen = localStorage.getItem(key) === '1';

        if (!seen) {
            setActiveIntro({ ...match, storageKey: key });
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [location.pathname, userScope, isBlocked]);

    const handleDismiss = () => {
        if (!activeIntro) return;
        localStorage.setItem(activeIntro.storageKey, '1');
        setIsOpen(false);
    };

    useEffect(() => {
        if (!isOpen) return undefined;
        const onEscape = (event) => {
            if (event.key === 'Escape') {
                handleDismiss();
            }
        };

        window.addEventListener('keydown', onEscape);
        return () => window.removeEventListener('keydown', onEscape);
    }, [isOpen, activeIntro]);

    const Icon = activeIntro?.icon;

    return (
        <Animate show={isOpen && !!activeIntro} unmount animation="fade-in"
            className="fixed inset-0 z-[105] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
            <Animate animation="slide-up"
                className="w-full max-w-xl rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-6 sm:p-8 shadow-2xl"
            >
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 rounded-xl bg-primary/10 p-3">
                                {Icon ? <Icon className="h-7 w-7 text-primary" /> : null}
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-widest text-text-muted-light dark:text-text-muted-dark">First Time In This Mode</p>
                                <h2 className="mt-1 text-2xl font-bold text-text-light dark:text-text-dark">{activeIntro?.title}</h2>
                                <p className="mt-2 text-sm sm:text-base text-text-muted-light dark:text-text-muted-dark">{activeIntro?.description}</p>
                            </div>
                        </div>

                        <div className="mt-6 space-y-2">
                            {activeIntro?.highlights?.map((item) => (
                                <div key={item} className="flex items-start gap-2 text-sm text-text-light dark:text-text-dark">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-7 flex justify-end">
                            <Button onClick={handleDismiss} size="sm">
                                Got it
                            </Button>
                        </div>
            </Animate>
        </Animate>
    );
}

export default ModeFeatureIntroGate;
