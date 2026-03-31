import React from 'react';
import { Activity, ShieldAlert, Cpu } from 'lucide-react';

/**
 * Model Performance Indicator
 * Implements Task 2.5.3: UI performance indicator
 */
const ModelPerformanceIndicator = ({ healthStatus = 'optimal', latencyMs = 120 }) => {
    // healthStatus: 'optimal', 'degraded', 'offline'

    const getStatusConfig = () => {
        switch (healthStatus) {
            case 'optimal':
                return { color: 'text-green-500', bg: 'bg-green-100', icon: Activity, text: 'Optimal' };
            case 'degraded':
                return { color: 'text-yellow-500', bg: 'bg-yellow-100', icon: Cpu, text: 'High Load' };
            case 'offline':
            default:
                return { color: 'text-red-500', bg: 'bg-red-100', icon: ShieldAlert, text: 'Offline' };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
        <div className="hidden md:flex items-center gap-3 px-3 py-1 bg-white border border-gray-200 rounded-full shadow-sm text-xs text-gray-600 font-medium">
            <div className={`p-1 rounded-full ${config.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
            </div>

            <div className="flex items-center gap-2 pr-1">
                <span>{config.text}</span>
                <span className="text-gray-300 font-light">|</span>
                <span className="font-mono text-gray-500">{latencyMs}ms</span>
            </div>
        </div>
    );
};

export default ModelPerformanceIndicator;
