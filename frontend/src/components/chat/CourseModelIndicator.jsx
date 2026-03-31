// frontend/src/components/chat/CourseModelIndicator.jsx

import React from 'react';

const CourseModelIndicator = ({ currentModel, courseName }) => {
    return (
        <div className="flex items-center space-x-2 p-2 bg-blue-50 border border-blue-200 rounded-md mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
                Active SLM: {currentModel || 'General'}
            </span>
            <span className="text-xs text-blue-600 font-medium">
                ({courseName || 'Multi-subject'})
            </span>
        </div>
    );
};

export default CourseModelIndicator;
