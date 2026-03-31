// frontend/src/components/admin/MultiModelManager.jsx
// 2.1.3 Multi-Model Management — Course ↔ Adapter Mapping Dashboard

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
    Plus, Trash2, Edit3, RefreshCw, Loader2, AlertTriangle,
    ChevronDown, ChevronUp, CheckCircle, XCircle, History,
    Cpu, BookOpen, Save, X, ToggleLeft, ToggleRight, Link2
} from 'lucide-react';
import * as adminApi from '../../services/adminApi.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const PROVIDER_COLORS = {
    gemini: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    ollama: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    groq: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    openai: 'bg-green-500/20 text-green-300 border-green-500/40',
    'fine-tuned': 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    anthropic: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    mistral: 'bg-red-500/20 text-red-300 border-red-500/40',
};

const ProviderBadge = ({ provider }) => (
    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${PROVIDER_COLORS[provider] || 'bg-gray-500/20 text-gray-300 border-gray-500/40'}`}>
        {provider}
    </span>
);

const StatusBadge = ({ isActive }) => isActive ? (
    <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
        <CheckCircle size={10} /> Active
    </span>
) : (
    <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/40">
        <XCircle size={10} /> Inactive
    </span>
);

// ── Empty Form State ────────────────────────────────────────────────────────

const EMPTY_FORM = {
    courseId: '',
    adapterName: '',
    baseModel: '',
    provider: 'fine-tuned',
    version: 'v1.0',
    description: '',
};

// ── Main Component ──────────────────────────────────────────────────────────

export default function MultiModelManager() {
    const [mappings, setMappings] = useState([]);
    const [adapters, setAdapters] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingCourseId, setEditing] = useState(null); // null = create mode
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    // Expanded rows (history)
    const [expandedRow, setExpandedRow] = useState(null);

    // ── Data Fetching ────────────────────────────────────────────────────────

    const fetchAll = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        setError('');
        try {
            const [mappingsRes, adaptersRes] = await Promise.all([
                adminApi.getCourseAdapterMappings(),
                adminApi.getAvailableAdapters(),
            ]);
            setMappings(Array.isArray(mappingsRes) ? mappingsRes : []);
            setAdapters(Array.isArray(adaptersRes) ? adaptersRes : []);
        } catch (err) {
            setError(err.message || 'Failed to load data.');
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Form Helpers ─────────────────────────────────────────────────────────

    const openCreateForm = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const openEditForm = (mapping) => {
        setEditing(mapping.courseId);
        setForm({
            courseId: mapping.courseId,
            adapterName: mapping.adapterName,
            baseModel: mapping.baseModel,
            provider: mapping.provider,
            version: mapping.version,
            description: mapping.description || '',
        });
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
        setForm(EMPTY_FORM);
    };

    // When admin picks an adapter from the dropdown, auto-fill base model + provider
    const handleAdapterSelect = (modelId) => {
        const adapter = adapters.find(a => a.modelId === modelId);
        setForm(f => ({
            ...f,
            adapterName: modelId,
            baseModel: adapter?.modelId || modelId,
            provider: adapter?.provider || 'fine-tuned',
        }));
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
    };

    // ── CRUD Operations ──────────────────────────────────────────────────────

    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.courseId.trim() || !form.adapterName.trim() || !form.baseModel.trim()) {
            toast.error('Course ID, Adapter Name, and Base Model are required.');
            return;
        }
        setIsSaving(true);
        try {
            if (editingCourseId) {
                await adminApi.updateCourseAdapterMapping(editingCourseId, form);
                toast.success(`Mapping for '${editingCourseId}' updated.`);
            } else {
                await adminApi.createCourseAdapterMapping(form);
                toast.success(`Mapping for '${form.courseId}' created.`);
            }
            closeForm();
            fetchAll(true);
        } catch (err) {
            toast.error(err.message || 'Failed to save mapping.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (courseId) => {
        if (!window.confirm(`Delete adapter mapping for course '${courseId}'?`)) return;
        try {
            await adminApi.deleteCourseAdapterMapping(courseId);
            toast.success(`Mapping for '${courseId}' deleted.`);
            fetchAll(true);
        } catch (err) {
            toast.error(err.message || 'Failed to delete mapping.');
        }
    };

    const handleToggleActive = async (mapping) => {
        try {
            await adminApi.updateCourseAdapterMapping(mapping.courseId, { isActive: !mapping.isActive });
            toast.success(`Mapping ${!mapping.isActive ? 'activated' : 'deactivated'} for '${mapping.courseId}'.`);
            fetchAll(true);
        } catch (err) {
            toast.error(err.message || 'Failed to toggle mapping.');
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={36} className="animate-spin text-primary" />
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Loading Multi-Model Manager...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-1">

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-xl font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                        <Link2 size={20} className="text-primary" />
                        Multi-Model Management
                    </h2>
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-0.5">
                        Map fine-tuned adapters to courses. The chat pipeline will automatically load the correct adapter.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchAll(true)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-text-muted-light dark:text-text-muted-dark transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        onClick={openCreateForm}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/80 transition-colors"
                    >
                        <Plus size={15} /> New Mapping
                    </button>
                </div>
            </div>

            {/* ── Error Banner ── */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm">
                    <AlertTriangle size={16} />
                    {error}
                    <button onClick={() => fetchAll()} className="ml-auto text-xs underline">Retry</button>
                </div>
            )}

            {/* ── Create / Edit Form ── */}
            {showForm && (
                <div className="rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm text-text-light dark:text-text-dark">
                            {editingCourseId ? `Edit Mapping — ${editingCourseId}` : 'New Course ↔ Adapter Mapping'}
                        </h3>
                        <button onClick={closeForm} className="text-text-muted-light dark:text-text-muted-dark hover:text-red-400 transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Course ID */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">
                                Course ID *
                            </label>
                            <input
                                type="text"
                                name="courseId"
                                value={form.courseId}
                                onChange={handleFormChange}
                                disabled={!!editingCourseId}
                                placeholder="e.g. machine_learning"
                                className="input-base text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{
                                    background: 'var(--bg-input, #1f2937)',
                                    border: '1px solid var(--border, #374151)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    color: 'inherit',
                                    width: '100%',
                                }}
                            />
                        </div>

                        {/* Adapter Dropdown */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">
                                Adapter (LLM Config) *
                            </label>
                            <select
                                name="adapterName"
                                value={form.adapterName}
                                onChange={(e) => handleAdapterSelect(e.target.value)}
                                className="input-base text-sm"
                                style={{
                                    background: 'var(--bg-input, #1f2937)',
                                    border: '1px solid var(--border, #374151)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    color: 'inherit',
                                    width: '100%',
                                }}
                            >
                                <option value="">— Select an adapter —</option>
                                {adapters.map(a => (
                                    <option key={a.modelId} value={a.modelId}>
                                        [{a.provider}] {a.displayName || a.modelId}
                                    </option>
                                ))}
                                <option value="__custom__">+ Enter custom adapter name</option>
                            </select>
                            {form.adapterName === '__custom__' && (
                                <input
                                    type="text"
                                    name="adapterName"
                                    onChange={handleFormChange}
                                    placeholder="e.g. physics-lora-adapter-v2"
                                    className="mt-1 text-sm"
                                    style={{
                                        background: 'var(--bg-input, #1f2937)',
                                        border: '1px solid var(--border, #374151)',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        color: 'inherit',
                                        width: '100%',
                                    }}
                                />
                            )}
                        </div>

                        {/* Base Model */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">
                                Base Model *
                            </label>
                            <input
                                type="text"
                                name="baseModel"
                                value={form.baseModel}
                                onChange={handleFormChange}
                                placeholder="e.g. llama-3.1-8b-instant"
                                style={{
                                    background: 'var(--bg-input, #1f2937)',
                                    border: '1px solid var(--border, #374151)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    color: 'inherit',
                                    width: '100%',
                                }}
                            />
                        </div>

                        {/* Version */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">
                                Version
                            </label>
                            <input
                                type="text"
                                name="version"
                                value={form.version}
                                onChange={handleFormChange}
                                placeholder="v1.0"
                                style={{
                                    background: 'var(--bg-input, #1f2937)',
                                    border: '1px solid var(--border, #374151)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    color: 'inherit',
                                    width: '100%',
                                }}
                            />
                        </div>

                        {/* Provider */}
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">
                                Provider
                            </label>
                            <select
                                name="provider"
                                value={form.provider}
                                onChange={handleFormChange}
                                style={{
                                    background: 'var(--bg-input, #1f2937)',
                                    border: '1px solid var(--border, #374151)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    color: 'inherit',
                                    width: '100%',
                                }}
                            >
                                {['gemini', 'ollama', 'groq', 'openai', 'fine-tuned', 'anthropic', 'mistral'].map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>

                        {/* Description */}
                        <div className="flex flex-col gap-1 sm:col-span-2">
                            <label className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">
                                Description (optional)
                            </label>
                            <input
                                type="text"
                                name="description"
                                value={form.description}
                                onChange={handleFormChange}
                                placeholder="Admin notes about this mapping..."
                                style={{
                                    background: 'var(--bg-input, #1f2937)',
                                    border: '1px solid var(--border, #374151)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    color: 'inherit',
                                    width: '100%',
                                }}
                            />
                        </div>

                        {/* Actions */}
                        <div className="sm:col-span-2 flex justify-end gap-3 pt-1">
                            <button
                                type="button"
                                onClick={closeForm}
                                className="px-4 py-2 rounded-lg text-sm font-medium border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/80 disabled:opacity-60 transition-colors"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {editingCourseId ? 'Update Mapping' : 'Save Mapping'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Stats Bar ── */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total Mappings', value: mappings.length, icon: <Link2 size={16} className="text-primary" /> },
                    { label: 'Active', value: mappings.filter(m => m.isActive).length, icon: <CheckCircle size={16} className="text-emerald-400" /> },
                    { label: 'Adapters Available', value: adapters.length, icon: <Cpu size={16} className="text-blue-400" /> },
                ].map(({ label, value, icon }) => (
                    <div key={label} className="rounded-xl border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/40 p-3 flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            {icon}
                        </div>
                        <div>
                            <p className="text-lg font-bold text-text-light dark:text-text-dark">{value}</p>
                            <p className="text-[10px] text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Mappings Table ── */}
            {mappings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border-light dark:border-border-dark text-center">
                    <BookOpen size={40} className="text-text-muted-light dark:text-text-muted-dark mb-3 opacity-40" />
                    <p className="text-sm font-medium text-text-light dark:text-text-dark">No adapter mappings yet</p>
                    <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1 mb-4">
                        Create your first course ↔ adapter mapping to enable dynamic model routing.
                    </p>
                    <button
                        onClick={openCreateForm}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/80 transition-colors"
                    >
                        <Plus size={14} /> New Mapping
                    </button>
                </div>
            ) : (
                <div className="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-800 border-b border-border-light dark:border-border-dark">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Course ID</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Adapter</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide hidden md:table-cell">Base Model</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide hidden sm:table-cell">Version</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Status</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                {mappings.map((m) => (
                                    <React.Fragment key={m.courseId}>
                                        <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${!m.isActive ? 'opacity-60' : ''}`}>
                                            {/* Course ID */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <BookOpen size={14} className="text-primary flex-shrink-0" />
                                                    <span className="font-mono text-xs font-medium text-text-light dark:text-text-dark">
                                                        {m.courseId}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Adapter */}
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono text-xs text-text-light dark:text-text-dark truncate max-w-[160px]" title={m.adapterName}>
                                                        {m.adapterName}
                                                    </span>
                                                    <ProviderBadge provider={m.provider} />
                                                </div>
                                            </td>

                                            {/* Base Model */}
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className="font-mono text-xs text-text-muted-light dark:text-text-muted-dark">{m.baseModel}</span>
                                            </td>

                                            {/* Version */}
                                            <td className="px-4 py-3 hidden sm:table-cell">
                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-200 dark:bg-gray-700 text-text-light dark:text-text-dark">
                                                    {m.version}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                <StatusBadge isActive={m.isActive} />
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* Toggle Active */}
                                                    <button
                                                        onClick={() => handleToggleActive(m)}
                                                        title={m.isActive ? 'Deactivate' : 'Activate'}
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        {m.isActive
                                                            ? <ToggleRight size={15} className="text-emerald-400" />
                                                            : <ToggleLeft size={15} className="text-gray-400" />
                                                        }
                                                    </button>

                                                    {/* History */}
                                                    <button
                                                        onClick={() => setExpandedRow(expandedRow === m.courseId ? null : m.courseId)}
                                                        title="Version History"
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        <History size={15} className="text-blue-400" />
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                        onClick={() => openEditForm(m)}
                                                        title="Edit"
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        <Edit3 size={15} className="text-primary" />
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => handleDelete(m.courseId)}
                                                        title="Delete"
                                                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                    >
                                                        <Trash2 size={15} className="text-red-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* ── Expanded Version History ── */}
                                        {expandedRow === m.courseId && (
                                            <tr>
                                                <td colSpan={6} className="bg-gray-50 dark:bg-gray-800/60 px-6 py-4">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <History size={14} className="text-blue-400" />
                                                        <span className="text-xs font-semibold text-text-light dark:text-text-dark uppercase tracking-wide">
                                                            Version History for {m.courseId}
                                                        </span>
                                                    </div>
                                                    {!m.history || m.history.length === 0 ? (
                                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark">No history yet.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {[...m.history].reverse().map((h, i) => (
                                                                <div key={i} className="flex items-start gap-3 text-xs">
                                                                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 flex-shrink-0" />
                                                                    <div>
                                                                        <span className="font-mono font-medium text-text-light dark:text-text-dark">{h.adapterName}</span>
                                                                        <span className="text-text-muted-light dark:text-text-muted-dark"> @ {h.baseModel} — </span>
                                                                        <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-bold">{h.version}</span>
                                                                        {h.changedAt && (
                                                                            <span className="text-text-muted-light dark:text-text-muted-dark ml-2">
                                                                                {new Date(h.changedAt).toLocaleString()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {m.description && (
                                                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-3 italic border-t border-border-light dark:border-border-dark pt-2">
                                                            Note: {m.description}
                                                        </p>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Pipeline Info Box ── */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-xs text-blue-300/90 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                    <Cpu size={13} /> Chat Pipeline Integration
                </p>
                <p>When a user starts a chat, the router checks for an active mapping for the session's course. If found, it loads the specified adapter with <strong>highest priority</strong> (after Tutor Mode override). If no mapping exists, the router falls back to standard LLM selection logic.</p>
                <p className="opacity-70">Pass <code className="bg-blue-900/40 px-1 rounded">courseId</code> in the chat context to enable dynamic adapter routing.</p>
            </div>
        </div>
    );
}
