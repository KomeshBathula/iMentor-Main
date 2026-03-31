// frontend/src/components/layout/TopNav.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppState } from '../../contexts/AppStateContext';

import LLMSelectionModal from './LLMSelectionModal.jsx';
import ProfileSettingsModal from '../profile/ProfileSettingsModal.jsx';
import {
    LogOut,
    User,
    MessageSquare,
    Settings,
    Cpu,
    Zap,
    ServerCrash,
    Server,
    Wrench,
    GraduationCap,
    Brain,
    Sparkles,
    Type
} from 'lucide-react';
import ToolsModal from '../tools/ToolsModal.jsx';
import LevelBadge from '../gamification/LevelBadge.jsx';
import RankBadge from '../gamification/RankBadge.jsx';
import XPProgressModal from '../gamification/XPProgressModal.jsx';
import { useUserLevel } from '../../hooks/useUserLevel.jsx';

// ─── Text Size Control ────────────────────────────────────────────────────────
// Four steps match common accessibility needs:
//   Compact (13 px) · Default (15 px) · Large (17 px) · XL / low-vision (20 px)
// Persisted in localStorage so the preference survives page refresh.

const FONT_SIZES = [
    { label: 'A',  size: '13px', title: 'Compact'          },
    { label: 'A',  size: '15px', title: 'Default'           },
    { label: 'A',  size: '17px', title: 'Large'             },
    { label: 'A',  size: '20px', title: 'Extra large (low-vision)' },
];
const FS_STORAGE_KEY = 'imentor-font-base';
const FS_DEFAULT     = '15px';

function applyFontSize(size) {
    document.documentElement.style.setProperty('--font-base', size);
}

