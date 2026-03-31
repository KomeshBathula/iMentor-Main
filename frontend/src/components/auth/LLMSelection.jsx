// frontend/src/components/auth/LLMSelection.jsx
import React from 'react';
import { HardDrive, Cloud, Zap } from 'lucide-react';

function LLMSelection({ selectedLLM, onLlmChange, disabled = false }) {
    const llms = [
        { id: 'local_llm', name: 'Local LLM', description: 'Server-hosted · no key needed', Icon: HardDrive },
        { id: 'gemini',    name: 'Gemini',    description: 'Google Cloud AI · needs key',   Icon: Cloud },
        { id: 'groq',      name: 'Groq',      description: 'Ultra-fast cloud · needs key',  Icon: Zap },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {llms.map((llm) => {
                const isSelected = selectedLLM === llm.id;
                return (
                    <button
                        key={llm.id}
                        type="button"
                        onClick={() => onLlmChange(llm.id)}
                        disabled={disabled}
                        className={`
                            relative flex flex-col items-start gap-1.5 p-3 rounded-lg text-left
                            transition-all duration-150 ease-out
                            focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/60
                            ${isSelected
                                ? 'bg-neutral-800 border border-cyan-500/50 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
                                : 'bg-neutral-900/60 border border-neutral-700/50 hover:border-neutral-500/60 hover:bg-neutral-800/60'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                    >
                        {/* Active dot indicator */}
                        {isSelected && (
                            <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        )}

                        <div className="flex items-center gap-2">
                            <llm.Icon
                                size={14}
                                className={`transition-colors duration-150 ${isSelected ? 'text-cyan-400' : 'text-neutral-500'}`}
                            />
                            <span className={`text-xs font-semibold tracking-wide ${isSelected ? 'text-neutral-100' : 'text-neutral-300'}`}>
                                {llm.name}
                            </span>
                        </div>

                        <p className={`text-[10px] leading-snug ${isSelected ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            {llm.description}
                        </p>
                    </button>
                );
            })}
        </div>
    );
}

export default LLMSelection;