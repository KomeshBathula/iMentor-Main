// frontend/src/components/landing/LandingPage.jsx
import React, { useRef } from 'react';
import Animate, { AnimateOnView } from '../core/Animate.jsx';
import {
    Sparkles, ArrowRight, Menu, X, MessageCircle, Lightbulb,
    Search, BookOpen, TreePine, Swords, Gift, GraduationCap,
    FileQuestion, Code, BrainCircuit, Headphones, FileText,
    BarChart3, Target, Flame, Zap, Trophy, Check, ChevronDown
} from 'lucide-react';

// ─── Animated Section wrapper ─────────────────────────────
const Section = ({ children, id, className = '' }) => {
    return (
        <section id={id} className={`relative ${className}`}>
            <AnimateOnView animation="slide-up" duration="0.8s" threshold={0.1}>
                {children}
            </AnimateOnView>
        </section>
    );
};

// ─── Gradient border card ─────────────────────────────────
const GlowCard = ({ children, className = '', hover = true, tealGlow = false }) => (
    <div className={`relative group ${className}`}>
        {/* Gradient border */}
        <div className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-b ${
            tealGlow
                ? 'from-teal-500/20 via-teal-500/5 to-transparent'
                : 'from-white/[0.12] via-white/[0.04] to-transparent'
        } ${hover ? 'group-hover:from-white/[0.18] group-hover:via-white/[0.08] group-hover:to-transparent' : ''} transition-all duration-500`} />
        {/* Card body */}
        <div className={`relative rounded-2xl bg-[#0c0c0c] ${hover ? 'group-hover:bg-[#111]' : ''} transition-colors duration-500`}>
            {children}
        </div>
    </div>
);

// ─── Feature Card ─────────────────────────────────────────
const FeatureCard = ({ icon: Icon, title, desc, delay = 0, teal = false }) => (
    <AnimateOnView
        animation="slide-up"
        duration="0.5s"
        delay={delay * 1000}
    >
        <GlowCard hover tealGlow={teal}>
            <div className="p-6 h-full">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 border transition-transform duration-300 group-hover:scale-110 ${
                    teal
                        ? 'bg-teal-500/[0.08] border-teal-500/20 text-teal-400'
                        : 'bg-white/[0.04] border-white/[0.08] text-gray-300'
                }`}>
                    <Icon size={20} />
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">{title}</h3>
                <p className="text-[13px] text-gray-400 leading-relaxed">{desc}</p>
            </div>
        </GlowCard>
    </AnimateOnView>
);

// ─── Nav ──────────────────────────────────────────────────
const Nav = ({ onLoginClick }) => {
    const [open, setOpen] = React.useState(false);
    const links = [
        { label: 'Tutor', href: '#tutor' },
        { label: 'Research', href: '#research' },
        { label: 'Gamification', href: '#gamification' },
        { label: 'Features', href: '#features' },
        { label: 'Academics', href: '#academics' },
    ];
    return (
        <header className="fixed top-0 inset-x-0 z-50 bg-black/70 backdrop-blur-2xl border-b border-white/[0.06]">
            <nav className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
                <a href="#home" className="flex items-center gap-2.5 group">
                    <div className="relative">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div className="absolute inset-0 rounded-lg bg-teal-400/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <span className="text-lg font-bold text-white tracking-tight">iMentor</span>
                </a>
                <div className="hidden md:flex items-center gap-1">
                    {links.map(l => (
                        <a key={l.label} href={l.href}
                           className="px-3.5 py-1.5 text-[13px] font-medium text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]">
                            {l.label}
                        </a>
                    ))}
                </div>
                <button onClick={() => setOpen(!open)} className="md:hidden text-white p-1.5">
                    {open ? <X size={20} /> : <Menu size={20} />}
                </button>
            </nav>
            {open && (
                <Animate animation="height-in"
                    className="md:hidden bg-black/95 backdrop-blur-2xl border-t border-white/[0.06] px-5 py-4 space-y-1">
                    {links.map(l => (
                        <a key={l.label} href={l.href} onClick={() => setOpen(false)}
                           className="block px-3 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/[0.04] rounded-lg">{l.label}</a>
                    ))}
                    <div className="flex gap-2 pt-3 border-t border-white/[0.06] mt-3">
                        <button onClick={() => { onLoginClick(true); setOpen(false); }}
                            className="flex-1 py-2.5 text-sm text-white border border-white/10 rounded-lg hover:bg-white/5">Login</button>
                        <button onClick={() => { onLoginClick(false); setOpen(false); }}
                            className="flex-1 py-2.5 text-sm bg-white text-black rounded-lg font-medium hover:bg-gray-200">Sign Up</button>
                    </div>
                </Animate>
            )}
        </header>
    );
};

// ═══════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════
const LandingPage = ({ onLoginClick }) => {
    return (
        <div className="bg-black text-white font-sans overflow-y-auto h-screen scroll-smooth custom-scrollbar">
            <Nav onLoginClick={onLoginClick} />
            <main>
                {/* ─── HERO ─────────────────────────────────────── */}
                <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
                    {/* Animated BG effects */}
                    <div className="absolute inset-0">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(13,148,136,0.07),transparent)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(13,148,136,0.04),transparent_50%)]" />
                        <div
                            className="absolute top-[5%] left-[5%] w-[45vw] h-[45vw] rounded-full bg-teal-500 blur-[180px] animate-pulse opacity-[0.05]" />
                        <div
                            className="absolute bottom-[5%] right-[5%] w-[40vw] h-[40vw] rounded-full bg-white blur-[160px] animate-pulse opacity-[0.04]" />
                        <div
                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-[0.02] animate-[spin_80s_linear_infinite]"
                            style={{ background: 'conic-gradient(from 0deg, transparent, rgba(13,148,136,0.3), transparent, rgba(255,255,255,0.2), transparent)' }} />
                        {/* Grid */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
                        {/* Noise */}
                        <div className="absolute inset-0 opacity-[0.015] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />
                    </div>

                    <div className="relative z-10 text-center px-5 max-w-4xl mx-auto">
                        <Animate animation="scale-in" duration="0.9s">
                            <div className="relative inline-block mb-5">
                                <div
                                    className="absolute inset-0 blur-[60px] bg-gradient-to-r from-teal-500/20 via-white/10 to-teal-500/20 rounded-full animate-pulse" />
                                <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-500 drop-shadow-[0_0_80px_rgba(13,148,136,0.15)]">
                                    iMentor
                                </h1>
                            </div>
                        </Animate>
                        <Animate as="p" animation="slide-up" delay={400} duration="0.7s"
                            className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                            <span className="text-white">Your AI Mentor for</span>{' '}
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-teal-500">Limitless Learning</span>
                        </Animate>
                        <Animate as="p" animation="slide-up" delay={700}
                            className="mt-6 max-w-xl mx-auto text-base sm:text-lg text-gray-400 leading-relaxed">
                            Socratic tutoring, deep research, knowledge graphs, and gamified progression — all in one platform built for academics.
                        </Animate>
                        <Animate animation="slide-up" delay={1000}
                            className="mt-9 flex flex-col items-center gap-4">
                            <div className="flex flex-row gap-3">
                                <button onClick={() => onLoginClick(true)}
                                    className="inline-flex items-center justify-center px-7 py-3.5 border border-white/15 text-gray-300 font-medium rounded-xl hover:border-white/30 hover:text-white hover:bg-white/[0.04] transition-all text-base">
                                    Login
                                </button>
                                <button onClick={() => onLoginClick(false)}
                                    className="group relative inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-all text-base shadow-xl shadow-black/30">
                                    <span className="absolute -inset-1 bg-white/15 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
                                    <span className="relative flex items-center gap-2">Start Learning Now <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" /></span>
                                </button>
                            </div>
                            <a href="#tutor"
                                className="text-sm text-gray-500 hover:text-teal-400 transition-colors font-medium">
                                See How It Works ↓
                            </a>
                        </Animate>
                    </div>
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2"
                        style={{ animation: 'bounce 2s infinite' }}>
                        <div className="w-6 h-10 border-2 border-gray-700 rounded-full flex justify-center p-1.5">
                            <div
                                className="w-1.5 h-2 bg-teal-500/50 rounded-full animate-pulse" />
                        </div>
                    </div>
                </section>

                {/* ─── TUTOR MODE ───────────────────────────────── */}
                <Section id="tutor" className="py-24 lg:py-32">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-teal-500/[0.015] to-transparent pointer-events-none" />
                    <div className="max-w-6xl mx-auto px-5 relative">
                        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
                            <div className="space-y-7">
                                <AnimateOnView animation="slide-up"
                                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/[0.08] text-teal-400 text-xs font-semibold border border-teal-500/20">
                                    <Lightbulb size={13} /> Socratic Tutor
                                </AnimateOnView>
                                <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.1]">
                                    Don't just get answers.<br />
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-300 to-gray-500">Learn how to think.</span>
                                </h2>
                                <p className="text-gray-400 text-lg leading-relaxed max-w-lg">
                                    The <span className="text-white font-medium">Socratic Tutor</span> guides you with thoughtful questions instead of spoon-feeding answers. It adapts to your understanding, identifies misconceptions, and builds deep intuition.
                                </p>
                                <div className="space-y-3.5 pt-2">
                                    {['Adapts to your current understanding level', 'Curriculum-aware — follows your course structure', 'Builds retention through active recall'].map((t, i) => (
                                        <AnimateOnView key={i} animation="slide-up"
                                            delay={200 + i * 100}
                                            className="flex items-center gap-3">
                                            <div className="w-5 h-5 rounded-full bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                                                <Check size={10} className="text-teal-400" />
                                            </div>
                                            <span className="text-gray-300 text-sm">{t}</span>
                                        </AnimateOnView>
                                    ))}
                                </div>
                                <button onClick={() => onLoginClick(false)}
                                    className="group inline-flex items-center gap-2 text-teal-400 text-sm font-medium hover:gap-3 transition-all mt-2 hover:text-teal-300">
                                    Try Tutor Mode <ArrowRight size={16} />
                                </button>
                            </div>
                            {/* Chat mockup */}
                            <AnimateOnView animation="slide-up" duration="0.7s">
                                <GlowCard tealGlow>
                                    <div className="p-6 space-y-4">
                                        <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
                                            <div className="w-2 h-2 rounded-full bg-teal-500 shadow-sm shadow-teal-500/50" />
                                            <span className="text-xs text-gray-500 font-medium">iMentor Tutor — Machine Learning</span>
                                        </div>
                                        {[
                                            { role: 'tutor', text: "What do you think happens when we increase the degree of a polynomial regression model?" },
                                            { role: 'student', text: "It fits the training data better?" },
                                            { role: 'tutor', text: "Good intuition! But what might be the trade-off? Think about how it performs on new, unseen data..." },
                                        ].map((msg, i) => (
                                            <AnimateOnView key={i} animation="slide-up"
                                                delay={300 + i * 200}
                                                className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] px-4 py-3 rounded-xl text-sm leading-relaxed ${
                                                    msg.role === 'student'
                                                        ? 'bg-teal-500/[0.08] text-gray-200 border border-teal-500/10'
                                                        : 'bg-white/[0.04] text-gray-300 border border-white/[0.06]'
                                                }`}>
                                                    {msg.text}
                                                </div>
                                            </AnimateOnView>
                                        ))}
                                        <div className="flex items-center gap-2 pt-2">
                                            <div className="flex-1 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center px-3">
                                                <span className="text-xs text-gray-600">Type your answer...</span>
                                            </div>
                                            <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                                <ArrowRight size={14} className="text-teal-400" />
                                            </div>
                                        </div>
                                    </div>
                                </GlowCard>
                            </AnimateOnView>
                        </div>
                    </div>
                </Section>

                {/* ─── DEEP RESEARCH ───────────────────────────── */}
                <Section id="research" className="py-24 lg:py-32">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent pointer-events-none" />
                    <div className="max-w-6xl mx-auto px-5 relative">
                        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
                            {/* Pipeline visualization */}
                            <AnimateOnView animation="slide-up" duration="0.7s"
                                className="order-2 lg:order-1">
                                <GlowCard>
                                    <div className="p-6">
                                        <div className="flex items-center gap-2 pb-4 border-b border-white/[0.06] mb-5">
                                            <div className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center">
                                                <Search size={12} className="text-gray-400" />
                                            </div>
                                            <span className="text-xs text-gray-400 font-medium">Deep Research Engine</span>
                                            <div className="ml-auto flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                                <span className="text-[10px] text-teal-500 font-medium">RUNNING</span>
                                            </div>
                                        </div>
                                        <div className="space-y-3.5">
                                            {[
                                                { phase: 'Planning', desc: 'Research strategy generated', done: true },
                                                { phase: 'RAG Retrieval', desc: 'Searched 8 uploaded documents', done: true },
                                                { phase: 'Web Search', desc: 'Crawled 12 academic sources', done: true },
                                                { phase: 'Fact Checking', desc: 'Cross-referencing claims...', done: true },
                                                { phase: 'Synthesis', desc: 'Producing cited report...', done: false },
                                            ].map((s, i) => (
                                                <AnimateOnView key={i} animation="slide-up"
                                                    delay={200 + i * 120}
                                                    className="flex items-center gap-3.5 group/step">
                                                    <div className="relative">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold border transition-all ${
                                                            s.done
                                                                ? 'bg-teal-500/10 border-teal-500/25 text-teal-400'
                                                                : 'bg-white/[0.03] border-white/10 text-gray-500'
                                                        }`}>
                                                            {s.done ? <Check size={12} /> : <span className="animate-pulse">⋯</span>}
                                                        </div>
                                                        {i < 4 && <div className={`absolute top-7 left-1/2 -translate-x-1/2 w-px h-3.5 ${s.done ? 'bg-teal-500/20' : 'bg-white/[0.04]'}`} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className={`text-sm font-medium ${s.done ? 'text-white' : 'text-gray-500'}`}>{s.phase}</span>
                                                        <span className="text-[11px] text-gray-600 ml-2">{s.desc}</span>
                                                    </div>
                                                </AnimateOnView>
                                            ))}
                                        </div>
                                        {/* Progress bar */}
                                        <div className="mt-5 pt-4 border-t border-white/[0.06]">
                                            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full shadow-sm shadow-teal-500/30" style={{ width: '85%' }} />
                                            </div>
                                            <span className="text-[10px] text-gray-600 mt-1.5 block">85% complete</span>
                                        </div>
                                    </div>
                                </GlowCard>
                            </AnimateOnView>
                            <div className="order-1 lg:order-2 space-y-7">
                                <AnimateOnView animation="slide-up"
                                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.05] text-gray-300 text-xs font-semibold border border-white/[0.08]">
                                    <Search size={13} /> Deep Research
                                </AnimateOnView>
                                <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.1]">
                                    Research-grade<br />
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-300 to-gray-500">analysis on demand.</span>
                                </h2>
                                <p className="text-gray-400 text-lg leading-relaxed max-w-lg">
                                    Deep Research goes beyond simple Q&A. It <span className="text-white font-medium">plans a research strategy</span>, retrieves from your uploaded documents and the web, <span className="text-white font-medium">fact-checks claims</span>, and synthesizes a comprehensive report with citations.
                                </p>
                                <div className="space-y-3.5 pt-2">
                                    {['Multi-source retrieval — your docs + live web', 'Automated fact-checking and citation', 'Structured reports exportable as DOCX/PPTX'].map((t, i) => (
                                        <AnimateOnView key={i} animation="slide-up"
                                            delay={200 + i * 100}
                                            className="flex items-center gap-3">
                                            <div className="w-5 h-5 rounded-full bg-white/[0.05] flex items-center justify-center border border-white/[0.1]">
                                                <Check size={10} className="text-gray-400" />
                                            </div>
                                            <span className="text-gray-300 text-sm">{t}</span>
                                        </AnimateOnView>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* ─── GAMIFICATION ─────────────────────────────── */}
                <Section id="gamification" className="py-24 lg:py-32">
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-teal-500/[0.02] rounded-full blur-[120px]" />
                        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-white/[0.015] rounded-full blur-[100px]" />
                    </div>
                    <div className="max-w-6xl mx-auto px-5 relative">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <AnimateOnView animation="slide-up">
                                <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5">
                                    Level Up Your{' '}
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-teal-500">Learning</span>
                                </h2>
                                <p className="text-gray-400 text-lg">
                                    Earn XP, conquer bosses, unlock skills, and climb the ranks. Learning has never been this engaging.
                                </p>
                            </AnimateOnView>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {[
                                { icon: TreePine, title: 'Skill Tree Map', desc: 'Explore an interactive skill tree for each subject. Unlock topics as you progress and visualize your mastery journey.', teal: true },
                                { icon: Swords, title: 'Boss Battles', desc: 'Challenge AI-generated bosses built from your weakest topics. Defeat them with correct answers to earn XP and badges.', teal: false },
                                { icon: Gift, title: 'Bounty Credits', desc: 'Earn bounty credits by completing learning milestones. Spend them to unlock advanced challenges and features.', teal: false },
                                { icon: Flame, title: 'Streaks & XP', desc: 'Build daily learning streaks and earn experience points for every interaction, quiz, and completed topic.', teal: true },
                            ].map((item, i) => (
                                <FeatureCard key={item.title} icon={item.icon} title={item.title} desc={item.desc} delay={i * 0.1} teal={item.teal} />
                            ))}
                        </div>
                    </div>
                </Section>

                {/* ─── PLATFORM FEATURES ────────────────────────── */}
                <Section id="features" className="py-24 lg:py-32">
                    <div className="max-w-6xl mx-auto px-5">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <AnimateOnView animation="slide-up">
                                <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5">
                                    Everything You Need to{' '}
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-300 to-gray-500">Succeed</span>
                                </h2>
                                <p className="text-gray-400 text-lg">
                                    A complete suite of AI-powered tools designed for academic excellence.
                                </p>
                            </AnimateOnView>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[
                                { icon: GraduationCap, title: 'Study Plans', desc: 'Generate personalized step-by-step study plans based on your goals, course structure, and identified knowledge gaps.' },
                                { icon: FileQuestion, title: 'Quiz Generator', desc: 'Upload any document and instantly get AI-generated multiple-choice quizzes to test comprehension and prepare for exams.' },
                                { icon: Code, title: 'Code Sandbox', desc: 'Write, run, and test code in multiple languages within a secure sandbox. Get AI-powered feedback and error explanations.' },
                                { icon: BrainCircuit, title: 'Knowledge Graphs', desc: 'Automatically extract concepts from documents and visualize them as interactive graphs powered by Neo4j.' },
                                { icon: Headphones, title: 'Podcast Generator', desc: 'Transform study materials into engaging multi-speaker audio podcasts for auditory learning on the go.' },
                                { icon: FileText, title: 'Document Export', desc: 'Export analysis, research reports, and summaries into professional DOCX and PPTX formats for review or submission.' },
                            ].map((item, i) => (
                                <FeatureCard key={item.title} icon={item.icon} title={item.title} desc={item.desc} delay={i * 0.08} />
                            ))}
                        </div>
                    </div>
                </Section>

                {/* ─── BUILT FOR ACADEMICS ──────────────────────── */}
                <Section id="academics" className="py-24 lg:py-32">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-teal-500/[0.01] to-transparent pointer-events-none" />
                    <div className="max-w-6xl mx-auto px-5 relative">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <AnimateOnView animation="slide-up">
                                <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5">
                                    Built for the{' '}
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 to-teal-500">Academic Community</span>
                                </h2>
                                <p className="text-gray-400 text-lg">
                                    Whether you're a student striving for excellence or an educator fostering it, iMentor has tools for you.
                                </p>
                            </AnimateOnView>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {[
                                {
                                    title: 'For Students', teal: true,
                                    items: [
                                        'Personalized 24/7 AI tutor for any subject',
                                        'Generate quizzes from lecture notes for exam prep',
                                        'Practice coding with AI-powered feedback',
                                        'Upload documents and chat with your knowledge base',
                                        'Track progress with skill trees and XP'
                                    ]
                                },
                                {
                                    title: 'For Educators', teal: false,
                                    items: [
                                        'Upload curated subject materials for your class',
                                        'Curriculum graph management via CSV upload',
                                        'Monitor student engagement through analytics',
                                        'Gamification dashboard for class management',
                                        'Academic integrity tools built in'
                                    ]
                                }
                            ].map((card) => (
                                <AnimateOnView key={card.title} animation="slide-up">
                                    <GlowCard tealGlow={card.teal}>
                                        <div className="p-8">
                                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                                {card.teal && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                                                {!card.teal && <div className="w-2 h-2 rounded-full bg-gray-500" />}
                                                {card.title}
                                            </h3>
                                            <ul className="space-y-4">
                                                {card.items.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-3">
                                                        <Check size={15} className={`mt-0.5 flex-shrink-0 ${card.teal ? 'text-teal-500' : 'text-gray-500'}`} />
                                                        <span className="text-sm text-gray-300">{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </GlowCard>
                                </AnimateOnView>
                            ))}
                        </div>
                    </div>
                </Section>

                {/* ─── HOW IT WORKS ─────────────────────────────── */}
                <Section id="how-it-works" className="py-24 lg:py-32">
                    <div className="max-w-4xl mx-auto px-5">
                        <div className="text-center max-w-2xl mx-auto mb-16">
                            <AnimateOnView animation="slide-up">
                                <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5">Get Started in Minutes</h2>
                                <p className="text-gray-400 text-lg">A simple workflow to unlock powerful learning.</p>
                            </AnimateOnView>
                        </div>
                        <div className="space-y-0 relative">
                            {/* Vertical line */}
                            <div className="absolute left-[23px] top-8 bottom-8 w-px bg-gradient-to-b from-teal-500/20 via-white/[0.06] to-transparent hidden sm:block" />
                            {[
                                { num: '01', title: 'Build Your Knowledge Base', desc: 'Upload lecture notes, research papers, textbooks, or YouTube URLs to create your personalized knowledge source.', icon: BookOpen },
                                { num: '02', title: 'Interact & Analyze', desc: 'Chat with your documents, ask complex questions, generate mind maps, FAQs, and summaries.', icon: MessageCircle },
                                { num: '03', title: 'Generate & Create', desc: 'Create podcasts, presentations, quizzes, or export detailed analysis into DOCX and PPTX.', icon: FileText },
                                { num: '04', title: 'Level Up', desc: 'Earn XP, unlock skill tree nodes, defeat boss battles, and build daily learning streaks.', icon: Zap },
                            ].map((step, i) => (
                                <AnimateOnView key={step.num}
                                    animation="slide-up"
                                    delay={i * 100}
                                    className="flex gap-6 py-8 group">
                                    <div className="flex-shrink-0 relative z-10">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                                            i === 0
                                                ? 'bg-teal-500/10 border-teal-500/25 text-teal-400 group-hover:bg-teal-500/15 group-hover:shadow-lg group-hover:shadow-teal-500/10'
                                                : 'bg-white/[0.04] border-white/[0.08] text-gray-400 group-hover:bg-white/[0.06] group-hover:border-white/[0.12]'
                                        }`}>
                                            <step.icon size={18} />
                                        </div>
                                    </div>
                                    <div className="flex-1 border-b border-white/[0.04] pb-8">
                                        <span className={`text-xs font-mono font-bold ${i === 0 ? 'text-teal-500' : 'text-gray-600'}`}>{step.num}</span>
                                        <h3 className="text-lg font-bold text-white mt-1 mb-1.5">{step.title}</h3>
                                        <p className="text-sm text-gray-400 leading-relaxed max-w-md">{step.desc}</p>
                                    </div>
                                </AnimateOnView>
                            ))}
                        </div>
                    </div>
                </Section>

                {/* ─── CTA ──────────────────────────────────────── */}
                <Section className="py-24 lg:py-32">
                    <div className="max-w-3xl mx-auto px-5 text-center">
                        <div className="relative">
                            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-teal-500/20 via-white/[0.06] to-transparent" />
                            <div className="relative p-10 sm:p-16 rounded-2xl bg-[#0a0a0a] overflow-hidden">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(13,148,136,0.08),transparent_60%)]" />
                                <div className="relative">
                                    <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                                        Ready to Transform Your Learning?
                                    </h2>
                                    <p className="max-w-lg mx-auto text-gray-400 text-lg mb-8">
                                        Join students and educators leveraging AI to achieve academic success. Create your free account today.
                                    </p>
                                    <button onClick={() => onLoginClick(false)}
                                        className="group relative px-8 py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-xl shadow-black/30">
                                        <span className="absolute -inset-1 bg-teal-400/15 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
                                        <span className="relative">Sign Up and Get Started</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Section>
            </main>

            {/* ─── FOOTER ──────────────────────────────────── */}
            <footer className="py-10 border-t border-white/[0.04]">
                <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                            <Sparkles size={11} className="text-white" />
                        </div>
                        <span className="text-sm font-bold text-white">iMentor</span>
                    </div>
                    <p className="text-xs text-gray-600">© {new Date().getFullYear()} iMentor. Built for the academic community.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;