function TextSizeControl() {
    const [active, setActive] = useState(() => {
        return localStorage.getItem(FS_STORAGE_KEY) || FS_DEFAULT;
    });

    // Apply on mount (restores preference after page load)
    useEffect(() => {
        applyFontSize(active);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const choose = useCallback((size) => {
        setActive(size);
        applyFontSize(size);
        localStorage.setItem(FS_STORAGE_KEY, size);
    }, []);

    // Visual sizes for the four "A" buttons — static px so they don't scale with page font
    const displaySizes = ['11px', '13px', '15px', '18px'];

    return (
        <div
            className="flex items-center gap-px"
            role="group"
            aria-label="Text size"
            title="Adjust text size for readability"
        >
            {/* Type icon — purely decorative label */}
            <Type
                size={12}
                style={{ color: 'var(--vs-text-dim)' }}
                aria-hidden="true"
                className="mr-1 flex-shrink-0"
            />
            {FONT_SIZES.map(({ label, size, title }, i) => (
                <button
                    key={size}
                    onClick={() => choose(size)}
                    title={title}
                    aria-label={`Text size: ${title}`}
                    aria-pressed={active === size}
                    style={{
                        fontSize: displaySizes[i],
                        fontWeight: active === size ? 600 : 400,
                        /* fixed px — must NOT scale with --font-base */
                        lineHeight: 1,
                        padding: '4px 5px',
                        border: active === size
                            ? '1px solid var(--vs-border-hi)'
                            : '1px solid transparent',
                        borderRadius: '3px',
                        background: active === size
                            ? 'var(--vs-active)'
                            : 'transparent',
                        color: active === size
                            ? 'var(--vs-text)'
                            : 'var(--vs-text-dim)',
                        cursor: 'pointer',
                        transition: 'color 0.15s, background 0.15s, border-color 0.15s',
                        minWidth: '22px',
                        textAlign: 'center',
                        userSelect: 'none',
                    }}
                    onMouseEnter={e => {
                        if (active !== size) e.currentTarget.style.color = 'var(--vs-text-lo)';
                    }}
                    onMouseLeave={e => {
                        if (active !== size) e.currentTarget.style.color = 'var(--vs-text-dim)';
                    }}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

// ─── TopNav ───────────────────────────────────────────────────────────────────

function TopNav({
    user: authUser,
    onLogout,
    onNewChat,
    orchestratorStatus,
    isChatProcessing
}) {
    const [isLLMModalOpen, setIsLLMModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isToolsModalOpen, setIsToolsModalOpen] = useState(false);
    const [isXPModalOpen, setIsXPModalOpen] = useState(false);

    const navigate = useNavigate();
    const { level, loading: levelLoading } = useUserLevel();
    const { selectedLLM, switchLLM, tutorMode } = useAppState();

    const handleEnableTutorMode = () => navigate('/tutor');

    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const profileDropdownRef = useRef(null);

    const StatusIndicator = useMemo(() => {
        if (!orchestratorStatus) {
            return (
                <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--vs-border-hi)' }}
                    title="Status unavailable"
                />
            );
        }
        if (orchestratorStatus.status === 'ok') {
            return (
                <Zap
                    size={14}
                    style={{ color: 'var(--vs-text-lo)' }}
                    title={orchestratorStatus.message}
                />
            );
        }
        if (orchestratorStatus.status === 'loading') {
            return (
                <div
                    className="animate-spin rounded-full w-3.5 h-3.5 border-t border-b"
                    style={{ borderColor: 'var(--vs-text-dim)' }}
                    title="Connecting..."
                />
            );
        }
        return (
            <ServerCrash
                size={14}
                style={{ color: 'var(--vs-text-dim)' }}
                title={orchestratorStatus.message}
            />
        );
    }, [orchestratorStatus]);

    useEffect(() => {
        const handler = (e) => {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
                setIsProfileDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Shared pill style — VS Code activity bar button aesthetic
    const pillCls = `
        inline-flex items-center gap-1.5
        px-3 py-1.5
        text-xs font-medium tracking-wide
        rounded-vs
        border
        transition-colors duration-150
        select-none
        cursor-pointer
    `;
    const pillNormal = `
        ${pillCls}
        text-[color:var(--vs-text-lo)]
        bg-[color:var(--vs-sidebar)]
        border-[color:var(--vs-border)]
        hover:bg-[color:var(--vs-surface)]
        hover:text-[color:var(--vs-text)]
        hover:border-[color:var(--vs-border-hi)]
    `;
    const pillDisabled = 'opacity-40 cursor-not-allowed';

    return (
        <>
            {/* ── Nav bar ─────────────────────────────────────────────────── */}
            <nav
                className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-3 sm:px-5 h-11"
                style={{
                    background:   'var(--vs-sidebar)',
                    borderBottom: '1px solid var(--vs-border)',
                    boxShadow:    '0 1px 0 rgba(0,0,0,0.3)',
                }}
            >
                {/* Logo */}
                <Link
                    to="/"
                    className="flex items-center gap-2 flex-shrink-0"
                    style={{ textDecoration: 'none' }}
                >
                    <Server
                        size={16}
                        style={{ color: 'var(--vs-text-lo)' }}
                    />
                    <span
                        className="hidden sm:inline text-sm font-semibold tracking-tight"
                        style={{ color: 'var(--vs-text)', letterSpacing: '-0.01em' }}
                    >
                        iMentor
                    </span>
                </Link>

                {/* Center actions — hidden in Tutor mode */}
                {!tutorMode && (
                    <div className="flex-1 flex justify-center px-4">
                        <div className="flex items-center gap-1.5">

                            <button
                                onClick={onNewChat}
                                disabled={isChatProcessing}
                                className={`${pillNormal} ${isChatProcessing ? pillDisabled : ''}`}
                            >
                                <MessageSquare size={12} />
                                <span className="hidden sm:inline">New Chat</span>
                            </button>

                            <Link
                                to="/study-plan"
                                className={`hidden md:inline-flex ${pillNormal}`}
                            >
                                <GraduationCap size={12} />
                                <span>Study Plan</span>
                            </Link>

                            <button
                                onClick={() => setIsToolsModalOpen(true)}
                                className={`hidden md:inline-flex ${pillNormal}`}
                            >
                                <Wrench size={12} />
                                <span>Tools</span>
                            </button>

                            <button
                                onClick={() => setIsLLMModalOpen(true)}
                                className={`hidden md:inline-flex ${pillNormal}`}
                            >
                                <Cpu size={12} />
                                <span>
                                    {selectedLLM === 'local_llm'
                                        ? 'Local LLM'
                                        : selectedLLM?.toUpperCase()}
                                </span>
                            </button>

                        </div>
                    </div>
                )}

                {/* Right controls */}
                <div className="flex items-center gap-3 flex-shrink-0">

                    {/* Orchestrator status dot */}
                    {StatusIndicator}

                    {/* ── Text size control ── placed immediately before user icon */}
                    <TextSizeControl />

                    {/* User / profile area */}
                    <div className="relative" ref={profileDropdownRef}>
                        <div className="flex items-center gap-2">

                            {/* XP rank badge (small) */}
                            {!levelLoading && level && (
                                <RankBadge
                                    level={level}
                                    size="sm"
                                    showLabel={false}
                                    onClick={() => setIsXPModalOpen(true)}
                                />
                            )}

                            {/* User icon button */}
                            <button
                                onClick={() => setIsProfileDropdownOpen(p => !p)}
                                className="relative flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-150"
                                style={{
                                    background:   'var(--vs-surface)',
                                    border:       '1px solid var(--vs-border-hi)',
                                    color:        'var(--vs-text)',
                                }}
                                aria-label="Open user menu"
                                aria-expanded={isProfileDropdownOpen}
                            >
                                <User size={14} />
                                {!levelLoading && level && (
                                    <div className="absolute -bottom-1 -right-1">
                                        <LevelBadge level={level} size="xs" />
                                    </div>
                                )}
                            </button>
                        </div>

                        {/* Dropdown */}
                        {isProfileDropdownOpen && (
                            <div
                                className="absolute right-0 mt-1.5 w-52 z-50 animate-motion-scale-in-sm"
                                style={{
                                    background:   'var(--vs-panel)',
                                    border:       '1px solid var(--vs-border-hi)',
                                    borderRadius: '4px',
                                    boxShadow:    '0 8px 24px rgba(0,0,0,0.5)',
                                    overflow:     'hidden',
                                }}
                                role="menu"
                            >
                                {/* Header */}
                                <div
                                    className="px-3 py-2.5"
                                    style={{
                                        borderBottom: '1px solid var(--vs-border)',
                                        fontSize: '0.75rem',
                                    }}
                                >
                                    <div style={{ color: 'var(--vs-text-dim)', marginBottom: '1px' }}>
                                        Signed in as
                                    </div>
                                    <div
                                        className="font-semibold truncate"
                                        style={{ color: 'var(--vs-text)' }}
                                    >
                                        {authUser?.username}
                                    </div>
                                </div>

                                {/* Menu items */}
                                {[
                                    {
                                        type: 'link',
                                        to: '/learning-profile',
                                        icon: Brain,
                                        label: 'Learning Memory',
                                    },
                                    {
                                        type: 'button',
                                        onClick: () => { setIsProfileModalOpen(true); setIsProfileDropdownOpen(false); },
                                        icon: Settings,
                                        label: 'Profile Settings',
                                    },
                                    {
                                        type: 'button',
                                        onClick: () => { onLogout(); setIsProfileDropdownOpen(false); },
                                        icon: LogOut,
                                        label: 'Logout',
                                    },
                                ].map((item, idx) => {
                                    const itemCls = `
                                        flex items-center gap-2.5 w-full
                                        px-3 py-2 text-left text-xs
                                        transition-colors duration-100 cursor-pointer
                                    `;
                                    const itemStyle = {
                                        color:      'var(--vs-text-lo)',
                                        background: 'transparent',
                                        border:     'none',
                                        textDecoration: 'none',
                                    };
                                    const Icon = item.icon;

                                    if (item.type === 'link') {
                                        return (
                                            <Link
                                                key={idx}
                                                to={item.to}
                                                className={itemCls}
                                                style={itemStyle}
                                                role="menuitem"
                                                onClick={() => setIsProfileDropdownOpen(false)}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = 'var(--vs-hover)';
                                                    e.currentTarget.style.color      = 'var(--vs-text)';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.color      = 'var(--vs-text-lo)';
                                                }}
                                            >
                                                <Icon size={13} />
                                                {item.label}
                                            </Link>
                                        );
                                    }
                                    return (
                                        <button
                                            key={idx}
                                            onClick={item.onClick}
                                            className={itemCls}
                                            style={itemStyle}
                                            role="menuitem"
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'var(--vs-hover)';
                                                e.currentTarget.style.color      = 'var(--vs-text)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.color      = 'var(--vs-text-lo)';
                                            }}
                                        >
                                            <Icon size={13} />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── Modals ──────────────────────────────────────────────────── */}
            <LLMSelectionModal
                isOpen={isLLMModalOpen}
                onClose={() => setIsLLMModalOpen(false)}
                currentLLM={selectedLLM}
                onSelectLLM={(llm) => { switchLLM(llm); setIsLLMModalOpen(false); }}
            />
            <ProfileSettingsModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />
            <ToolsModal
                isOpen={isToolsModalOpen}
                onClose={() => setIsToolsModalOpen(false)}
                onEnableTutorMode={handleEnableTutorMode}
            />
            <XPProgressModal
                isOpen={isXPModalOpen}
                onClose={() => setIsXPModalOpen(false)}
                level={level}
            />
        </>
    );
}

export default TopNav;
