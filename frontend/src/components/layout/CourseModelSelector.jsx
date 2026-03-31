import React, { useState } from 'react';
import { Server, Settings2 } from 'lucide-react';

/**
 * Course Model Selector Component
 * Implements Task 2.5.3: UI selector for switching active local SLMs
 */
const CourseModelSelector = ({ activeCourse, onModelSelect }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Mock available active course SLMs
    const availableModels = [
        { id: 'cs101', name: 'Computer Science 101', tag: 'imentor-cs101-qwen' },
        { id: 'phys301', name: 'Advanced Physics', tag: 'imentor-phys301-phi3' },
        { id: 'math200', name: 'Calculus II', tag: 'imentor-math200-mistral' }
    ];

    const currentModel = availableModels.find(m => m.id === activeCourse) || { name: 'General AI', tag: 'default-model' };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors border border-gray-300 shadow-sm"
            >
                <Server className="w-4 h-4 text-indigo-500" />
                <span className="truncate max-w-[150px]">{currentModel.name}</span>
                <Settings2 className="w-3.5 h-3.5 text-gray-500 ml-1" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
                        Active Local SLMs
                    </div>
                    <ul className="py-1">
                        <li
                            onClick={() => { onModelSelect(null); setIsOpen(false); }}
                            className={`px-4 py-2 text-sm hover:bg-indigo-50 cursor-pointer ${!activeCourse ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                        >
                            <div className="flex items-center justify-between">
                                <span>General AI</span>
                                {!activeCourse && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                            </div>
                        </li>

                        {availableModels.map(model => (
                            <li
                                key={model.id}
                                onClick={() => { onModelSelect(model.id); setIsOpen(false); }}
                                className={`px-4 py-2 hover:bg-indigo-50 cursor-pointer border-t border-gray-50 ${activeCourse === model.id ? 'bg-indigo-50' : ''}`}
                            >
                                <div className="flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-sm ${activeCourse === model.id ? 'text-indigo-700 font-medium' : 'text-gray-700 font-medium'}`}>
                                            {model.name}
                                        </span>
                                        {activeCourse === model.id && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                                    </div>
                                    <span className="text-xs text-gray-500 font-mono mt-0.5">{model.tag}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default CourseModelSelector;
