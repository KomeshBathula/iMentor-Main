// frontend/src/components/tools/ToolsModal.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Modal from '../core/Modal';
import { Code, TreePine } from 'lucide-react';

const availableTools = [
    {
        title: 'Secure Code Executor',
        description: 'Write, compile, and run code in a sandboxed environment with AI assistance.',
        icon: Code,
        path: '/tools/code-executor',
        status: 'active'
    },
    {
        title: 'Skill Tree Map',
        description: 'Visualize your learning progress as a skill tree. Unlock new skills as you master topics.',
        icon: TreePine,
        path: '/gamification/skill-tree',
        status: 'active',
        category: 'gamification'
    },
];

const ToolsModal = ({ isOpen, onClose, onEnableTutorMode }) => {
    const navigate = useNavigate();

    const handleNavigate = (path) => {
        if (path !== '#') {
            onClose();
            navigate(path);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Developer & Learning Tools" size="2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableTools.map((tool) => (
                    <div
                        key={tool.title}
                        onClick={() => handleNavigate(tool.path)}
                        className={`p-4 border rounded-2xl transition-all duration-150 group relative
                            ${tool.status === 'active'
                                ? 'cursor-pointer hover:border-primary dark:hover:border-primary-light hover:shadow-lg'
                                : 'opacity-50 cursor-not-allowed'
                            }
                            bg-surface-light dark:bg-gray-800 border-border-light dark:border-border-dark
                        `}
                    >
                        {tool.status === 'soon' && (
                            <span className="absolute top-2 right-2 text-xs bg-yellow-400/20 text-yellow-500 font-semibold px-2 py-0.5 rounded-full">
                                Coming Soon
                            </span>
                        )}
                        <div className="flex items-center mb-2">
                            <tool.icon size={22} className="mr-3 text-primary dark:text-primary-light" />
                            <h3 className="font-semibold text-text-light dark:text-text-dark group-hover:text-primary dark:group-hover:text-primary-light">
                                {tool.title}
                            </h3>
                        </div>
                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                            {tool.description}
                        </p>
                    </div>
                ))}
            </div>
        </Modal>
    );
};


export default ToolsModal;