// frontend/src/components/profile/FeedbackForm.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Send, Bug, Lightbulb, MessageSquare, Clock } from 'lucide-react';
import Button from '../core/Button.jsx';

const TYPE_OPTIONS = [
    { value: 'bug', label: 'Bug Report', Icon: Bug },
    { value: 'feature', label: 'Feature Request', Icon: Lightbulb },
    { value: 'general', label: 'General', Icon: MessageSquare },
];

const CATEGORY_OPTIONS = ['UI', 'Performance', 'Content', 'AI Quality', 'Other'];

const STATUS_COLORS = {
    open: 'text-yellow-500',
    acknowledged: 'text-blue-500',
    resolved: 'text-green-500',
    'wont-fix': 'text-gray-400',
};

const FeedbackForm = () => {
    const [type, setType] = useState('general');
    const [category, setCategory] = useState('Other');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await api.getUserFeedback();
                setHistory(data.feedback || []);
            } catch {
                // silently fail — history is non-critical
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (message.trim().length < 10) {
            toast.error('Feedback must be at least 10 characters.');
            return;
        }
        setIsSubmitting(true);
        try {
            await api.submitUserFeedback({ type, category, message: message.trim() });
            toast.success('Thank you for your feedback!');
            setMessage('');
            // Refresh history
            const data = await api.getUserFeedback();
            setHistory(data.feedback || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit feedback.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Submit form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type selector */}
                <div className="flex gap-2">
                    {TYPE_OPTIONS.map(({ value, label, Icon }) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setType(value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                type === value
                                    ? 'border-accent-light dark:border-accent-dark bg-accent-light/10 dark:bg-accent-dark/10 text-accent-light dark:text-accent-dark'
                                    : 'border-border-light dark:border-border-dark text-text-muted-light dark:text-text-muted-dark hover:border-accent-light dark:hover:border-accent-dark'
                            }`}
                        >
                            <Icon size={13} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Category */}
                <div>
                    <label className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Category</label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="input-field py-2 text-sm"
                    >
                        {CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                    </select>
                </div>

                {/* Message */}
                <div>
                    <label className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">
                        Message <span className="text-text-muted-light dark:text-text-muted-dark">(10–1000 chars)</span>
                    </label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Describe your feedback in detail…"
                        rows={4}
                        maxLength={1000}
                        className="input-field text-sm resize-none"
                        required
                    />
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark text-right mt-0.5">{message.length}/1000</p>
                </div>

                <Button type="submit" isLoading={isSubmitting} leftIcon={<Send size={14} />}>
                    Submit Feedback
                </Button>
            </form>

            {/* History */}
            <div>
                <h4 className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark border-t border-border-light dark:border-border-dark pt-4 mb-3 flex items-center gap-1.5">
                    <Clock size={13} /> Your Previous Feedback
                </h4>
                {loadingHistory ? (
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">Loading…</p>
                ) : history.length === 0 ? (
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark">No feedback submitted yet.</p>
                ) : (
                    <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {history.map((item) => (
                            <li key={item._id} className="text-xs bg-surface-secondary-light dark:bg-surface-secondary-dark rounded-lg p-3 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium capitalize">{item.type} · {item.category}</span>
                                    <span className={`capitalize font-medium ${STATUS_COLORS[item.status] || 'text-text-muted-light dark:text-text-muted-dark'}`}>
                                        {item.status}
                                    </span>
                                </div>
                                <p className="text-text-muted-light dark:text-text-muted-dark line-clamp-2">{item.message}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default FeedbackForm;
