// frontend/src/components/gamification/SessionChallengePane.jsx
import React, { useState } from 'react';
import { Brain, Send, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import Card from '../core/Card.jsx';
import Button from '../core/Button.jsx';
import api from '../../services/api';
import toast from 'react-hot-toast';

const SessionChallengePane = ({ bounty, onCompleted }) => {
    const [answers, setAnswers] = useState({}); // { questionIndex: "answer text" }
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    const questions = bounty.sessionQuestions || [];

    const handleAnswerChange = (index, value) => {
        setAnswers(prev => ({ ...prev, [index]: value }));
    };

    const handleSubmit = async () => {
        const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim()).length;

        if (answeredCount < questions.length) {
            if (!window.confirm(`You've only answered ${answeredCount} out of ${questions.length} questions. Submit anyway?`)) {
                return;
            }
        }

        setSubmitting(true);
        try {
            const data = await api.submitSessionChallenge(bounty._id, answers);
            setResult(data);
            toast.success("Assessment Submitted Successfully!");
            if (onCompleted) onCompleted(data);
        } catch (error) {
            console.error("Submission failed:", error);
            toast.error("Failed to submit assessment.");
        } finally {
            setSubmitting(false);
        }
    };

    if (result) {
        return (
            <Card className="border-l-4 border-green-500 bg-green-500/5 overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-500/20 rounded-lg text-green-600">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Assessment Complete</h3>
                            <p className="text-sm text-text-muted-light italic">Refining your learning profile...</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-white/50 dark:bg-black/20 rounded-xl border border-green-500/20">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold uppercase tracking-wider text-green-700">Overall Score</span>
                                <span className="text-3xl font-black text-green-600">{result.score}%</span>
                            </div>
                            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                {result.feedback}
                            </p>
                        </div>

                        <Button
                            variant="success"
                            fullWidth
                            onClick={onCompleted}
                            rightIcon={<ArrowRight size={18} />}
                        >
                            View New Insights
                        </Button>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="border-l-[3px] border-rose-500 shadow-xl overflow-hidden bg-white dark:bg-slate-900">
            <div className="bg-rose-500/5 px-3 py-2 border-b border-rose-500/10 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                    <Brain className="text-rose-600" size={14} />
                    <h3 className="font-bold text-rose-900 dark:text-rose-100 uppercase tracking-tight text-[11px]">Session Mastery Assessment</h3>
                </div>
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-500/10 rounded-full text-[9px] font-bold text-rose-600">
                    <Sparkles size={10} /> 150 XP
                </div>
            </div>

            <div className="px-3 py-2.5 space-y-2">
                <div className="mb-2 flex items-baseline justify-between">
                    <h2 className="text-sm font-black text-rose-950 dark:text-rose-50 truncate max-w-[70%]">{bounty.topic}</h2>
                    <p className="text-[10px] text-text-muted-light italic">Update your proficiency</p>
                </div>

                <div className="space-y-2.5">
                    {questions.map((q, idx) => (
                        <div key={idx} className="relative bg-slate-50/50 dark:bg-slate-800/20 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="flex items-start gap-2 mb-1.5">
                                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center font-black text-[9px] text-rose-600 select-none mt-0.5">
                                    {idx + 1}
                                </div>
                                <div className="space-y-0.5 flex-1 pr-14 relative">
                                    <h4 className="font-bold text-xs leading-tight text-slate-800 dark:text-slate-200">{q.questionText}</h4>
                                    <div className="absolute top-0 right-0">
                                        <span className="text-[8px] font-bold uppercase text-rose-600/70 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/10">
                                            {q.subTopic}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <textarea
                                className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-rose-500/30 focus:border-rose-500/40 focus:outline-none transition-all min-h-[40px] text-[11px] leading-snug resize-none"
                                placeholder="Short answer..."
                                value={answers[idx] || ''}
                                onChange={(e) => handleAnswerChange(idx, e.target.value)}
                                disabled={submitting}
                                rows={2}
                            />
                        </div>
                    ))}
                </div>

                <div className="pt-2 flex justify-end">
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        isLoading={submitting}
                        disabled={Object.keys(answers).length === 0}
                        className="w-full sm:w-auto px-6 py-1.5 text-xs shadow-md shadow-rose-500/20"
                        rightIcon={<Send size={12} />}
                    >
                        Submit
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default SessionChallengePane;
