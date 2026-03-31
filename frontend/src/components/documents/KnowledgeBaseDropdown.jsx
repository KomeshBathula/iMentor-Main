// frontend/src/components/documents/KnowledgeBaseDropdown.jsx
// Inline dropdown for Knowledge Base — upload + document selection, embedded in ChatInput toolbar.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api.js';
import toast from 'react-hot-toast';
import {
    FileText, CheckCircle, Loader2, AlertTriangle, Trash2,
    Youtube, Globe, Library, UploadCloud, Paperclip, XCircle,
    Link as LinkIcon, X, Database, RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const getSourceIcon = (sourceType) => {
    const icons = {
        document: FileText, youtube: Youtube, webpage: Globe,
        subject: Library, audio: FileText, video: FileText, image: FileText
    };
    return icons[sourceType] || FileText;
};

const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    try {
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true });
    } catch { return ''; }
};

// ── Compact upload zone ───────────────────────────────────────────────────────
function CompactUpload({ onSourceAdded }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [drag, setDrag] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [ingestingUrl, setIngestingUrl] = useState(false);
    const inputRef = useRef(null);

    const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); setDrag(e.type !== 'dragleave' && e.type !== 'drop'); };
    const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            await api.uploadFile(fd);
            toast.success(`'${file.name}' accepted — processing started.`);
            setFile(null);
            if (inputRef.current) inputRef.current.value = null;
            onSourceAdded?.();
        } catch (err) {
            toast.error(`Upload failed: ${err.response?.data?.message || err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleIngestUrl = async () => {
        const url = urlInput.trim();
        if (!url) return;
        setIngestingUrl(true);
        try {
            await api.addUrlSource(url);
            toast.success('URL ingestion started.');
            setUrlInput('');
            onSourceAdded?.();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message);
        } finally {
            setIngestingUrl(false);
        }
    };

    return (
        <div className="p-3 border-b border-white/10 space-y-2">
            {/* Drag-and-drop zone */}
            <label
                htmlFor="kb-file-input"
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                className={`flex items-center justify-center gap-2 w-full h-16 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 text-xs
                    ${drag ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300' : 'border-white/20 hover:border-white/40 text-gray-400 hover:text-gray-300'}
                    ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
                <Paperclip size={16} />
                {file
                    ? <span className="truncate max-w-[140px] text-white font-medium">{file.name}</span>
                    : <span>Drop file or <span className="text-cyan-400 font-medium">browse</span></span>
                }
                {file && (
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setFile(null); }}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                        <XCircle size={14} />
                    </button>
                )}
                <input
                    ref={inputRef}
                    id="kb-file-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
                    accept=".pdf,.docx,.txt,.md,.mp3,.wav,.mp4,.mov,.png,.jpg,.jpeg"
                />
            </label>

            {/* Upload button — only shown when file selected */}
            {file && (
                <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                    {uploading ? 'Uploading…' : 'Process File'}
                </button>
            )}

            {/* URL ingestion */}
            <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                    <LinkIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleIngestUrl(); }}
                        placeholder="YouTube or webpage URL…"
                        disabled={ingestingUrl}
                        className="w-full bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-gray-600 pl-7 pr-2 py-1.5 outline-none focus:border-white/30"
                    />
                </div>
                <button
                    onClick={handleIngestUrl}
                    disabled={!urlInput.trim() || ingestingUrl}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-all disabled:opacity-40"
                >
                    {ingestingUrl ? <Loader2 size={12} className="animate-spin" /> : 'Ingest'}
                </button>
            </div>
        </div>
    );
}

