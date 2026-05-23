// frontend/src/components/admin/UserFeedbackManager.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as adminApi from '../../services/adminApi.js';
import { format, formatDistanceToNow } from 'date-fns';
import {
    RefreshCw, Loader2, AlertCircle, Bug, Lightbulb, MessageSquare,
    ChevronUp, ChevronDown, ChevronsUpDown, Paperclip, FileText,
    ExternalLink, User, Image as ImageIcon, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_ICON  = { bug: Bug, feature: Lightbulb, general: MessageSquare };
const TYPE_COLOR = { bug: 'text-red-400 bg-red-500/10 border-red-500/25', feature: 'text-blue-400 bg-blue-500/10 border-blue-500/25', general: 'text-neutral-300 bg-neutral-600/20 border-neutral-600/30' };
const STATUS_OPTIONS = ['open', 'acknowledged', 'resolved', 'wont-fix'];
const STATUS_COLOR = {
    open: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    acknowledged: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    'wont-fix': 'bg-neutral-600/30 text-neutral-400 border-neutral-600/30',
};

// Build the URL to an admin-served attachment
const attachmentUrl = (filename) =>
    `/api/admin/user-feedback/attachment/${encodeURIComponent(filename)}`;

// ─── Attachment viewer ────────────────────────────────────────────────────────
function AttachmentThumb({ att }) {
    const [lightbox, setLightbox] = useState(false);
    const url  = attachmentUrl(att.filename);
    const isImg = att.mimetype?.startsWith('image/');

    return (
        <>
            {isImg ? (
                <>
                    <button
                        onClick={() => setLightbox(true)}
                        className="relative group rounded overflow-hidden border border-neutral-700 hover:border-cyan-500 transition-colors"
                        title={att.originalName}
                        style={{ width: 72, height: 72, flexShrink: 0 }}
                    >
                        <img
                            src={url}
                            alt={att.originalName}
                            className="w-full h-full object-cover"
                            onError={e => { e.target.style.display = 'none'; }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ImageIcon size={18} className="text-white drop-shadow" />
                        </div>
                    </button>
                    {lightbox && (
                        <div
                            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                            onClick={() => setLightbox(false)}
                        >
                            <button
                                className="absolute top-4 right-4 text-white bg-black/60 rounded-full p-1.5 hover:bg-black/80"
                                onClick={() => setLightbox(false)}
                            >
                                <X size={18} />
                            </button>
                            <img
                                src={url}
                                alt={att.originalName}
                                className="max-w-full max-h-full rounded-lg shadow-2xl"
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                    )}
                </>
            ) : (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={att.originalName}
                    className="flex flex-col items-center justify-center gap-1 rounded border border-neutral-700 hover:border-cyan-500 transition-colors text-neutral-400 hover:text-cyan-300 p-2"
                    style={{ width: 72, height: 72, flexShrink: 0 }}
                >
                    <FileText size={22} />
                    <span className="text-[9px] text-center leading-tight break-all line-clamp-2">{att.originalName}</span>
                    <ExternalLink size={9} />
                </a>
            )}
        </>
    );
}

// ─── Single feedback card ─────────────────────────────────────────────────────
function FeedbackCard({ item, updatingId, onStatusChange }) {
    const Icon = TYPE_ICON[item.type] || MessageSquare;
    return (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
            {/* Top row: type + category + date + status */}
            <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border capitalize ${TYPE_COLOR[item.type] || TYPE_COLOR.general}`}>
                    <Icon size={11} />
                    {item.type}
                </span>
                <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded-full">{item.category}</span>
                <span className="text-xs text-neutral-600 ml-auto whitespace-nowrap">
                    {item.createdAt ? format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm') : '—'}
                </span>
            </div>

            {/* Message */}
            <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">{item.message}</p>

            {/* Attachments */}
            {item.attachments?.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                        <Paperclip size={10} /> Attachments ({item.attachments.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {item.attachments.map((att, i) => (
                            <AttachmentThumb key={i} att={att} />
                        ))}
                    </div>
                </div>
            )}

            {/* Status changer */}
            <div className="flex items-center gap-2 pt-1 border-t border-neutral-800">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-neutral-600">Status:</span>
                {updatingId === item._id ? (
                    <Loader2 size={13} className="animate-spin text-neutral-500" />
                ) : (
                    <select
                        value={item.status}
                        onChange={e => onStatusChange(item._id, e.target.value)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-transparent cursor-pointer focus:outline-none ${STATUS_COLOR[item.status] || STATUS_COLOR.open}`}
                    >
                        {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s} className="bg-neutral-900 text-neutral-200 font-normal">{s}</option>
                        ))}
                    </select>
                )}
                {item.resolvedAt && (
                    <span className="text-[10px] text-neutral-600 ml-auto">
                        Resolved {formatDistanceToNow(new Date(item.resolvedAt), { addSuffix: true })}
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function UserFeedbackManager() {
    const [rows,       setRows]       = useState([]);
    const [total,      setTotal]      = useState(0);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');
    const [sortBy,     setSortBy]     = useState('lastAt');  // lastAt | email | total
    const [order,      setOrder]      = useState('desc');
    const [selectedId, setSelectedId] = useState(null);     // selected userId string
    const [updatingId, setUpdatingId] = useState(null);

    // Load all feedback once (flat list)
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch up to 500 items; grouping is done client-side
            const data = await adminApi.getUserFeedbackList({ sortBy: 'createdAt', order: 'desc', page: 1, limit: 500 });
            setRows(data.feedback || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load feedback.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Group flat rows by user
    const users = useMemo(() => {
        const map = {};
        rows.forEach(r => {
            const uid   = r.userId?._id || r.userId || 'unknown';
            const email = r.userId?.email || 'Unknown user';
            const name  = r.userId?.name  || '';
            if (!map[uid]) {
                map[uid] = { uid, email, name, total: 0, bug: 0, feature: 0, general: 0, open: 0, lastAt: null, items: [] };
            }
            const g = map[uid];
            g.total++;
            g[r.type]  = (g[r.type] || 0) + 1;
            if (r.status === 'open') g.open++;
            const d = new Date(r.createdAt);
            if (!g.lastAt || d > g.lastAt) g.lastAt = d;
            g.items.push(r);
        });
        return Object.values(map);
    }, [rows]);

    // Sort user rows
    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => {
            let va, vb;
            if (sortBy === 'email') { va = a.email.toLowerCase(); vb = b.email.toLowerCase(); }
            else if (sortBy === 'total') { va = a.total; vb = b.total; }
            else { va = a.lastAt ? a.lastAt.getTime() : 0; vb = b.lastAt ? b.lastAt.getTime() : 0; }
            if (va === vb) return 0;
            const cmp = va > vb ? 1 : -1;
            return order === 'asc' ? cmp : -cmp;
        });
    }, [users, sortBy, order]);

    const selectedUser = useMemo(() => users.find(u => u.uid === selectedId) || null, [users, selectedId]);

    const handleSort = (field) => {
        setSortBy(s => {
            if (s === field) { setOrder(o => o === 'asc' ? 'desc' : 'asc'); return s; }
            setOrder('desc');
            return field;
        });
    };

    const handleStatusChange = async (id, newStatus) => {
        setUpdatingId(id);
        try {
            const updated = await adminApi.updateUserFeedbackStatus(id, { status: newStatus });
            setRows(prev => prev.map(r => r._id === id
                ? { ...r, status: updated.status, resolvedAt: updated.resolvedAt }
                : r
            ));
            toast.success(`Marked as ${newStatus}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed.');
        } finally {
            setUpdatingId(null);
        }
    };

    const SortIcon = ({ field }) => {
        if (sortBy !== field) return <ChevronsUpDown size={11} className="text-neutral-600" />;
        return order === 'asc'
            ? <ChevronUp size={11} className="text-cyan-400" />
            : <ChevronDown size={11} className="text-cyan-400" />;
    };

    const Th = ({ label, field }) => (
        <th
            className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-cyan-300 transition-colors select-none"
            onClick={() => handleSort(field)}
        >
            <span className="flex items-center gap-1">{label}<SortIcon field={field} /></span>
        </th>
    );

    return (
        <div className="flex h-full gap-4 min-h-0" style={{ height: 'calc(100vh - 160px)' }}>

            {/* ── LEFT: user list ─────────────────────────────────────── */}
            <div className="flex flex-col w-80 flex-shrink-0 min-h-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                    <span className="text-xs text-neutral-400">
                        {sortedUsers.length} user{sortedUsers.length !== 1 ? 's' : ''} · {total} submission{total !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="flex items-center gap-1 text-xs text-neutral-500 hover:text-cyan-300 transition-colors disabled:opacity-40"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {error && (
                    <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2 mb-2 flex-shrink-0">
                        <AlertCircle size={12} /> {error}
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-y-auto rounded-xl border border-neutral-800 min-h-0">
                    <table className="w-full text-xs">
                        <thead className="bg-neutral-900 sticky top-0 z-10">
                            <tr className="border-b border-neutral-800">
                                <Th label="User"  field="email" />
                                <Th label="Total" field="total" />
                                <Th label="Last"  field="lastAt" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="text-center py-10 text-neutral-500">
                                        <Loader2 size={16} className="animate-spin inline-block mr-2" />
                                        Loading…
                                    </td>
                                </tr>
                            ) : sortedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="text-center py-10 text-neutral-600">No feedback yet.</td>
                                </tr>
                            ) : sortedUsers.map(u => {
                                const isSelected = selectedId === u.uid;
                                return (
                                    <tr
                                        key={u.uid}
                                        onClick={() => setSelectedId(isSelected ? null : u.uid)}
                                        className={`cursor-pointer transition-colors ${isSelected
                                            ? 'bg-cyan-950/40 border-l-2 border-l-cyan-500'
                                            : 'hover:bg-neutral-900/70'
                                        }`}
                                    >
                                        {/* User */}
                                        <td className="px-3 py-2.5">
                                            <div className="font-mono text-cyan-300/80 text-[11px] leading-tight truncate max-w-[140px]">{u.email}</div>
                                            {u.name && <div className="text-neutral-500 text-[10px] truncate">{u.name}</div>}
                                            {/* Mini type pills */}
                                            <div className="flex gap-1 mt-1">
                                                {u.bug > 0     && <span className="text-[9px] bg-red-500/10 text-red-400 px-1 rounded">{u.bug}🐛</span>}
                                                {u.feature > 0 && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1 rounded">{u.feature}💡</span>}
                                                {u.general > 0 && <span className="text-[9px] bg-neutral-700 text-neutral-400 px-1 rounded">{u.general}💬</span>}
                                                {u.open > 0    && <span className="text-[9px] bg-yellow-500/10 text-yellow-400 px-1 rounded">{u.open} open</span>}
                                            </div>
                                        </td>
                                        {/* Total */}
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`inline-block font-bold text-sm ${isSelected ? 'text-cyan-300' : 'text-neutral-200'}`}>{u.total}</span>
                                        </td>
                                        {/* Last date */}
                                        <td className="px-3 py-2.5 text-neutral-500 whitespace-nowrap text-[10px]">
                                            {u.lastAt ? formatDistanceToNow(u.lastAt, { addSuffix: true }) : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── RIGHT: detail panel ──────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
                {!selectedUser ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-neutral-600 gap-3 rounded-xl border border-neutral-800/60 border-dashed">
                        <User size={40} strokeWidth={1} />
                        <p className="text-sm">Select a user to view their feedback</p>
                    </div>
                ) : (
                    <div className="flex flex-col min-h-0 h-full">
                        {/* Detail header */}
                        <div className="flex items-start justify-between mb-3 flex-shrink-0 gap-4">
                            <div>
                                <p className="text-sm font-semibold text-neutral-100">{selectedUser.email}</p>
                                {selectedUser.name && <p className="text-xs text-neutral-500">{selectedUser.name}</p>}
                            </div>
                            <div className="flex gap-3 flex-shrink-0 text-xs text-neutral-400">
                                <span className="flex flex-col items-center gap-0.5">
                                    <span className="text-lg font-bold text-neutral-100">{selectedUser.total}</span>
                                    Total
                                </span>
                                {selectedUser.bug > 0     && <span className="flex flex-col items-center gap-0.5"><span className="text-lg font-bold text-red-400">{selectedUser.bug}</span>Bug{selectedUser.bug !== 1 ? 's' : ''}</span>}
                                {selectedUser.feature > 0 && <span className="flex flex-col items-center gap-0.5"><span className="text-lg font-bold text-blue-400">{selectedUser.feature}</span>Feature{selectedUser.feature !== 1 ? 's' : ''}</span>}
                                {selectedUser.general > 0 && <span className="flex flex-col items-center gap-0.5"><span className="text-lg font-bold text-neutral-300">{selectedUser.general}</span>General</span>}
                                {selectedUser.open > 0    && <span className="flex flex-col items-center gap-0.5"><span className="text-lg font-bold text-yellow-400">{selectedUser.open}</span>Open</span>}
                            </div>
                        </div>

                        {/* Feedback cards - scrollable */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                            {[...selectedUser.items]
                                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                .map(item => (
                                    <FeedbackCard
                                        key={item._id}
                                        item={item}
                                        updatingId={updatingId}
                                        onStatusChange={handleStatusChange}
                                    />
                                ))
                            }
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
