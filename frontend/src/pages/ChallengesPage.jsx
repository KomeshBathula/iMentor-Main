// frontend/src/pages/ChallengesPage.jsx
// Gamification: challenges and leaderboard implemented

import React, { useState, useEffect } from 'react';
import { Trophy, ArrowRight, ArrowLeft, Brain, Link as LinkIcon, CheckCircle2, Sparkles } from 'lucide-react';
import api from '../services/api';
import Button from '../components/core/Button.jsx';
import Card from '../components/core/Card.jsx';
import Badge from '../components/core/Badge.jsx';

import { useNavigate } from 'react-router-dom';
import QuizModal from '../components/gamification/QuizModal.jsx';
import MasteryReport from '../components/gamification/MasteryReport.jsx';
import SessionChallengePane from '../components/gamification/SessionChallengePane.jsx';
import toast from 'react-hot-toast';

const ChallengesPage = () => {
    const [bounties, setBounties] = useState([]);
    const [reports, setReports] = useState([]);
    const [userScore, setUserScore] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Quiz State
    const [selectedQuizBounty, setSelectedQuizBounty] = useState(null);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [forceShowReport, setForceShowReport] = useState(false); // Debug/Demo toggle

    // Local state for inline answers
    const [answerInputs, setAnswerInputs] = useState({}); // { bountyId: "answer text" }
    const [submittingIds, setSubmittingIds] = useState(new Set()); // Set of bountyIds currently submitting
    const [submissionResults, setSubmissionResults] = useState({}); // { bountyId: { score, feedback, solved } }
    const [expandedBounties, setExpandedBounties] = useState(new Set()); // Set of bountyIds with expanded input

    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [bountyData, reportData, scoreData] = await Promise.all([
                api.getBounties().catch(e => { console.error("Bounties fetch error:", e); return []; }),
                api.getReports().catch(e => { console.error("Reports fetch error:", e); return []; }),
                api.getUserScore().catch(e => { console.error("Score fetch error:", e); return null; })
            ]);

            setBounties(bountyData || []);
            setReports(reportData || []);
            console.log("[ChallengesPage] Fetched scoreData:", scoreData);
            setUserScore(scoreData);
        } catch (err) {
            console.error("Failed to fetch data:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (bountyId) => {
        setExpandedBounties(prev => {
            const next = new Set(prev);
            if (next.has(bountyId)) next.delete(bountyId);
            else next.add(bountyId);
            return next;
        });
    };

    const handleInputChange = (bountyId, text) => {
        setAnswerInputs(prev => ({ ...prev, [bountyId]: text }));
    };

    const handleSubmitAnswer = async (bountyId) => {
        const answer = answerInputs[bountyId];
        if (!answer || !answer.trim()) return;

        setSubmittingIds(prev => new Set(prev).add(bountyId));
        try {
            const result = await api.submitChallengeAnswer(bountyId, answer);

            // Save local result to show immediately
            setSubmissionResults(prev => ({ ...prev, [bountyId]: result }));

            // If it was an aggregated report trigger (last question of session)
            if (result.isAggregatedReport) {
                toast.success("Session Completed! Master Assessment Report Generated.");
                // Fetch new reports to update the side panel
                fetchData();
            } else if (result.solved) {
                toast.success(`Correct! Score: ${result.score}`);
                // Refresh to update XP/Credits
                fetchData();
            } else {
                toast("Submitted. Check feedback.", { icon: '📝' });
            }
        } finally {
            setSubmittingIds(prev => {
                const next = new Set(prev);
                next.delete(bountyId);
                return next;
            });
        }
    };

    const handleAttempt = (bounty) => {
        if (bounty.type === 'Quiz') {
            setSelectedQuizBounty(bounty);
            setIsQuizModalOpen(true);
        } else {
            // Toggle inline input mode
            toggleExpand(bounty._id);
        }
    };

    const handleGenerateQuiz = async () => {
        const topic = prompt("Enter a topic for the quiz (e.g., 'React Hooks', 'Machine Learning'):");
        if (!topic) return;

        setIsGenerating(true);
        const toastId = toast.loading(`Generating quiz for "${topic}"...`);
        try {
            const newBounty = await api.generateQuizChallenge(topic);
            if (newBounty) {
                setBounties([newBounty, ...bounties]);
                toast.success("Quiz generated! Click 'Attempt Challenge' to start.", { id: toastId });
            }
        } catch (error) {
            console.error("Quiz generation failed:", error);
            toast.error("Failed to generate quiz.", { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleQuizCompleted = (result) => {
        fetchData();
    };

    const handleLearnTopic = (topic) => {
        const query = `I want to improve my understanding of "${topic}". Can you help me learn it?`;
        navigate('/', { state: { challengeQuery: query } });
    };

    if (loading) {
        return (
            <div className="container mx-auto p-8 pt-24 text-center">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
                <p className="text-text-muted-light dark:text-text-muted-dark">Loading your personalized challenges...</p>
            </div>
        );
    }

    // Determine if we should show the Mastery Report (No active bounties + existing reports OR forced)
    const showMasteryReport = forceShowReport || (bounties.length === 0 && reports.length > 0);

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark pt-20 pb-12 overflow-y-auto">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-6 mb-8 border-b border-rose-500/20 pb-6">
                    <button
                        onClick={() => navigate('/')}
                        className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors rounded-full"
                        title="Back to Main"
                    >
                        <ArrowLeft size={24} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-rose-500/10 rounded-xl">
                            <Trophy className="text-rose-600 dark:text-rose-400" size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Personalized Challenges</h1>
                            <p className="text-text-muted-light dark:text-text-muted-dark">Tailored questions based on your recent learning sessions</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mb-6 items-center">
                    <button
                        onClick={() => setForceShowReport(!forceShowReport)}
                        className="mr-3 px-3 py-2 text-xs font-mono text-primary/50 hover:text-primary transition-colors border border-primary/20 rounded-lg"
                        title="Toggle Report View (Demo)"
                    >
                        {forceShowReport ? "Show Active Challenges" : "Preview Mastery Report"}
                    </button>

                    <Button
                        onClick={handleGenerateQuiz}
                        disabled={isGenerating}
                        rightIcon={isGenerating ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Sparkles size={16} />}
                    >
                        Generate New Quiz
                    </Button>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 text-sm">
                        <strong>Error:</strong> {error}. Some features might be unavailable.
                        <button onClick={fetchData} className="ml-2 underline font-bold">Retry</button>
                    </div>
                )}

                {userScore && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                        <Card className="p-4 bg-primary/5 border-primary/10">
                            <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Current Level</div>
                            <div className="text-2xl font-black">{userScore.level}</div>
                        </Card>
                        <Card className="p-4 bg-amber-500/5 border-amber-500/10">
                            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Total XP</div>
                            <div className="text-2xl font-black">{userScore.totalXP}</div>
                        </Card>
                        <Card className="p-4 bg-rose-500/5 border-rose-500/10">
                            <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1">Testing Credits</div>
                            <div className="text-2xl font-black">{Math.round(userScore.testingCredits || 0)}</div>
                        </Card>
                        <Card className="p-4 bg-indigo-500/5 border-indigo-500/10">
                            <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Assessments</div>
                            <div className="text-2xl font-black">{userScore.completedAssessments || 0}</div>
                        </Card>
                    </div>
                )}

                {showMasteryReport ? (
                    <MasteryReport reports={reports} />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Active Bounties / Personalized Questions */}
                        <section>
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Brain size={20} className="text-primary" />
                                Active Questions
                            </h2>
                            <div className="space-y-4">
                                {bounties.length > 0 ? (
                                    bounties.map((bounty) => {
                                        // Specific handling for the new SessionChallenge type
                                        if (bounty.type === 'SessionChallenge') {
                                            return (
                                                <SessionChallengePane
                                                    key={bounty._id}
                                                    bounty={bounty}
                                                    onCompleted={() => {
                                                        // Refresh data to update reports and remove this pane from active list
                                                        fetchData();
                                                    }}
                                                />
                                            );
                                        }

                                        const isExpanded = expandedBounties.has(bounty._id);
                                        const isSubmitting = submittingIds.has(bounty._id);
                                        const result = submissionResults[bounty._id];
                                        const isQuiz = bounty.type === 'Quiz';

                                        return (
                                            <Card key={bounty._id} className="border-l-4 border-rose-500 shadow-md transition-all duration-300">
                                                <div className="p-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <Badge variant="secondary" className="text-[10px]">{bounty.topic}</Badge>
                                                        <Badge variant="outline" className="text-[10px] uppercase">{bounty.difficulty || 'Medium'}</Badge>
                                                    </div>
                                                    <p className="text-lg font-medium mb-3">{bounty.question || `${bounty.topic} Quiz`}</p>
                                                    <div className="flex items-center gap-2 text-xs text-text-muted-light mb-4 italic">
                                                        <Sparkles size={12} className="text-amber-500" />
                                                        {bounty.context || "Generated specifically for your proficiency level."}
                                                    </div>

                                                    {/* Pre-Answer / Default View */}
                                                    {!result && !isQuiz && !bounty.isSolved && (
                                                        <div className="space-y-3">
                                                            {isExpanded && (
                                                                <textarea
                                                                    className="w-full p-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark focus:ring-2 focus:ring-primary focus:outline-none resize-y min-h-[100px]"
                                                                    placeholder="Type your answer here..."
                                                                    value={answerInputs[bounty._id] || ''}
                                                                    onChange={(e) => handleInputChange(bounty._id, e.target.value)}
                                                                    disabled={isSubmitting}
                                                                />
                                                            )}
                                                            <div className="flex justify-end gap-2">
                                                                {isExpanded && (
                                                                    <Button
                                                                        variant="primary"
                                                                        size="sm"
                                                                        onClick={() => handleSubmitAnswer(bounty._id)}
                                                                        isLoading={isSubmitting}
                                                                        disabled={!answerInputs[bounty._id]?.trim()}
                                                                    >
                                                                        Submit Answer
                                                                    </Button>
                                                                )}
                                                                {!isExpanded && (
                                                                    <Button
                                                                        variant="primary"
                                                                        size="sm"
                                                                        fullWidth
                                                                        rightIcon={<ArrowRight size={16} />}
                                                                        onClick={() => handleAttempt(bounty)}
                                                                    >
                                                                        Attempt Challenge
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Button for Quiz Type */}
                                                    {isQuiz && !result && !bounty.isSolved && (
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            fullWidth
                                                            rightIcon={<ArrowRight size={16} />}
                                                            onClick={() => handleAttempt(bounty)}
                                                        >
                                                            Start Quiz
                                                        </Button>
                                                    )}

                                                    {/* Post-Submit Result View */}
                                                    {(result || bounty.isSolved) && (
                                                        <div className={`mt-4 p-3 rounded-lg border ${result?.solved || bounty.isSolved ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className={`font-bold ${result?.solved || bounty.isSolved ? 'text-green-600' : 'text-amber-600'}`}>
                                                                    {result?.solved || bounty.isSolved ? 'Solved!' : 'Feedback'}
                                                                </span>
                                                                {result && <span className="font-mono font-bold text-sm">Score: {result.score}/100</span>}
                                                            </div>
                                                            <p className="text-sm text-text-muted-light dark:text-text-muted-dark leading-snug">
                                                                {result?.feedback || "Challenge completed."}
                                                            </p>
                                                            {result && result.isAggregatedReport && (
                                                                <div className="mt-2 text-xs font-bold text-primary flex items-center gap-1">
                                                                    <CheckCircle2 size={12} /> Master Report Generated
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        );
                                    })
                                ) : (
                                    <div className="p-12 text-center bg-surface-light dark:bg-surface-dark rounded-xl border border-dashed border-border-light dark:border-border-dark">
                                        <p className="text-text-muted-light">No active challenges. Chat with the Tutor to generate new ones!</p>
                                    </div>
                                )}

                                {/* FINISH BUTTON SECTION */}
                                {bounties.length > 0 && bounties.every(b => b.isSolved || submissionResults[b._id]?.solved) && (
                                    <div className="mt-8 flex justify-center">
                                        <Button
                                            variant="success"
                                            size="lg"
                                            rightIcon={<Trophy size={20} />}
                                            onClick={() => {
                                                toast.success("Great job! Assessment completed.");
                                                // Scroll to reports or refresh
                                                fetchData();
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="animate-pulse shadow-xl shadow-green-500/20"
                                        >
                                            Finish Assessment
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Improvement Reports */}
                        <section>
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <CheckCircle2 size={20} className="text-green-500" />
                                Assessment Insights
                            </h2>
                            <div className="space-y-6">
                                {reports.length > 0 ? (
                                    reports.map((report) => (
                                        <Card key={report._id} className="overflow-hidden">
                                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                                                <h3 className="font-bold">{report.topic}</h3>
                                                <div className="text-2xl font-black text-primary">{report.score}%</div>
                                            </div>
                                            <div className="p-4 space-y-4">
                                                {report.strengths?.length > 0 && (
                                                    <div>
                                                        <h4 className="text-xs font-bold uppercase text-green-600 dark:text-green-400 mb-2">Strengths</h4>
                                                        <div className="space-y-2">
                                                            {report.strengths.map((s, idx) => (
                                                                <div key={idx} className="p-2 bg-green-500/5 rounded-lg border border-green-500/10">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Badge variant="success" className="bg-green-500/10 text-green-700 dark:text-green-300 border-none text-[10px]">{s.topic || s}</Badge>
                                                                    </div>
                                                                    {s.reason && <p className="text-xs text-text-muted-light dark:text-text-muted-dark leading-tight">{s.reason}</p>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {(report.improvementsNeeded?.length > 0 || report.weaknesses?.length > 0) && (
                                                    <div>
                                                        <h4 className="text-xs font-bold uppercase text-rose-600 dark:text-rose-400 mb-2">Needed to improve</h4>
                                                        <div className="space-y-3">
                                                            {(report.improvementsNeeded || report.weaknesses).map((item, idx) => {
                                                                // Schema mismatch fix: TestResult uses 'subTopic', older ones might use 'area' or string
                                                                const topic = typeof item === 'string' ? item : (item.subTopic || item.area || item.topic);
                                                                const recommendation = typeof item === 'string' ? null : item.recommendation;
                                                                const reason = typeof item === 'string' ? null : item.reason;

                                                                return (
                                                                    <div
                                                                        key={idx}
                                                                        className="group cursor-pointer p-3 bg-rose-500/5 rounded-lg border border-rose-500/10 hover:bg-rose-500/10 transition-all"
                                                                        onClick={() => handleLearnTopic(topic)}
                                                                    >
                                                                        <div className="flex items-center justify-between mb-1.5">
                                                                            <span className="text-sm font-bold text-rose-700 dark:text-rose-400">{topic}</span>
                                                                            <div className="flex items-center gap-1 text-[10px] text-rose-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                LEARN THIS <LinkIcon size={12} />
                                                                            </div>
                                                                        </div>
                                                                        {reason && <p className="text-[11px] text-text-muted-light dark:text-text-muted-dark mb-1 leading-snug">{reason}</p>}
                                                                        {recommendation && (
                                                                            <div className="text-[10px] font-semibold text-rose-600/80 italic">
                                                                                Next: {recommendation}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="p-12 text-center bg-surface-light dark:bg-surface-dark rounded-xl border border-dashed border-border-light dark:border-border-dark">
                                        <p className="text-text-muted-light">Complete chat sessions to receive assessment reports and personalized feedback.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </div>

            <QuizModal
                isOpen={isQuizModalOpen}
                onClose={() => setIsQuizModalOpen(false)}
                bounty={selectedQuizBounty}
                onQuizCompleted={handleQuizCompleted}
            />
        </div>
    );
};

export default ChallengesPage;
