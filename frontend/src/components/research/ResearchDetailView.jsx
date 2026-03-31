import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Clock, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import ResearchReport from './ResearchReport';

const ResearchDetailView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [researchData, setResearchData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const data = await api.getResearchDetail(id);
                setResearchData(data);
            } catch (error) {
                console.error("Fetch detail failed:", error);
                toast.error("Research report not found.");
            } finally {
                setIsLoading(false);
            }
        };

        if (id) fetchReport();
    }, [id]);

    const handleDownloadPDF = async () => {
        try {
            toast.loading("Generating academic PDF...", { id: 'pdf-toast' });

            const blobData = await api.exportResearchPDF(id);
            console.log("[PDF Export] Blob data received size:", blobData.size);

            if (blobData.type === 'application/json') {
                const text = await blobData.text();
                const errorData = JSON.parse(text);
                throw new Error(errorData.message || "Server error.");
            }

            // Explicitly wrap in a new Blob with the correct PDF mime type
            const pdfBlob = new Blob([blobData], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(pdfBlob);

            const link = document.createElement('a');
            link.href = url;
            const fileName = `Research_${researchData?.title || 'Report'}`.replace(/[^a-z0-9]/gi, '_');
            link.setAttribute('download', `${fileName}.pdf`);
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 200);

            toast.success("PDF Downloaded!", { id: 'pdf-toast' });
        } catch (error) {
            console.error("PDF download failed:", error);
            toast.error("Failed to generate PDF.", { id: 'pdf-toast' });
        }
    };

    if (isLoading) {
        return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-gray-500 italic">Retrieved scholarly data...</div>;
    }

    if (!researchData) {
        return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-gray-500">Report not found in archives.</div>;
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-gray-200 font-sans flex flex-col">

            <header className="h-16 border-b border-[#1F1F1F] bg-[#0A0A0A]/95 backdrop-blur sticky top-0 z-50 px-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/tools/deep-research/history')}
                        className="p-2 hover:bg-[#1F1F1F] rounded-full text-gray-400 hover:text-white transition-colors"
                        title="Back to Library"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-gray-200 uppercase tracking-wide truncate max-w-md">
                            {researchData.title || researchData.query}
                        </h1>
                        <div className="text-xs text-gray-500 flex items-center mt-0.5">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(researchData.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-gray-200 transition-colors shadow-lg"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-[#0A0A0A] p-6 lg:p-12 relative scrollbar-thin scrollbar-thumb-gray-800">
                <div className="max-w-4xl mx-auto pb-20">
                    <ResearchReport researchReport={researchData.researchReport} />
                </div>
            </main>

        </div>
    );
};

export default ResearchDetailView;
