// frontend/src/components/admin/AdminDashboardPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import * as adminApi from '../../services/adminApi.js';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import ApiKeyRequestManager from './ApiKeyRequestManager.jsx';
import UserChatManager from './UserChatManager.jsx';
import AdminInsights from './AdminInsights.jsx';
import LLMConfigManager from './LLMConfigManager.jsx';
import ModelFeedbackStats from './ModelFeedbackStats.jsx';
import TutorModeInsights from './TutorModeInsights.jsx';
import CurriculumGraphModal from './CurriculumGraphModal.jsx';
import DatasetManager from './DatasetManager.jsx';
import GamificationDashboard from './GamificationDashboard.jsx';
import MultiModelManager from './MultiModelManager.jsx';
import AdminLearningProfiles from './AdminLearningProfiles.jsx';
import UserFeedbackManager from './UserFeedbackManager.jsx';
import SystemPerformanceAlert from './SystemPerformanceAlert.jsx';

import { LogOut, RefreshCw, Shield, Users, HelpCircle, Lightbulb, Cog, Database, BarChart2, Gamepad2, Network, Link2, Brain, MessageSquareDiff } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Idle timeout constants ────────────────────────────────────────────────────
const IDLE_WARN_MS   = 9  * 60 * 1000; // warn at 9 minutes
const IDLE_LOGOUT_MS = 10 * 60 * 1000; // logout at 10 minutes
const IDLE_EVENTS    = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
    { id: 'overview',          label: 'Overview',           icon: BarChart2 },
    { id: 'user-sessions',     label: 'User Sessions',      icon: Users },
    { id: 'learning-profiles', label: 'Learning Profiles',  icon: Brain },
    { id: 'gamification',      label: 'Gamification',       icon: Gamepad2 },
    { id: 'curriculum',        label: 'Curriculum Graph',   icon: Network },
    { id: 'dataset',           label: 'Datasets',           icon: Database },
    { id: 'multi-model',       label: 'Multi-Model',        icon: Link2 },
    { id: 'feedback',          label: 'Feedback',           icon: MessageSquareDiff },
    { id: 'llm-config',        label: 'LLM Config',         icon: Cog },
    { id: 'security',          label: 'Security',           icon: Shield },
];

