import React, { useState, useEffect } from 'react';
import { Database, Server, Clock, Activity, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import * as adminApi from '../../services/adminApi.js';
import toast from 'react-hot-toast';

/**
 * Course Model Dashboard
 * Implements Task 2.1.3: Create model performance dashboards per course
 */
const CourseModelDashboard = () => {
    const [models, setModels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchModels = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await adminApi.getCourseModels();
            setModels(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('[CourseModelDashboard] Error fetching models:', err);
            setError(err.message || 'Failed to load course models.');
            toast.error('Could not load course models.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchModels();
    }, []);

    if (isLoading) {
        return (
            <div className="p-12 flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Loading model registry...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-12 flex flex-col items-center justify-center bg-white rounded-xl border border-red-200">
                <AlertTriangle className="w-8 h-8 text-red-500 mb-4" />
                <p className="text-red-600 font-medium mb-4">{error}</p>
                <button
                    onClick={fetchModels}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" /> Retry
                </button>
            </div>
        );
    }

    const handleSync = async () => {
        const loadingToast = toast.loading('Synchronizing with local Ollama node...');
        try {
            const results = await adminApi.syncCourseModels();
            toast.success(`Sync complete! Added ${results.added}, updated ${results.updated}.`, { id: loadingToast });
            fetchModels();
        } catch (err) {
            console.error('[CourseModelDashboard] Sync error:', err);
            toast.error(`Sync failed: ${err.message}`, { id: loadingToast });
        }
    };

    return (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                    <Database className="w-6 h-6 text-indigo-600" />
                    <h2 className="text-xl font-bold text-gray-800">Course SLM Registry</h2>
                </div>
                <button
                    onClick={fetchModels}
                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                    title="Refresh Registry"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {models.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl mb-6">
                    <p className="text-gray-400">No course-specific models registered yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {models.map(model => (
                        <div key={model._id || model.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-gray-50/30">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-gray-800 truncate pr-2" title={model.courseName}>{model.courseName}</h3>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${model.modelStatus === 'active' ? 'bg-green-100 text-green-700' :
                                        model.modelStatus === 'training' ? 'bg-blue-100 text-blue-700' :
                                            model.modelStatus === 'failed' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-600'
                                    }`}>
                                    {model.modelStatus}
                                </span>
                            </div>

                            <div className="text-sm font-mono text-gray-400 mb-4 truncate flex items-center" title={model.ollamaTag}>
                                <Server className="w-3 h-3 mr-1 flex-shrink-0" />
                                <span>{model.ollamaTag}</span>
                            </div>

                            <div className="flex justify-between text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="font-medium text-gray-700">
                                        {model.metrics?.accuracy ? `${model.metrics.accuracy}%` : '--'}
                                    </span>
                                    <span>Acc.</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                                    <span className="font-medium text-gray-700">
                                        {model.lastTrainedAt ? new Date(model.lastTrainedAt).toLocaleDateString() : 'New'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <button
                onClick={handleSync}
                className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 border border-dashed border-indigo-200 rounded-lg font-medium text-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
                <Database className="w-4 h-4" /> Synchronize Context with Local Node
            </button>
        </div>
    );
};

export default CourseModelDashboard;
