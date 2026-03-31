import React from 'react';
import './CourseModelSelector.css';

const CourseModelSelector = ({ activeCourse, availableModels, onSelect }) => {
    return (
        <div className="course-model-selector">
            <div className="selector-header">
                <span className="course-slug">{activeCourse} High-Performance Cluster</span>
            </div>
            <div className="model-grid">
                {availableModels.map((model) => (
                    <div
                        key={model.modelId}
                        className={`model-card ${model.isActive ? 'active' : ''}`}
                        onClick={() => onSelect(model.modelId)}
                    >
                        <div className="model-info">
                            <span className="model-name">{model.displayName}</span>
                            <span className="model-stats">{model.quantization} | {model.memory} RAM</span>
                        </div>
                        <div className={`health-dot ${model.status}`}></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CourseModelSelector;