// ── Main Component ─────────────────────────────────────────────────────────────
function AdminDashboardPage() {
    const { setIsAdminSessionActive, setSessionId } = useAppState();
    const { logout: regularUserLogout } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab]         = useState('overview');
    const [dashboardStats, setDashboardStats] = useState({});
    const [keyRequests, setKeyRequests]     = useState([]);
    const [usersWithChats, setUsersWithChats] = useState([]);
    const [isLoading, setIsLoading]         = useState(true);
    const [loadingError, setLoadingError]   = useState('');

    const adminLogoutHandler = useCallback(() => {
        setIsAdminSessionActive(false);
        regularUserLogout();
        setSessionId(null);
        toast.success('Admin logged out.');
        navigate('/');
    }, [setIsAdminSessionActive, regularUserLogout, setSessionId, navigate]);

    // ── Idle timeout ───────────────────────────────────────────────────────────
    const warnTimerRef   = useRef(null);
    const logoutTimerRef = useRef(null);
    const warnToastIdRef = useRef(null);

    const resetIdleTimer = useCallback(() => {
        clearTimeout(warnTimerRef.current);
        clearTimeout(logoutTimerRef.current);
        if (warnToastIdRef.current) {
            toast.dismiss(warnToastIdRef.current);
            warnToastIdRef.current = null;
        }

        warnTimerRef.current = setTimeout(() => {
            warnToastIdRef.current = toast(
                '⏱️ You will be logged out in 1 minute due to inactivity.',
                { duration: 60_000, icon: '⚠️' }
            );
        }, IDLE_WARN_MS);

        logoutTimerRef.current = setTimeout(() => {
            if (warnToastIdRef.current) toast.dismiss(warnToastIdRef.current);
            toast.error('Admin session expired due to inactivity.');
            adminLogoutHandler();
        }, IDLE_LOGOUT_MS);
    }, [adminLogoutHandler]);

    useEffect(() => {
        IDLE_EVENTS.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
        resetIdleTimer(); // start the clock immediately
        return () => {
            IDLE_EVENTS.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
            clearTimeout(warnTimerRef.current);
            clearTimeout(logoutTimerRef.current);
            if (warnToastIdRef.current) toast.dismiss(warnToastIdRef.current);
        };
    }, [resetIdleTimer]);

    const fetchAdminData = useCallback(async (isRefresh = false) => {
        let toastId;
        if (isRefresh) toastId = toast.loading('Refreshing admin data…');
        else setIsLoading(true);
        setLoadingError('');

        // Use allSettled so one failing endpoint doesn't blank everything
        const [statsResult, requestsResult, usersResult] = await Promise.allSettled([
            adminApi.getDashboardStats(),
            adminApi.getApiKeyRequests(),
            adminApi.getUsersAndChats(),
        ]);

        if (statsResult.status    === 'fulfilled') setDashboardStats(statsResult.value    || {});
        if (requestsResult.status === 'fulfilled') setKeyRequests(Array.isArray(requestsResult.value) ? requestsResult.value : []);
        if (usersResult.status    === 'fulfilled') setUsersWithChats(Array.isArray(usersResult.value)    ? usersResult.value    : []);

        const anyFailed = [statsResult, requestsResult, usersResult].some(r => r.status === 'rejected');
        if (anyFailed && !isRefresh) {
            const firstError = [statsResult, requestsResult, usersResult]
                .find(r => r.status === 'rejected')?.reason?.message;
            setLoadingError(firstError || 'Some admin data failed to load — check auth.');
        }

        if (isRefresh) {
            anyFailed
                ? toast.error('Some data failed to refresh.', { id: toastId })
                : toast.success('Admin data refreshed.', { id: toastId });
        } else {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchAdminData(); }, [fetchAdminData]);

    // ── Tab content ─────────────────────────────────────────────────────────────
    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-6">
                        <SystemPerformanceAlert />
                        <AdminInsights stats={dashboardStats} isLoading={isLoading} error={loadingError} />
                        <ModelFeedbackStats />
                        <TutorModeInsights />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="card-base p-4">
                                <h2 className="text-lg font-semibold mb-3 text-text-light dark:text-text-dark flex items-center gap-2">
                                    <HelpCircle size={20} className="text-accent" /> Content Gap Analysis
                                </h2>
                                <div className="text-center py-8 px-4 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Questions students asked that the chatbot couldn't answer from your documents.</p>
                                    <p className="text-xs mt-1 text-text-muted-light/70 dark:text-text-muted-dark/70">(Feature Coming Soon)</p>
                                </div>
                            </div>
                            <div className="card-base p-4">
                                <h2 className="text-lg font-semibold mb-3 text-text-light dark:text-text-dark flex items-center gap-2">
                                    <Lightbulb size={20} className="text-accent" /> Frequently Asked Topics
                                </h2>
                                <div className="text-center py-8 px-4 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Word cloud of the most common topics students ask about.</p>
                                    <p className="text-xs mt-1 text-text-muted-light/70 dark:text-text-muted-dark/70">(Feature Coming Soon)</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'user-sessions':
                return <UserChatManager usersWithChats={usersWithChats} onRefresh={() => fetchAdminData(true)} />;

            case 'learning-profiles':
                return <AdminLearningProfiles />;

            case 'gamification':
                return <GamificationDashboard />;

            case 'curriculum':
                return <CurriculumGraphModal />;

            case 'dataset':
                return <DatasetManager />;

            case 'multi-model':
                return <MultiModelManager />;

            case 'feedback':
                return <UserFeedbackManager />;

            case 'llm-config':
                return <LLMConfigManager />;

            case 'security':
                return <ApiKeyRequestManager requests={keyRequests} onAction={() => fetchAdminData(true)} />;

            default:
                return null;
        }
    };

    return (
        <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 sm:px-6 border-b border-border-light dark:border-border-dark">
                <h1 className="text-xl font-bold">Professor's Dashboard</h1>
                <div className="flex items-center gap-2">
                    <IconButton
                        icon={RefreshCw}
                        onClick={() => fetchAdminData(true)}
                        title="Refresh admin data"
                        variant="ghost"
                        size="md"
                        className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"
                    />
                    <IconButton
                        icon={BarChart2}
                        onClick={() => navigate('/admin/analytics')}
                        title="Platform Analytics"
                        variant="ghost"
                        size="md"
                        className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"
                    />
                    <Button onClick={adminLogoutHandler} variant="danger" size="sm" leftIcon={<LogOut size={16} />}>
                        Logout Admin
                    </Button>
                </div>
            </header>

            {/* ── Tab strip ───────────────────────────────────────────────────── */}
            <div className="flex-shrink-0 flex items-center gap-0 px-2 sm:px-4 border-b border-border-light dark:border-border-dark overflow-x-auto custom-scrollbar bg-surface-light dark:bg-surface-dark">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors duration-150
                                ${isActive
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-text-muted-light dark:text-text-muted-dark hover:text-text-light dark:hover:text-text-dark hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                        >
                            <Icon size={13} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Tab content ─────────────────────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
                {renderTabContent()}
            </main>
        </div>
    );
}

export default AdminDashboardPage;
