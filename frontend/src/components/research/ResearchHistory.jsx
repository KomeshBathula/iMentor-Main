import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useDeepResearch } from '../../contexts/DeepResearchContext';
import { Clock, FileText, ChevronRight, History, PlayCircle, Star, Database, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';

const ResearchHistory = () => {
    const { setIsResearchMode, restoreFromHistory } = useDeepResearch();
    const navigate = useNavigate();
    const location = useLocation();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const data = await api.getResearchHistory();
            setHistory(data);
        } catch (error) {
            console.error("Failed to load history:", error);
            toast.error("Failed to load research library.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (item) => {
        // Navigate directly to the dedicated detail view page for the research document
        navigate(`/tools/deep-research/view/${item._id}`);
    };

    const handleBack = () => {
        setIsResearchMode(false);
        // If we are deep inside the research sections, return to deep-research landing
        if (location.pathname.includes('/history') || location.pathname.includes('/view/')) {
            navigate('/tools/deep-research');
        } else {
            // Otherwise, close the panel and return to the main dashboard
            navigate('/');
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0B0B0B] border-l border-[#2A2A2A]">
            {/* Header */}
            <div className="px-6 py-4 flex flex-col gap-4 border-b border-[#1A1A1A]">
                <button 
                    onClick={handleBack}
                    className="flex items-center text-[11px] text-[#666666] hover:text-[#FFFFFF] transition-colors uppercase tracking-widest font-semibold"
                >
                    <ArrowLeft className="w-3 h-3 mr-1.5" /> Back to Workspace
                </button>
                <h2 className="text-[13px] font-semibold text-[#FFFFFF] tracking-wide flex items-center">
                    <History className="w-4 h-4 mr-2 text-[#B3B3B3]" />
                    Research Archive
                </h2>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading ? (
                    <div className="px-6 py-8 text-[13px] text-[#B3B3B3]">
                        Loading archives...
                    </div>
                ) : history.length === 0 ? (
                    <div className="px-6 py-8 text-[13px] text-[#B3B3B3]">
                        No archives found.
                    </div>
                ) : (
                    <ul className="divide-y divide-[#1A1A1A]">
                        {history.map((item) => (
                            <li
                                key={item._id}
                                onClick={() => handleRestore(item)}
                                className="group px-6 py-4 hover:bg-[#121212] transition-colors text-left cursor-pointer flex flex-col gap-1.5 relative"
                            >
                                <h3 className="text-[14px] font-medium text-[#FFFFFF] leading-snug line-clamp-2 pr-6">
                                    {item.title || item.query}
                                </h3>
                                
                                <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#B3B3B3] mt-1">
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                    <span>•</span>
                                    <span>{item.onlineSourceCount + item.localSourceCount} Sources</span>
                                    
                                    {item.overallConfidenceScore >= 80 && (
                                        <>
                                            <span>•</span>
                                            <span className="text-[#FFFFFF] flex items-center gap-1 font-medium bg-[#1A1A1A] px-1.5 rounded-sm">
                                                <Star className="w-3 h-3 fill-current" /> High Consensus
                                            </span>
                                        </>
                                    )}
                                </div>
                                
                                {/* Hover Play Icon */}
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[11px] text-[#00D1FF] flex items-center gap-1 font-medium">
                                        <PlayCircle className="w-4 h-4" /> Open
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default ResearchHistory;
