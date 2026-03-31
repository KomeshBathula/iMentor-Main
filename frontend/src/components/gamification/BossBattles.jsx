import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Trophy, Clock, X, CheckCircle, XCircle, Sparkles, Award, TrendingUp, Zap, Star, Home, RefreshCw, Loader2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Animate from '../core/Animate.jsx';
import { formatTopicName } from '../../utils/helpers';

const BossBattles = () => {
    const navigate = useNavigate();
    const [battles, setBattles] = useState([]);
    const [history, setHistory] = useState([]);
    const [activeBattle, setActiveBattle] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [view, setView] = useState('list'); // 'list', 'battle', 'result'

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const [battlesRes, historyRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_BASE_URL}/gamification/boss-battles`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${import.meta.env.VITE_API_BASE_URL}/gamification/boss-battles/history`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            setBattles(battlesRes.data.battles || []);
            setHistory(historyRes.data.history || []);
            setLoading(false);
        } catch (error) {
            console.error('[BossBattles] Error:', error);
            setLoading(false);
        }
    };

    const startBattle = (battle) => {
        setActiveBattle(battle);
        setCurrentQuestion(0);
        setAnswers(new Array(battle.questions.length).fill({ userAnswer: '', timeSpent: 0 }));
        setView('battle');
    };

    const selectAnswer = (answer) => {
        const newAnswers = [...answers];
        const isCorrect = answer === activeBattle.questions[currentQuestion].correctAnswer;
        newAnswers[currentQuestion] = { userAnswer: answer, timeSpent: 10, isCorrect };
        setAnswers(newAnswers);
    };

    const nextQuestion = () => {
        if (currentQuestion < activeBattle.questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        }
    };

    const submitBattle = async () => {
        if (submitting) return; // Prevent duplicate submissions

        setSubmitting(true);
        try {
            const token = localStorage.getItem('authToken');
            const response = await axios.post(
                `${import.meta.env.VITE_API_BASE_URL}/gamification/boss-battle/${activeBattle.battleId}/submit`,
                { answers },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const battleResult = response.data;
            setResult(battleResult);
            setView('result');

            // Show success/failure toast with detailed scoring - Monochromatic
            if (battleResult.status === 'completed') {
                toast.custom((t) => (
                    <div
                        className="bg-black text-white px-6 py-4 rounded-lg shadow-2xl border border-white/20 animate-motion-scale-in"
                    >
                        <div className="flex items-start gap-3">
                            <Trophy className="flex-shrink-0 text-white" size={32} />
                            <div>
                                <h3 className="font-black text-xl mb-2 uppercase tracking-wide">Victory Reclaimed</h3>
                                <div className="space-y-1 text-zinc-300">
                                    <p className="flex items-center gap-2">
                                        <TrendingUp size={18} />
                                        <span className="font-semibold text-white">Score: {battleResult.score}%</span>
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <Star size={18} />
                                        <span className="font-semibold text-white">+{battleResult.earnedXP} XP</span>
                                        <span className="text-sm opacity-80">(Total: {battleResult.newXPTotal})</span>
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <Award size={18} />
                                        <span className="font-semibold text-white">Level {battleResult.newLevel}</span>
                                    </p>
                                    {battleResult.earnedBadge && (
                                        <p className="flex items-center gap-2">
                                            <Sparkles size={18} />
                                            <span className="font-semibold text-white">Badge: {battleResult.earnedBadge}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ), { duration: 6000 });

                // Show level up animation if leveled up - Monochromatic
                if (battleResult.leveledUp) {
                    setTimeout(() => {
                        toast.custom((t) => (
                            <div
                                className="bg-white text-black p-6 rounded-2xl shadow-2xl text-center border-4 border-black animate-motion-scale-in"
                            >
                                <Sparkles className="mx-auto mb-2 text-black" size={48} />
                                <h2 className="text-3xl font-black mb-1 tracking-tighter uppercase">LEVEL UP</h2>
                                <p className="text-5xl font-black">{battleResult.newLevel}</p>
                            </div>
                        ), { duration: 4000 });
                    }, 2000);
                }
            } else {
                toast.error(
                    `Battle failed with ${battleResult.score}%. Review the revision plan and try again.`,
                    {
                        duration: 4000,
                        icon: '✖',
                        style: {
                            background: '#000',
                            color: '#fff',
                            border: '1px solid #333'
                        }
                    }
                );
            }

            // Remove the submitted battle from active battles immediately
            setBattles(prevBattles =>
                prevBattles.filter(b => b.battleId !== activeBattle.battleId)
            );

            // Add to history immediately for better UX
            if (battleResult.status === 'completed' || battleResult.status === 'failed') {
                setHistory(prevHistory => [
                    {
                        ...activeBattle,
                        ...battleResult,
                        completedAt: new Date()
                    },
                    ...prevHistory
                ]);
            }

            // Refresh complete data after showing result (reduced to 4 seconds)
            setTimeout(async () => {
                await fetchData();
                setView('list');
                setActiveBattle(null);
                setResult(null);
                setSubmitting(false);
            }, 4000);

        } catch (error) {
            console.error('[BossBattles] Submit error:', error);
            toast.error(error.response?.data?.message || 'Error submitting battle', {
                style: {
                    background: '#000',
                    color: '#fff',
                    border: '1px solid #333'
                }
            });
            setSubmitting(false);
        }
    };

    const getDifficultyColor = (difficulty) => {
        const colors = {
            easy: 'bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600',
            medium: 'bg-zinc-200 text-zinc-900 border-zinc-400 dark:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-500',
            hard: 'bg-zinc-800 text-white border-black dark:bg-zinc-900 dark:text-white dark:border-zinc-500'
        };
        return colors[difficulty] || colors.medium;
    };

    const getDifficultyIcon = (difficulty) => {
        // Using monochromatic symbols instead of colored stars
        const icons = {
            easy: '●',
            medium: '●●',
            hard: '●●●'
        };
        return icons[difficulty] || icons.medium;
    };

    // Battle View
    if (view === 'battle' && activeBattle) {
        const question = activeBattle.questions[currentQuestion];
        const progress = ((currentQuestion + 1) / activeBattle.questions.length) * 100;
        const allAnswered = answers.every(a => a.userAnswer);

        return (
            <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-200 dark:scrollbar-track-gray-900">
                <div className="w-full space-y-6">

                    {/* ── Header ── */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <h2 className="text-3xl font-bold text-text-light dark:text-text-dark flex items-center gap-3">
                                <Swords size={28} className="text-black dark:text-white" />
                                Boss Battle: <span className="text-black dark:text-white">{activeBattle.bossName || formatTopicName(activeBattle.targetWeakness, true)}</span>
                            </h2>
                            <p className="text-base text-text-muted-light dark:text-text-muted-dark mt-1 flex items-center gap-2">
                                <span className={`px-3 py-0.5 text-xs font-bold uppercase tracking-widest rounded-full border ${getDifficultyColor(activeBattle.difficulty)}`}>
                                    {activeBattle.difficulty}
                                </span>
                                <span>{activeBattle.questions.length} questions</span>
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                if (confirm('Are you sure you want to exit this battle? Your progress will be lost.')) {
                                    setView('list');
                                    setActiveBattle(null);
                                    setCurrentQuestion(0);
                                    setAnswers([]);
                                }
                            }}
                            className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-text-muted-light dark:text-text-muted-dark transition-colors"
                            title="Exit Battle"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* ── Progress ── */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/40 px-6 py-4">
                        <div className="flex justify-between text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide mb-3">
                            <span>Question {currentQuestion + 1} / {activeBattle.questions.length}</span>
                            <span>{Math.round(progress)}% Complete</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                            <div
                                className="bg-black dark:bg-white h-full transition-all duration-300 rounded-full"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* ── Question ── */}
                    <div className="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
                        <div className="px-6 py-5 border-b border-border-light dark:border-border-dark bg-gray-100 dark:bg-gray-800">
                            <p className="text-xl font-medium text-text-light dark:text-text-dark leading-relaxed">
                                {question.questionText}
                            </p>
                        </div>
                        <div className="divide-y divide-border-light dark:divide-border-dark">
                            {question.options.map((option, index) => (
                                <button
                                    key={index}
                                    onClick={() => selectAnswer(option)}
                                    className={`w-full text-left px-6 py-5 transition-colors flex items-center gap-4 ${
                                        answers[currentQuestion]?.userAnswer === option
                                            ? 'bg-gray-100 dark:bg-white/10 border-l-4 border-black dark:border-white'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 border-l-4 border-transparent'
                                    }`}
                                >
                                    <span className={`flex-shrink-0 w-9 h-9 rounded-lg font-mono font-bold text-base flex items-center justify-center border-2 ${
                                        answers[currentQuestion]?.userAnswer === option
                                            ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                                            : 'border-border-light dark:border-border-dark text-text-muted-light dark:text-text-muted-dark bg-gray-100 dark:bg-gray-700'
                                    }`}>
                                        {String.fromCharCode(65 + index)}
                                    </span>
                                    <span className={`text-base font-medium ${
                                        answers[currentQuestion]?.userAnswer === option
                                            ? 'text-black dark:text-white font-semibold'
                                            : 'text-text-light dark:text-text-dark'
                                    }`}>
                                        {option}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Navigation ── */}
                    <div className="flex justify-between items-center pt-2">
                        <button
                            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                            disabled={currentQuestion === 0}
                            className="px-8 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-semibold text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>

                        <div className="flex gap-1">
                            {activeBattle.questions.map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                        i === currentQuestion ? 'bg-black dark:bg-white' :
                                        answers[i]?.userAnswer ? 'bg-emerald-400' :
                                        'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                />
                            ))}
                        </div>

                        <div className="flex gap-3">
                            {currentQuestion < activeBattle.questions.length - 1 && (
                                <button
                                    onClick={nextQuestion}
                                    disabled={!answers[currentQuestion]?.userAnswer}
                                    className="px-8 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    Next
                                </button>
                            )}
                            {currentQuestion === activeBattle.questions.length - 1 && (
                                <button
                                    onClick={submitBattle}
                                    disabled={!allAnswered || submitting}
                                    className="px-8 py-3 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                            Processing
                                        </>
                                    ) : (
                                        <>
                                            <Trophy size={16} />
                                            Submit Battle
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    // Result View
    if (view === 'result' && result) {
        const passed = result.status === 'completed';

        return (
            <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-black overflow-y-auto scrollbar-thin scrollbar-thumb-black scrollbar-track-zinc-100 dark:scrollbar-thumb-white dark:scrollbar-track-zinc-900">
                <div className="min-h-screen flex flex-col justify-center items-center p-6">
                    <Animate
                        animation="scale-in"
                        className={`w-full max-w-2xl p-10 border-4 relative overflow-hidden bg-white dark:bg-zinc-950 shadow-2xl rounded-3xl ${passed
                            ? 'border-black dark:border-white'
                            : 'border-zinc-400 dark:border-zinc-600'
                            }`}
                    >
                        {/* Close Button */}
                        <button
                            onClick={async () => {
                                await fetchData();
                                setView('list');
                                setActiveBattle(null);
                                setResult(null);
                                setSubmitting(false);
                            }}
                            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-black dark:hover:text-white transition-colors z-20 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full"
                        >
                            <X size={24} />
                        </button>

                        {/* Confetti effect for victory - Monochromatic */}
                        {passed && (
                            <div className="absolute inset-0 pointer-events-none">
                                {[...Array(30)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute w-2 h-2 bg-black dark:bg-white animate-ping"
                                        style={{
                                            left: `${Math.random() * 100}%`,
                                            top: `${Math.random() * 100}%`,
                                            animationDelay: `${i * 50}ms`,
                                            animationDuration: '2.5s',
                                            clipPath: i % 2 === 0 ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'circle(50% at 50% 50%)'
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        <div className="mb-8">
                            {passed ? (
                                <Trophy className="mx-auto text-black dark:text-white animate-bounce" size={80} strokeWidth={1.5} />
                            ) : (
                                <XCircle className="mx-auto text-zinc-400 dark:text-zinc-600" size={80} strokeWidth={1.5} />
                            )}
                        </div>

                        <h2 className="text-4xl font-black text-center mb-2 uppercase tracking-tighter text-black dark:text-white leading-none">
                            {passed ? 'Victory Reclaimed' : 'Defeat'}
                        </h2>
                        <p className="text-center text-zinc-500 uppercase tracking-widest text-xs font-bold mb-8">
                            {passed ? 'Knowledge Synchronized' : 'Synchronization Failed'}
                        </p>

                        <div className="bg-zinc-100 dark:bg-zinc-900 p-8 mb-8 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                            <div className="flex justify-center items-baseline gap-1 mb-6">
                                <span className="text-6xl font-black text-black dark:text-white">{result.score}</span>
                                <span className="text-2xl font-bold text-zinc-400">%</span>
                            </div>

                            <div className="grid grid-cols-2 gap-px bg-zinc-300 dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-700">
                                <div className="text-center bg-white dark:bg-zinc-900 p-4">
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Correct</p>
                                    <p className="text-2xl font-bold text-black dark:text-white">
                                        {result.correctAnswers}/{result.totalQuestions}
                                    </p>
                                </div>
                                <div className="text-center bg-white dark:bg-zinc-900 p-4">
                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Pass Mark</p>
                                    <p className="text-2xl font-bold text-black dark:text-white">60%</p>
                                </div>
                            </div>

                            {passed && (
                                <div className="space-y-0 mt-8">
                                    <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                                        <span className="flex items-center gap-3 text-black dark:text-white font-bold uppercase text-sm tracking-wider">
                                            <Star size={18} />
                                            XP Earned
                                        </span>
                                        <span className="text-xl font-black text-black dark:text-white">
                                            +{result.earnedXP}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                                        <span className="flex items-center gap-3 text-black dark:text-white font-bold uppercase text-sm tracking-wider">
                                            <TrendingUp size={18} />
                                            Total XP
                                        </span>
                                        <span className="text-xl font-black text-black dark:text-white">
                                            {result.newXPTotal}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                                        <span className="flex items-center gap-3 text-black dark:text-white font-bold uppercase text-sm tracking-wider">
                                            <Award size={18} />
                                            Level
                                        </span>
                                        <span className="text-xl font-black text-black dark:text-white flex items-center gap-2">
                                            {result.newLevel}
                                            {result.leveledUp && (
                                                <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full dark:bg-white dark:text-black">UP</span>
                                            )}
                                        </span>
                                    </div>

                                    {result.earnedBadge && (
                                        <div className="flex items-center justify-between p-4 bg-black text-white dark:bg-white dark:text-black mt-2">
                                            <span className="flex items-center gap-3 font-bold uppercase text-sm tracking-wider">
                                                <Sparkles size={18} />
                                                Badge
                                            </span>
                                            <span className="text-lg font-black uppercase">
                                                {result.earnedBadge}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {result.revisionPlan && (
                            <Animate
                                animation="slide-up"
                                delay={500}
                                className="mt-6 p-6 bg-zinc-50 dark:bg-zinc-900 border-l-4 border-black dark:border-white text-left"
                            >
                                <h3 className="font-bold mb-3 flex items-center gap-2 text-black dark:text-white uppercase tracking-wider text-sm">
                                    <Zap className="text-black dark:text-white" size={16} fill="currentColor" />
                                    AI Revision Protocol
                                </h3>
                                <p className="text-sm font-serif text-zinc-700 dark:text-zinc-300 mb-4 leading-relaxed italic">
                                    "{result.revisionPlan.aiSuggestions}"
                                </p>
                                {result.revisionPlan.recommendedTopics && (
                                    <div>
                                        <p className="text-xs font-bold text-zinc-500 uppercase mb-2 tracking-widest">Focus Vectors:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {result.revisionPlan.recommendedTopics.map((topic, i) => (
                                                <span key={i} className="px-3 py-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-black dark:text-white text-xs font-medium uppercase">
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Animate>
                        )}

                        <button
                            onClick={async () => {
                                await fetchData();
                                setView('list');
                                setActiveBattle(null);
                                setResult(null);
                                setSubmitting(false);
                            }}
                            className="mt-8 w-full px-8 py-4 bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-3"
                        >
                            <Swords size={18} />
                            Return to Hub
                        </button>

                        <p className="text-[10px] text-zinc-400 mt-4 flex items-center justify-center gap-1 uppercase tracking-widest">
                            <Clock size={10} />
                            Auto-redirecting
                        </p>
                    </Animate>
                </div>
            </div>
        );
    }

    // List View
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={36} className="animate-spin text-primary" />
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Loading Boss Battles...</p>
            </div>
        );
    }

    const passRate = history.length > 0
        ? Math.round((history.filter(b => b.status === 'completed').length / history.length) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-200 dark:scrollbar-track-gray-900">
            <div className="w-full space-y-8">

                {/* ── Header ── */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-3xl font-bold text-text-light dark:text-text-dark flex items-center gap-3">
                            <Swords size={28} className="text-primary" />
                            Boss Battle Arena
                        </h2>
                        <p className="text-base text-text-muted-light dark:text-text-muted-dark mt-1">
                            Challenge your weaknesses • Earn XP • Level up • Unlock badges
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-text-muted-light dark:text-text-muted-dark transition-colors"
                            title="Back to Home"
                        >
                            <Home size={20} />
                        </button>
                        <button
                            onClick={fetchData}
                            className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-text-muted-light dark:text-text-muted-dark transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>

                {/* ── Stats Bar ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                        { label: 'Active Battles',  value: battles.length,   icon: <Swords size={22} className="text-primary" /> },
                        { label: 'Total Battles',   value: history.length,   icon: <Trophy size={22} className="text-yellow-400" /> },
                        { label: 'Pass Rate',        value: `${passRate}%`,   icon: <TrendingUp size={22} className="text-emerald-400" /> },
                    ].map(({ label, value, icon }) => (
                        <div key={label} className="rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/40 p-5 flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                {icon}
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-text-light dark:text-text-dark">{value}</p>
                                <p className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide mt-0.5">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Active Battles ── */}
                <div className="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 bg-gray-100 dark:bg-gray-800 border-b border-border-light dark:border-border-dark">
                        <Zap size={16} className="text-primary" />
                        <span className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Active Challenges</span>
                        <span className="ml-auto text-sm font-bold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">{battles.length} available</span>
                    </div>

                    {battles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Swords size={52} className="text-text-muted-light dark:text-text-muted-dark mb-4 opacity-40" />
                            <p className="text-lg font-medium text-text-light dark:text-text-dark">Arena Clear</p>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">
                                New battles generated every <span className="font-semibold">4 hours</span>
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border-light dark:divide-border-dark">
                            {battles.map((battle) => (
                                <div
                                    key={battle.battleId}
                                    className="flex flex-col sm:flex-row sm:items-center gap-5 p-6 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                                    onClick={() => startBattle(battle)}
                                >
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                            <Swords size={18} className="text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-text-light dark:text-text-dark text-base truncate">
                                                {battle.bossName || formatTopicName(battle.targetWeakness, true)}
                                            </p>
                                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-0.5">
                                                Weakness: {formatTopicName(battle.targetWeakness, true)} • {battle.totalQuestions} questions • Expires {new Date(battle.expiresAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getDifficultyColor(battle.difficulty)}`}>
                                            {battle.difficulty.toUpperCase()}
                                        </span>
                                        <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                            <Star size={12} /> {battle.xpReward || (battle.difficulty === 'hard' ? 15 : (battle.difficulty === 'medium' ? 10 : 5))} XP
                                        </span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); startBattle(battle); }}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-80 transition-all"
                                        >
                                            <Swords size={15} /> Engage
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Battle History ── */}
                <div className="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 bg-gray-100 dark:bg-gray-800 border-b border-border-light dark:border-border-dark">
                        <Trophy size={16} className="text-yellow-400" />
                        <span className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Battle History</span>
                        <span className="ml-auto text-sm font-bold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">{history.length} records</span>
                    </div>

                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Trophy size={48} className="text-text-muted-light dark:text-text-muted-dark mb-4 opacity-40" />
                            <p className="text-lg text-text-light dark:text-text-dark">No battle records yet</p>
                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">Win your first battle to start your legacy</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-100 dark:bg-gray-800 border-b border-border-light dark:border-border-dark">
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Topic</th>
                                    <th className="text-center px-6 py-4 text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Score</th>
                                    <th className="text-center px-6 py-4 text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">XP</th>
                                    <th className="text-center px-6 py-4 text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Result</th>
                                    <th className="text-right px-6 py-4 text-sm font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                {history.map((battle) => (
                                    <tr key={battle.battleId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                                        <Swords size={15} className="text-primary" />
                                                    </div>
                                                    <span className="font-medium text-text-light dark:text-text-dark text-sm">{battle.bossName || formatTopicName(battle.targetWeakness, true)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-bold text-text-light dark:text-text-dark text-base">{battle.score}%</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {battle.earnedXP > 0 ? (
                                                <span className="text-sm font-semibold text-purple-400">+{battle.earnedXP}</span>
                                            ) : (
                                                <span className="text-sm text-text-muted-light dark:text-text-muted-dark">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {battle.status === 'completed' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                                    <CheckCircle size={11} /> Win
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                                                    <XCircle size={11} /> Lost
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-text-muted-light dark:text-text-muted-dark">
                                            {new Date(battle.completedAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Info Box ── */}
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-5 text-sm text-purple-300/90 space-y-2">
                    <p className="font-semibold flex items-center gap-2 text-base">
                        <Swords size={16} /> About Boss Battles
                    </p>
                    <p>Boss Battles are generated from your weakest topics. Defeat them to earn XP and unlock new badges. Higher difficulty grants larger rewards.</p>
                    <p className="opacity-70">New battles are generated every <strong>4 hours</strong>. You must score above the pass threshold to claim victory.</p>
                </div>

            </div>
        </div>
    );
};

export default BossBattles;
