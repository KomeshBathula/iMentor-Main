// frontend/src/components/chat/DetailedFeedbackModal.jsx

import React, { useState } from 'react';

const DetailedFeedbackModal = ({ isOpen, onClose, messageId, onSave }) => {
    const [reason, setReason] = useState('');
    const [correction, setCorrection] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                <h2 className="text-xl font-bold mb-4">Detailed Feedback</h2>
                <p className="text-sm text-gray-600 mb-4">Help us improve the response for message {messageId}</p>

                <label className="block text-sm font-medium mb-1">What was wrong?</label>
                <select
                    className="w-full border rounded p-2 mb-4"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                >
                    <option value="">Select a reason</option>
                    <option value="factually_incorrect">Factually Incorrect</option>
                    <option value="hallucination">Hallucination</option>
                    <option value="poor_pedagogy">Poor Pedagogical Approach</option>
                    <option value="tone_off">Tone doesn't match tutor role</option>
                </select>

                <label className="block text-sm font-medium mb-1">Corrected response (optional)</label>
                <textarea
                    className="w-full border rounded p-2 mb-4 h-24"
                    placeholder="Provide the ideal response..."
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                />

                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600">Cancel</button>
                    <button
                        onClick={() => onSave({ reason, correction })}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Submit Feedback
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DetailedFeedbackModal;
