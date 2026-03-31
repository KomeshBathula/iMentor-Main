import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ShieldCheck, TrendingUp, Zap } from 'lucide-react';

/**
 * Model Evaluation Dashboard
 * Implements Task 2.4.1: Model Evaluation Dashboard visualization
 */
const ModelEvaluationDashboard = () => {
    // Structural mock data representing regression tracking across epochs
    const regressionData = [
        { epoch: 'Initial Base', accuracy: 65, latency: 120 },
        { epoch: 'LoRA v1', accuracy: 82, latency: 125 },
        { epoch: 'LoRA v2', accuracy: 89, latency: 128 },
        { epoch: 'LoRA v3 (Current)', accuracy: 94.5, latency: 130 }
    ];

    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 mt-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-800">SLM Regression Metrics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="text-sm text-gray-500 flex justify-between">
                        <span>Current Accuracy (Holdout)</span>
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-2xl font-bold mt-1 text-gray-800">94.5%</div>
                    <div className="text-xs text-green-600 mt-2">↑ 5.5% vs previous check</div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="text-sm text-gray-500 flex justify-between">
                        <span>Avg. Latency (GGUF CPU)</span>
                        <Zap className="w-4 h-4 text-yellow-500" />
                    </div>
                    <div className="text-2xl font-bold mt-1 text-gray-800">130ms</div>
                    <div className="text-xs text-red-500 mt-2">↓ 2ms slower vs previous</div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border">
                    <div className="text-sm text-gray-500 flex justify-between">
                        <span>User Satisfaction</span>
                        <span className="text-xl">⭐️</span>
                    </div>
                    <div className="text-2xl font-bold mt-1 text-gray-800">4.8 / 5</div>
                    <div className="text-xs text-gray-500 mt-2">Based on 1,204 ratings</div>
                </div>
            </div>

            <div className="h-72 w-full mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Training History Progression</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={regressionData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="epoch" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" domain={[50, 100]} tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" domain={[100, 200]} tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line yAxisId="left" type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line yAxisId="right" type="monotone" dataKey="latency" name="Latency (ms)" stroke="#F59E0B" strokeWidth={3} dot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ModelEvaluationDashboard;
