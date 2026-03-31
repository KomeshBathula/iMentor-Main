import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, X, MessageSquare } from 'lucide-react';

/**
 * Detailed Feedback Modal
 * Implements Task 2.3.1: Granular feedback for Active Learning loops
 */
const DetailedFeedbackModal = ({ isOpen, onClose, onSubmit, isPositive }) => {
    const [rating, setRating] = useState({ accuracy: 5, clarity: 5, completeness: 5 });
    const [comments, setComments] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        onSubmit({
            overall: isPositive ? 'positive' : 'negative',
            metrics: rating,
            comments
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        {isPositive ? <ThumbsUp className="w-5 h-5 text-green-500" /> : <ThumbsDown className="w-5 h-5 text-red-500" />}
                        Help us improve this course model
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 space-y-5">
                    {['Accuracy', 'Clarity', 'Completeness'].map(metric => (
                        <div key={metric}>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-700 font-medium">{metric}</span>
                                <span className="text-gray-500">{rating[metric.toLowerCase()]} / 10</span>
                            </div>
                            <input
                                type="range" min="1" max="10"
                                value={rating[metric.toLowerCase()]}
                                onChange={(e) => setRating({ ...rating, [metric.toLowerCase()]: parseInt(e.target.value) })}
                                className="w-full accent-indigo-500"
                            />
                        </div>
                    ))}

                    <div>
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                            <MessageSquare className="w-4 h-4" /> What specifically should the model learn?
                        </label>
                        <textarea
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none resize-none"
                            rows="3"
                            placeholder="Provide the ideal answer or correct the mistake..."
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleSubmit}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                    >
                        Submit Feedback to Training Queue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DetailedFeedbackModal;
