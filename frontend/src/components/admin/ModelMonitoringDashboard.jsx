import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ModelMonitoringDashboard.css';

/**
 * Model Monitoring Dashboard Component
 * Displays real-time model performance metrics and drift alerts
 */
const ModelMonitoringDashboard = () => {
    const [monitoringData, setMonitoringData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedModel, setSelectedModel] = useState('all');
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchMonitoringData();

        // Refresh every 30 seconds
        const interval = setInterval(fetchMonitoringData, 30000);
        return () => clearInterval(interval);
    }, [selectedModel]);

    const fetchMonitoringData = async () => {
        try {
            setLoading(true);
            const endpoint = selectedModel === 'all'
                ? '/api/monitoring/all'
                : `/api/monitoring/model/${selectedModel}`;

            const response = await axios.get(endpoint);
            setMonitoringData(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching monitoring data:', err);
            setError('Failed to load monitoring data');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !monitoringData) {
        return (
            <div className="monitoring-dashboard loading">
                <div className="spinner"></div>
                <p>Loading monitoring data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="monitoring-dashboard error">
                <p>⚠️ {error}</p>
                <button onClick={fetchMonitoringData}>Retry</button>
            </div>
        );
    }

    const {
        status,
        currentMetrics = {},
        baselineMetrics = {},
        driftAnalysis = {},
        monitoredWindow
    } = monitoringData || {};

    const hasDrift = driftAnalysis?.hasDrift;
    const alerts = driftAnalysis?.alerts || [];

    return (
        <div className="monitoring-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <h2>📊 Model Monitoring</h2>
                <div className="header-actions">
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="model-selector"
                    >
                        <option value="all">All Models</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        <option value="qwen-1.5b">Qwen 1.5B</option>
                        <option value="phi-3-mini">Phi-3 Mini</option>
                    </select>
                    <button onClick={fetchMonitoringData} className="refresh-btn">
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Status Indicator */}
            <div className={`status-banner ${status}`}>
                <span className="status-icon">
                    {status === 'healthy' ? '✅' : status === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span className="status-text">
                    {status === 'healthy'
                        ? 'All systems operational'
                        : status === 'warning'
                            ? 'Performance degradation detected'
                            : 'Monitoring active'}
                </span>
                <span className="status-window">{monitoredWindow}</span>
            </div>

            {/* Drift Alerts */}
            {hasDrift && alerts.length > 0 && (
                <div className="alerts-section">
                    <h3>🚨 Drift Alerts</h3>
                    <div className="alerts-list">
                        {alerts.map((alert, index) => (
                            <div key={index} className={`alert-card ${alert.severity}`}>
                                <div className="alert-header">
                                    <span className="alert-metric">{alert.metric.replace(/_/g, ' ')}</span>
                                    <span className={`alert-badge ${alert.severity}`}>
                                        {alert.severity}
                                    </span>
                                </div>
                                <div className="alert-message">{alert.message}</div>
                                <div className="alert-values">
                                    <span>Current: {formatValue(alert.current, alert.metric)}</span>
                                    <span>Baseline: {formatValue(alert.baseline, alert.metric)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Metrics Grid */}
            <div className="metrics-grid">
                <MetricCard
                    title="Satisfaction Rate"
                    current={currentMetrics.satisfactionRate}
                    baseline={baselineMetrics?.satisfactionRate}
                    format="percent"
                    icon="😊"
                />
                <MetricCard
                    title="Avg Latency"
                    current={currentMetrics.avgLatency}
                    baseline={baselineMetrics?.avgLatency}
                    format="ms"
                    icon="⚡"
                />
                <MetricCard
                    title="Error Rate"
                    current={currentMetrics.errorRate}
                    baseline={baselineMetrics?.errorRate}
                    format="percent"
                    icon="🐛"
                    invertColors={true}
                />
                <MetricCard
                    title="Total Requests"
                    current={currentMetrics.totalRequests}
                    format="number"
                    icon="📈"
                />
            </div>

            {/* Feedback Breakdown */}
            {currentMetrics.positiveFeedback !== undefined && (
                <div className="feedback-section">
                    <h3>User Feedback Breakdown</h3>
                    <div className="feedback-chart">
                        <div className="feedback-bar">
                            <div
                                className="feedback-positive"
                                style={{
                                    width: `${(currentMetrics.positiveFeedback / (currentMetrics.positiveFeedback + currentMetrics.negativeFeedback)) * 100}%`
                                }}
                            >
                                👍 {currentMetrics.positiveFeedback}
                            </div>
                            <div className="feedback-negative">
                                👎 {currentMetrics.negativeFeedback}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Individual Metric Card Component
 */
const MetricCard = ({ title, current, baseline, format, icon, invertColors = false }) => {
    const formatValue = (value, fmt) => {
        if (value === null || value === undefined) return 'N/A';

        switch (fmt) {
            case 'percent':
                return `${(value * 100).toFixed(1)}%`;
            case 'ms':
                return `${value.toFixed(0)}ms`;
            case 'number':
                return value.toLocaleString();
            default:
                return value.toString();
        }
    };

    const getChangeColor = (current, baseline, invert) => {
        if (!baseline) return 'neutral';
        const change = ((current - baseline) / baseline) * 100;

        if (invert) {
            return change > 0 ? 'bad' : change < 0 ? 'good' : 'neutral';
        } else {
            return change > 0 ? 'good' : change < 0 ? 'bad' : 'neutral';
        }
    };

    const changeColor = baseline ? getChangeColor(current, baseline, invertColors) : 'neutral';
    const changePercent = baseline ? (((current - baseline) / baseline) * 100).toFixed(1) : null;

    return (
        <div className="metric-card">
            <div className="metric-icon">{icon}</div>
            <div className="metric-info">
                <div className="metric-title">{title}</div>
                <div className="metric-value">{formatValue(current, format)}</div>
                {changePercent !== null && (
                    <div className={`metric-change ${changeColor}`}>
                        {changePercent > 0 ? '▲' : '▼'} {Math.abs(changePercent)}%
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper function
const formatValue = (value, metric) => {
    if (value === null || value === undefined) return 'N/A';

    if (metric.includes('rate')) {
        return `${(value * 100).toFixed(1)}%`;
    } else if (metric.includes('latency')) {
        return `${value.toFixed(0)}ms`;
    } else {
        return value.toString();
    }
};

export default ModelMonitoringDashboard;
