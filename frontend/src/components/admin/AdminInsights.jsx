// frontend/src/components/admin/AdminInsights.jsx
import React from 'react';
import { Users, FileText, MessageSquare, KeyRound, AlertTriangle, UserCheck, GraduationCap, Activity, MessagesSquare, CalendarPlus } from 'lucide-react';

const InsightCard = ({ title, value, icon: Icon, colorClass = 'text-primary' }) => (
    <div className="card-base p-4 flex items-start gap-4">
        <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colorClass.replace('text-', 'bg-')}/10`}>
            <Icon size={20} className={colorClass} />
        </div>
        <div>
            <p className="text-sm font-medium text-text-muted-light dark:text-text-muted-dark">{title}</p>
            <p className="text-2xl font-bold text-text-light dark:text-text-dark">{value}</p>
        </div>
    </div>
);

function AdminInsights({ stats, isLoading, error }) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {Array(8).fill(0).map((_, i) => (
                    <div key={i} className="card-base p-4 h-24 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                ))}
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="mb-6 p-4 bg-red-500/10 text-red-600 dark:text-red-300 rounded-lg flex items-center gap-3">
                <AlertTriangle size={24} />
                <div>
                    <p className="font-semibold">Could not load dashboard insights.</p>
                    <p className="text-sm">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <InsightCard title="Total Students" value={stats.totalUsers ?? 'N/A'} icon={Users} colorClass="text-blue-500" />
            <InsightCard title="Active Today" value={stats.activeUsersToday ?? 'N/A'} icon={UserCheck} colorClass="text-emerald-500" />
            <InsightCard title="New Users (7d)" value={stats.newUsersLast7Days ?? 'N/A'} icon={CalendarPlus} colorClass="text-cyan-500" />
            <InsightCard title="Total Messages" value={stats.totalMessages ?? 'N/A'} icon={MessagesSquare} colorClass="text-indigo-500" />
            <InsightCard title="Active Sessions" value={stats.activeSessions ?? 'N/A'} icon={Activity} colorClass="text-violet-500" />
            <InsightCard title="Tutor Sessions" value={stats.tutorModeSessions ?? 'N/A'} icon={GraduationCap} colorClass="text-purple-500" />
            <InsightCard title="Admin Documents" value={stats.totalAdminDocs ?? 'N/A'} icon={FileText} colorClass="text-green-500" />
            <InsightCard title="Pending API Requests" value={stats.pendingApiKeys ?? 'N/A'} icon={KeyRound} colorClass="text-yellow-500" />
        </div>
    );
}

export default AdminInsights;