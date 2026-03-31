// frontend/src/components/admin/GamificationDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
    Users, Trophy, Target, Zap, Award, TrendingUp,
    Activity, Star, BookOpen, X, RefreshCw, Loader2
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const GamificationDashboard = () => {
    const [overview, setOverview] = useState(null);
    const [topPerformers, setTopPerformers] = useState([]);
    const [topCreditsEarners, setTopCreditsEarners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showStreaksModal, setShowStreaksModal] = useState(false);
    const [streakUsers, setStreakUsers] = useState([]);
    const [loadingStreaks, setLoadingStreaks] = useState(false);

    useEffect(() => {
        fetchOverview();
    }, []);

    const fetchOverview = async () => {
        try {
            setLoading(true);
            const data = await api.getGamificationOverview();
            setOverview(data.overview);
            setTopPerformers(data.topPerformers || []);
            setTopCreditsEarners(data.topCreditsEarners || []);
        } catch (error) {
            console.error('Error fetching gamification overview:', error);
            toast.error('Failed to load gamification data');
        } finally {
            setLoading(false);
        }
    };

    const fetchActiveStreaks = async () => {
        try {
            setLoadingStreaks(true);
            const data = await api.getActiveStreakUsers();
            setStreakUsers(data.users || []);
            setShowStreaksModal(true);
        } catch (error) {
            console.error('Error fetching active streaks:', error);
            toast.error('Failed to load active streak users');
        } finally {
            setLoadingStreaks(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={36} className="animate-spin text-primary" />
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Loading Gamification Dashboard...</p>
            </div>
        );
    }

    if (!overview) {
        return (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border-light dark:border-border-dark text-center">
                <Trophy size={40} className="text-text-muted-light dark:text-text-muted-dark mb-3 opacity-40" />
                <p className="text-sm font-medium text-text-light dark:text-text-dark">No gamification data available</p>
            </div>
        );
    }

    const statCards = [
        { label: 'Active Users',      value: overview.totalUsers,                                         icon: <Users size={16} className="text-primary" /> },
        { label: 'Avg Level',         value: Math.round(overview.averageLevel),                           icon: <TrendingUp size={16} className="text-blue-400" /> },
        { label: 'Total XP Credits',  value: overview.totalLearningCreditsAwarded?.toLocaleString() || '0', icon: <Star size={16} className="text-yellow-400" /> },
        { label: 'Active Streaks',    value: overview.activeStreaks,                                       icon: <Zap size={16} className="text-orange-400" />, clickable: true },
        { label: 'Boss Battles',      value: overview.totalBossBattles || 0,                              icon: <Trophy size={16} className="text-purple-400" /> },
        { label: 'Badges Earned',     value: overview.totalBadges || 0,                                   icon: <Award size={16} className="text-emerald-400" /> },
        { label: 'Active Bounties',   value: overview.activeBounties || 0,                                icon: <Target size={16} className="text-red-400" /> },
        { label: 'Top Credits',       value: (topCreditsEarners[0]?.learningCredits || 0).toLocaleString(), icon: <BookOpen size={16} className="text-cyan-400" /> },
    ];

    return (
        <div className="space-y-6 p-1">

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                        <Trophy size={20} className="text-primary" />
                        Gamification Dashboard
                    </h2>
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-0.5">
                        Monitor student engagement, XP, streaks, battles and learning credits.
                    </p>
                </div>
                <button
                    onClick={fetchOverview}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-muted-light dark:text-text-muted-dark transition-colors"
                    title="Refresh"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* ── Stats Bar ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statCards.map(({ label, value, icon, clickable }) => (
                    <div
                        key={label}
                        onClick={clickable ? fetchActiveStreaks : undefined}
                        className={`rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/40 p-3 flex items-center gap-3 ${clickable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors' : ''}`}
                    >
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            {icon}
                        </div>
                        <div>
                            <p className="text-lg font-bold text-text-light dark:text-text-dark">{value}</p>
                            <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Top Performers & Credits Earners ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top Performers */}
                <div className="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-border-light dark:border-border-dark">
                        <Trophy size={14} className="text-primary" />
                        <span className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Top Performers</span>
                    </div>
                    {topPerformers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <Trophy size={32} className="text-text-muted-light dark:text-text-muted-dark mb-2 opacity-30" />
                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">No performer data yet</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/60">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">#</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">User</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide hidden sm:table-cell">Level</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">XP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                {topPerformers.slice(0, 5).map((p, i) => (
                                    <tr key={`perf-${p.userId}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-yellow-400 text-black' : 'bg-gray-200 dark:bg-gray-700 text-text-light dark:text-text-dark'}`}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-text-light dark:text-text-dark text-xs">{p.name}</p>
                                            <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark">{p.currentStreak}d streak</p>
                                        </td>
                                        <td className="px-4 py-3 hidden sm:table-cell">
                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-200 dark:bg-gray-700 text-text-light dark:text-text-dark">Lv {p.level}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-text-light dark:text-text-dark text-xs">
                                            {p.totalLearningCredits?.toLocaleString() || '0'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Credits Earners */}
                <div className="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-border-light dark:border-border-dark">
                        <BookOpen size={14} className="text-emerald-400" />
                        <span className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Credits Awarded</span>
                    </div>
                    {topCreditsEarners.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <BookOpen size={32} className="text-text-muted-light dark:text-text-muted-dark mb-2 opacity-30" />
                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark">No credits data available yet</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800/60">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">#</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">User</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide hidden sm:table-cell">Level</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Credits</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                {topCreditsEarners.slice(0, 5).map((e, i) => (
                                    <tr key={`earner-${e.userId}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-emerald-400 text-black' : 'bg-gray-200 dark:bg-gray-700 text-text-light dark:text-text-dark'}`}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-text-light dark:text-text-dark text-xs">{e.name}</p>
                                            <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark">{e.currentStreak || 0}d streak</p>
                                        </td>
                                        <td className="px-4 py-3 hidden sm:table-cell">
                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-200 dark:bg-gray-700 text-text-light dark:text-text-dark">Lv {e.level || 0}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-400 text-xs">
                                            {(e.learningCredits || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Quick Actions ── */}
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/40 p-4">
                <p className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide mb-3">Quick Actions</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { href: '/admin/gamification/users',         icon: <Users size={14} />,    label: 'View All Users',       sub: 'Manage XP & Levels' },
                        { href: '/admin/gamification/skill-tree',    icon: <Target size={14} />,   label: 'Manage Skill Tree',    sub: 'Add & Edit Skills' },
                        { href: '/admin/gamification/contributions', icon: <Award size={14} />,    label: 'Review Contributions', sub: 'Approve Content' },
                    ].map(({ href, icon, label, sub }) => (
                        <a
                            key={label}
                            href={href}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-primary flex-shrink-0">
                                {icon}
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-text-light dark:text-text-dark">{label}</p>
                                <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark">{sub}</p>
                            </div>
                        </a>
                    ))}
                </div>
            </div>

            {/* ── Engagement Info Box ── */}
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 text-xs text-purple-300/90 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                    <Zap size={13} /> Gamification Engine
                </p>
                <p>XP, levels, streaks, boss battles and bounties are auto-calculated per session. Credits are awarded on correct answers and completing challenges. Leaderboards update in real-time.</p>
                <p className="opacity-70">Configure thresholds under <code className="bg-purple-900/40 px-1 rounded">Admin → Gamification Settings</code>.</p>
            </div>

            {/* ── Active Streaks Modal ── */}
            {showStreaksModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowStreaksModal(false)}>
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-border-light dark:border-border-dark shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                                    <Zap size={16} className="text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-text-light dark:text-text-dark text-sm">Active Streak Users</h3>
                                    <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Users with 1+ day streaks</p>
                                </div>
                            </div>
                            <button onClick={() => setShowStreaksModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-text-muted-light dark:text-text-muted-dark">
                                <X size={15} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                            {loadingStreaks ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={28} className="animate-spin text-primary" />
                                </div>
                            ) : streakUsers.length > 0 ? (
                                <div className="space-y-2">
                                    {streakUsers.map((user, index) => (
                                        <div key={`streak-${user.userId}-${index}`} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-orange-400 text-black' : 'bg-gray-200 dark:bg-gray-700 text-text-light dark:text-text-dark'}`}>{index + 1}</span>
                                                <div>
                                                    <p className="text-xs font-semibold text-text-light dark:text-text-dark">{user.name}</p>
                                                    <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark">{user.email} · Lv {user.level || 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <p className="text-xs font-bold text-orange-400">{user.currentStreak} days</p>
                                                    <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark">{(user.totalLearningCredits || 0).toLocaleString()} XP</p>
                                                </div>
                                                <Zap size={13} className="text-orange-400" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Zap size={32} className="text-text-muted-light dark:text-text-muted-dark mx-auto mb-3 opacity-30" />
                                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">No active streak users found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GamificationDashboard;
