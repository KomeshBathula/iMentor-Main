// frontend/src/components/admin/UserFeedbackManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import * as adminApi from '../../services/adminApi.js';
import { format } from 'date-fns';
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Loader2, AlertCircle, Bug, Lightbulb, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_ICON = { bug: Bug, feature: Lightbulb, general: MessageSquare };
const TYPE_COLOR = { bug: 'text-red-400', feature: 'text-blue-400', general: 'text-neutral-400' };

const STATUS_OPTIONS = ['open', 'acknowledged', 'resolved', 'wont-fix'];
const STATUS_COLOR = {
    open: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    acknowledged: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    'wont-fix': 'bg-neutral-600/30 text-neutral-400 border-neutral-500/30',
};

function SortHeader({ label, field, sortBy, order, onSort }) {
    const active = sortBy === field;
    return (
        <th
            className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 cursor-pointer select-none hover:text-cyan-300 transition-colors"
            onClick={() => onSort(field)}
        >
            <span className="flex items-center gap-1">
                {label}
                {active
                    ? order === 'asc' ? <ArrowUp size={12} className="text-cyan-400" /> : <ArrowDown size={12} className="text-cyan-400" />
                    : <ArrowUpDown size={12} className="text-neutral-600" />}
            </span>
        </th>
    );
}

export default function UserFeedbackManager() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [order, setOrder] = useState('desc');
    const [page, setPage] = useState(1);
    const [updatingId, setUpdatingId] = useState(null);
    const limit = 20;

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.getUserFeedbackList({ sortBy, order, page, limit });
            setRows(data.feedback || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load feedback.');
        } finally {
            setLoading(false);
        }
    }, [sortBy, order, page]);

    useEffect(() => { load(); }, [load]);

    const handleSort = (field) => {
        if (sortBy === field) {
            setOrder(o => o === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setOrder('desc');
        }
        setPage(1);
    };

    const handleStatusChange = async (id, newStatus) => {
        setUpdatingId(id);
        try {
            const updated = await adminApi.updateUserFeedbackStatus(id, { status: newStatus });
            setRows(prev => prev.map(r => r._id === id ? { ...r, status: updated.status, resolvedAt: updated.resolvedAt } : r));
            toast.success(`Marked as ${newStatus}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed.');
        } finally {
            setUpdatingId(null);
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-3 text-neutral-200">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-400">{total} total submission{total !== 1 ? 's' : ''}</p>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle size={13} />
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-sm">
                    <thead className="bg-neutral-900 border-b border-neutral-800">
                        <tr>
                            <SortHeader label="Time" field="createdAt" sortBy={sortBy} order={order} onSort={handleSort} />
                            <SortHeader label="User Email" field="email" sortBy={sortBy} order={order} onSort={handleSort} />
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Type</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Category</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400 min-w-[240px]">Message</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-neutral-500">
                                    <Loader2 size={18} className="animate-spin inline-block mr-2" />
                                    Loading…
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-neutral-500 text-xs">No feedback submitted yet.</td>
                            </tr>
                        ) : rows.map(row => {
                            const Icon = TYPE_ICON[row.type] || MessageSquare;
                            const iconColor = TYPE_COLOR[row.type] || 'text-neutral-400';
                            return (
                                <tr key={row._id} className="bg-neutral-950 hover:bg-neutral-900 transition-colors">
                                    {/* Timestamp */}
                                    <td className="px-3 py-2.5 text-xs text-neutral-400 whitespace-nowrap">
                                        {row.createdAt ? format(new Date(row.createdAt), 'dd MMM yyyy, HH:mm') : '—'}
                                    </td>
                                    {/* Email */}
                                    <td className="px-3 py-2.5 text-xs">
                                        <span className="font-mono text-cyan-300/80">{row.userId?.email || <span className="text-neutral-600">deleted user</span>}</span>
                                        {row.userId?.name && <div className="text-neutral-500 text-[10px]">{row.userId.name}</div>}
                                    </td>
                                    {/* Type */}
                                    <td className="px-3 py-2.5">
                                        <span className={`flex items-center gap-1 text-xs font-medium capitalize ${iconColor}`}>
                                            <Icon size={12} />
                                            {row.type}
                                        </span>
                                    </td>
                                    {/* Category */}
                                    <td className="px-3 py-2.5 text-xs text-neutral-400">{row.category}</td>
                                    {/* Message */}
                                    <td className="px-3 py-2.5 text-xs text-neutral-300 max-w-xs">
                                        <p className="line-clamp-3">{row.message}</p>
                                    </td>
                                    {/* Status */}
                                    <td className="px-3 py-2.5">
                                        {updatingId === row._id ? (
                                            <Loader2 size={14} className="animate-spin text-neutral-500" />
                                        ) : (
                                            <select
                                                value={row.status}
                                                onChange={e => handleStatusChange(row._id, e.target.value)}
                                                className={`text-[11px] font-medium px-2 py-1 rounded-lg border bg-transparent cursor-pointer focus:outline-none ${STATUS_COLOR[row.status] || STATUS_COLOR.open}`}
                                            >
                                                {STATUS_OPTIONS.map(s => (
                                                    <option key={s} value={s} className="bg-neutral-900 text-neutral-200">{s}</option>
                                                ))}
                                            </select>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 rounded border border-neutral-700 hover:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 rounded border border-neutral-700 hover:border-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
