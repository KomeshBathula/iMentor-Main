// frontend/src/components/layout/LLMSelectionModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import api from '../../services/api.js';
import toast from 'react-hot-toast';
import {
    Save, KeyRound, AlertCircle, HardDrive,
    Zap, Cloud, Server, Loader2, Circle, CheckCircle2, XCircle
} from 'lucide-react';
import Modal from '../core/Modal.jsx';
import Button from '../core/Button.jsx';

const PROVIDERS = [
    { id: 'local_llm', name: 'Local LLM', Icon: HardDrive },
    { id: 'groq',      name: 'Groq',      Icon: Zap,   keyPlaceholder: 'gsk_...' },
    { id: 'gemini',    name: 'Gemini',    Icon: Cloud,  keyPlaceholder: 'AIza...' },
];

function LLMSelectionModal({ isOpen, onClose }) {
    const { selectedLLM: currentLLM, switchLLM: setGlobalLLMPreference } = useAppState();

    const [provider, setProvider] = useState(currentLLM || 'local_llm');
    const [apiKey, setApiKey] = useState('');
    const [keyStatus, setKeyStatus] = useState('idle'); // idle | checking | valid | invalid
    const [keyError, setKeyError] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setProvider(currentLLM || 'local_llm');
            setApiKey('');
            setKeyStatus('idle');
            setKeyError('');
            setSaveError('');
        }
    }, [isOpen, currentLLM]);

    // Reset key state when provider changes
    useEffect(() => {
        setApiKey('');
        setKeyStatus('idle');
        setKeyError('');
        setSaveError('');
    }, [provider]);

    const providerMeta = PROVIDERS.find(p => p.id === provider);

    // Validate API key via authenticated endpoint
    const validateKey = useCallback(async (key) => {
        const trimmed = (key ?? apiKey).trim();
        if (!trimmed || provider === 'local_llm') return;

        setKeyStatus('checking');
        setKeyError('');
        try {
            const result = await api.validateLLMProviderConnection({
                provider,
                apiKey: trimmed,
            });
            if (result.ok) {
                setKeyStatus('valid');
            } else {
                setKeyStatus('invalid');
                setKeyError(result.message || 'Invalid API key.');
            }
        } catch (err) {
            setKeyStatus('invalid');
            setKeyError(err.response?.data?.message || err.message || 'Validation failed.');
        }
    }, [apiKey, provider]);

    const handleSave = async () => {
        setSaving(true);
        setSaveError('');

        // Cloud providers need a validated key before saving
        if (provider !== 'local_llm' && keyStatus !== 'valid') {
            setSaveError('Please verify your API key first (enter it and press Tab).');
            setSaving(false);
            return;
        }

        try {
            const configData = { llmProvider: provider };
            if (provider !== 'local_llm') {
                configData.apiKey = apiKey.trim();
            }
            await api.updateUserLLMConfig(configData);
            setGlobalLLMPreference(provider);
            toast.success(`Switched to ${providerMeta?.name}`);
            onClose();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to save.';
            setSaveError(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    // Apply is always enabled for local_llm; for cloud requires valid key
    const canSave = provider === 'local_llm' || keyStatus === 'valid';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <span className="flex items-center gap-2 text-sm font-medium tracking-wide text-neutral-200">
                    <Server size={15} className="text-neutral-400" />
                    LLM Configuration
                </span>
            }
            size="xl"
            footerContent={
                <div className="flex items-center gap-2">
                    <Button onClick={onClose} variant="secondary" size="sm" disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} isLoading={saving} size="sm" disabled={!canSave || saving}>
                        <Save size={13} className="mr-1.5" />
                        Apply
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 text-neutral-200">

                {/* ── Provider tabs ── */}
                <div className="grid grid-cols-3 gap-2">
                    {PROVIDERS.map(({ id, name, Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setProvider(id)}
                            disabled={saving}
                            className={`rounded-xl px-2 py-2.5 border transition-all duration-200 flex flex-col items-center justify-center gap-1.5 ${
                                provider === id
                                    ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/15 to-cyan-400/5 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
                                    : 'border-neutral-700 bg-neutral-900/60 hover:border-cyan-600/70 hover:bg-neutral-800/70'
                            } ${saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <Icon size={14} className={provider === id ? 'text-cyan-300' : 'text-neutral-400'} />
                            <span className={`text-[11px] font-semibold ${provider === id ? 'text-cyan-100' : 'text-neutral-300'}`}>
                                {name}
                            </span>
                        </button>
                    ))}
                </div>

                {/* ── Local LLM: zero config — server handles it ── */}
                {provider === 'local_llm' && (
                    <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-950/20 px-4 py-3 text-sm text-green-300">
                        <HardDrive size={16} className="mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="font-semibold">No configuration needed</p>
                            <p className="text-xs text-green-400/70 mt-0.5">
                                Uses the server-hosted model set in <code className="font-mono">.env</code> automatically. No API key or URL required.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Cloud providers: API key only ── */}
                {provider !== 'local_llm' && (
                    <div className="space-y-1">
                        <label className="text-[11px] text-neutral-400 uppercase tracking-wider">
                            {providerMeta?.name} API Key
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                <KeyRound size={14} className="text-cyan-400/80" />
                            </div>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={e => {
                                    setApiKey(e.target.value);
                                    setKeyStatus('idle');
                                    setKeyError('');
                                }}
                                onBlur={() => { if (apiKey.trim()) validateKey(apiKey); }}
                                disabled={saving}
                                placeholder={providerMeta?.keyPlaceholder}
                                className="w-full h-10 rounded-lg bg-[#0D1214] border border-[#1E3238] pl-9 pr-10 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-400/80 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.12)] transition-all"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {keyStatus === 'checking' && <Loader2 size={14} className="animate-spin text-cyan-400" />}
                                {keyStatus === 'valid'    && <CheckCircle2 size={14} className="text-emerald-400" />}
                                {keyStatus === 'invalid'  && <XCircle size={14} className="text-red-400" />}
                            </div>
                        </div>
                        <p className="text-[10px] text-neutral-500 px-0.5">Tab out to validate immediately.</p>
                    </div>
                )}

                {/* ── Key status box (cloud providers only) ── */}
                {provider !== 'local_llm' && (
                    <div className="rounded-lg border border-[#1B2A2E] bg-[#0C1316] px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Key Status</div>
                        {keyStatus === 'idle' && (
                            <div className="flex items-center gap-2 text-xs text-neutral-500">
                                <Circle size={10} />Enter your API key above
                            </div>
                        )}
                        {keyStatus === 'checking' && (
                            <div className="flex items-center gap-2 text-xs text-cyan-300">
                                <Loader2 size={13} className="animate-spin" />Validating key…
                            </div>
                        )}
                        {keyStatus === 'valid' && (
                            <div className="flex items-center gap-2 text-xs text-emerald-300">
                                <CheckCircle2 size={13} />Key is valid — ready to save
                            </div>
                        )}
                        {keyStatus === 'invalid' && (
                            <div className="flex items-center gap-2 text-xs text-red-400">
                                <AlertCircle size={13} />{keyError || 'Invalid key'}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Save error ── */}
                {saveError && (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs rounded-lg bg-red-950/40 border border-red-500/20 text-red-300">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        {saveError}
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default LLMSelectionModal;
