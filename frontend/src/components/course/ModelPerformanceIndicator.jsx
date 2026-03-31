import React from 'react';
import './ModelPerformanceIndicator.css';

const ModelPerformanceIndicator = ({ metrics }) => {
    if (!metrics) return null;

    return (
        <div className="perf-indicator">
            <div className="metric">
                <span className="label">Latency</span>
                <span className="value">{metrics.latency}ms</span>
            </div>
            <div className="divider"></div>
            <div className="metric">
                <span className="label">Tokens/s</span>
                <span className="value">{metrics.tokensPerSecond}</span>
            </div>
            <div className="divider"></div>
            <div className="metric">
                <span className="label">Context</span>
                <span className="value">{metrics.contextUsage}%</span>
            </div>
        </div>
    );
};

export default ModelPerformanceIndicator;