// ── Main dropdown component ───────────────────────────────────────────────────
function KnowledgeBaseDropdown({ isOpen, onClose, onSelectSource, selectedSource }) {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const pollingRef = useRef(null);
    const dropdownRef = useRef(null);

    const fetchSources = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const resp = await api.getKnowledgeSources();
            const all = Array.isArray(resp) ? resp : [];
            setSources(all.filter(s => s.sourceType !== 'subject'));
            const stillProcessing = all.some(s => s.status?.startsWith('processing'));
            if (pollingRef.current && !stillProcessing) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        } catch (err) {
            if (!silent) toast.error('Could not load knowledge base.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) fetchSources();
    }, [isOpen, fetchSources, refreshKey]);

    useEffect(() => {
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        const processing = sources.some(s => s.status?.startsWith('processing'));
        if (processing) {
            pollingRef.current = setInterval(() => fetchSources(true), 5000);
        }
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [sources, fetchSources]);

    // Click-outside to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) onClose(); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, onClose]);

    const handleDelete = async (sourceId, sourceTitle, sourceType) => {
        if (sourceType === 'subject') { toast.error('Admin subjects cannot be deleted.'); return; }
        if (!window.confirm(`Delete "${sourceTitle}"?`)) return;
        const tid = toast.loading(`Deleting ${sourceTitle}…`);
        try {
            await api.deleteKnowledgeSource(sourceId);
            toast.success(`"${sourceTitle}" deleted.`, { id: tid });
            fetchSources();
            if (selectedSource === sourceTitle) onSelectSource(null);
        } catch (err) {
            toast.error(`Delete failed: ${err.message}`, { id: tid });
        }
    };

    if (!isOpen) return null;

    return (
        // Positioned absolutely by parent — renders above ChatInput
        <div
            ref={dropdownRef}
            className="absolute bottom-full left-0 right-0 mb-2 z-30
                bg-gray-950/95 backdrop-blur-xl
                border border-white/10
                rounded-2xl shadow-2xl
                overflow-hidden
                flex flex-col
                max-h-[420px]"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold tracking-wide">
                    <Database size={14} />
                    Knowledge Base
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={13} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/10 transition-all"
                        aria-label="Close"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Upload section */}
            <CompactUpload onSourceAdded={() => setRefreshKey(k => k + 1)} />

            {/* Document list */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center py-6 text-gray-500 text-xs gap-2">
                        <Loader2 size={14} className="animate-spin" /> Loading…
                    </div>
                ) : sources.length === 0 ? (
                    <p className="text-center text-xs text-gray-600 py-6">No documents yet. Upload one above.</p>
                ) : (
                    sources.map(source => {
                        const isSelected = selectedSource === source.title;
                        const isProcessing = source.status?.startsWith('processing');
                        const isFailed = source.status === 'failed';
                        const isSelectable = source.status === 'completed';
                        const Icon = getSourceIcon(source.sourceType);

                        return (
                            <div
                                key={source._id}
                                onClick={() => isSelectable && onSelectSource(isSelected ? null : source.title)}
                                className={`flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-150
                                    ${isSelectable ? 'cursor-pointer' : 'cursor-default opacity-60'}
                                    ${isSelected
                                        ? 'bg-cyan-500/15 border border-cyan-500/40 text-white'
                                        : 'hover:bg-white/5 border border-transparent text-gray-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    {isSelected
                                        ? <CheckCircle size={14} className="text-cyan-400 flex-shrink-0" />
                                        : <Icon size={14} className="text-gray-500 flex-shrink-0" />
                                    }
                                    <div className="min-w-0">
                                        <p className={`text-xs truncate leading-tight ${isSelected ? 'font-semibold text-cyan-300' : ''}`}>
                                            {source.title}
                                        </p>
                                        <p className="text-[10px] text-gray-600">
                                            {formatRelativeTime(source.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                    {isProcessing && <Loader2 size={12} className="animate-spin text-cyan-400" title="Processing…" />}
                                    {isFailed && <AlertTriangle size={12} className="text-red-400" title="Processing failed" />}
                                    {source.sourceType !== 'subject' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(source._id, source.title, source.sourceType); }}
                                            className="p-1 text-gray-600 hover:text-red-400 rounded-md hover:bg-red-500/10 transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Active document indicator */}
            {selectedSource && (
                <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between bg-cyan-500/10 flex-shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium min-w-0">
                        <CheckCircle size={12} className="flex-shrink-0" />
                        <span className="truncate">Using: {selectedSource}</span>
                    </div>
                    <button
                        onClick={() => onSelectSource(null)}
                        className="text-gray-500 hover:text-white text-xs ml-2 flex-shrink-0"
                        title="Deselect document"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}

export default KnowledgeBaseDropdown;
