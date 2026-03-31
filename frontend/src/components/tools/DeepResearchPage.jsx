import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DeepResearchPanel from '../research/DeepResearchPanel';
import api from '../../services/api';
import toast from 'react-hot-toast';

function DeepResearchPage() {
    const navigate = useNavigate();

    const handleSearch = async (query) => {
        try {
            // Call the deep research tool via the agent/tools API
            const response = await api.runDeepResearch(query);
            return response;
        } catch (error) {
            console.error(error);
            toast.error("Research failed. See console.");
            throw error;
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark overflow-hidden pt-16">
            <div className="flex items-center gap-4 p-4 border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm z-10">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                    <ArrowLeft size={20} className="text-text-light dark:text-text-dark" />
                </button>
                <h1 className="text-xl font-bold text-text-light dark:text-text-dark">Deep Research Studio</h1>
            </div>

            <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    <DeepResearchPanel onSearch={handleSearch} />
                </div>
            </main>
        </div>
    );
}

export default DeepResearchPage;
