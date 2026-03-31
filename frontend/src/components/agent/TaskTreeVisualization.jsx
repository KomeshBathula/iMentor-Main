import React from 'react';
import Animate from '../core/Animate.jsx';
import { ListTree, CheckCircle, Clock } from 'lucide-react';

/**
 * Task Tree Visualization Component
 * Implements Task 1.4.1 visualization for breaking down complex tasks
 */
const TaskTreeVisualization = ({ tasks }) => {
    if (!tasks || tasks.length === 0) return null;

    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 my-4 font-sans text-sm">
            <div className="flex items-center gap-2 mb-4 text-gray-700 font-semibold border-b pb-2">
                <ListTree className="w-5 h-5 text-indigo-500" />
                <h3>Agentic Task Plan</h3>
            </div>

            <div className="flex flex-col gap-3">
                {tasks.map((task, index) => {
                    const isCompleted = task.status === 'completed';
                    const isProcessing = task.status === 'processing';

                    return (
                        <Animate
                            key={task.id || index}
                            animation="slide-right"
                            delay={index * 100}
                            className={`flex items-start gap-3 p-3 rounded bg-white shadow-sm border-l-4 ${isCompleted ? 'border-green-400' : isProcessing ? 'border-blue-400' : 'border-gray-300'}`}
                        >
                            <div className="mt-0.5">
                                {isCompleted ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : isProcessing ? (
                                    <div className="animate-spin">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                    </div>
                                ) : (
                                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                                )}
                            </div>

                            <div className="flex-1">
                                <h4 className="font-medium text-gray-800">{task.name}</h4>
                                <p className="text-gray-500 text-xs mt-1">{task.description}</p>

                                {task.dependencies && task.dependencies.length > 0 && (
                                    <div className="mt-2 text-xs flex gap-1 items-center">
                                        <span className="text-gray-400">Depends on:</span>
                                        {task.dependencies.map(dep => (
                                            <span key={dep} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                                {dep}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TaskTreeVisualization;
