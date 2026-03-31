// frontend/src/components/gamification/BadgeTotem.jsx
import React, { useEffect, useState } from 'react';
import Animate from '../core/Animate.jsx';
import { Sparkles } from 'lucide-react';

const BadgeTotem = ({ badge, onComplete }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (badge) {
            setShow(true);
            const timer = setTimeout(() => {
                setShow(false);
                setTimeout(onComplete, 500);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [badge, onComplete]);

    if (!badge) return null;

    return (
        <Animate show={show} unmount animation="fade-in">
            <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none">
                {/* Monochromatic Overlay Flash */}
                <div className="absolute inset-0 bg-white/20 dark:bg-black/60 animate-pulse" />

                {/* Main Totem Content */}
                <Animate animation="scale-in" className="relative flex flex-col items-center">
                    {/* Core Resonance Pulse */}
                    <div
                        className="absolute inset-0 bg-black dark:bg-white blur-[60px] rounded-full -z-10 animate-pulse"
                    />

                    {/* Icon Container */}
                    <div className="text-[10rem] mb-12 filter drop-shadow-[0_0_50px_rgba(255,255,255,0.4)] relative">
                        <div className="grayscale brightness-150">{badge.icon || '🏅'}</div>
                    </div>

                    {/* Badge Info Card */}
                    <Animate animation="slide-up" delay={400} className="bg-zinc-950/90 backdrop-blur-3xl px-16 py-10 rounded-[3.5rem] border border-white/10 text-center shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>

                        <div className="flex items-center justify-center gap-4 mb-6">
                            <Sparkles className="text-white opacity-40 animate-pulse" size={20} />
                            <span className="text-white font-black tracking-[0.5em] uppercase text-[9px] opacity-60">
                                Vector Synchronized
                            </span>
                            <Sparkles className="text-white opacity-40 animate-pulse" size={20} />
                        </div>

                        <h2 className="text-5xl font-black text-white uppercase tracking-tighter mb-4 leading-none">
                            {badge.name}
                        </h2>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest max-w-xs mx-auto leading-relaxed border-t border-white/5 pt-6">
                            {badge.description}
                        </p>
                    </Animate>

                    {/* Particle Field - CSS-only sparkle effect */}
                    <div className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none">
                        {[...Array(24)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-1.5 h-1.5 bg-white/40 dark:bg-white/60 transform rotate-45 shadow-[0_0_15px_rgba(255,255,255,0.5)] animate-ping"
                                style={{
                                    left: `${50 + (Math.random() - 0.5) * 80}%`,
                                    top: `${50 + (Math.random() - 0.5) * 80}%`,
                                    animationDelay: `${i * 100}ms`,
                                    animationDuration: `${2 + Math.random()}s`,
                                }}
                            />
                        ))}
                    </div>
                </Animate>
            </div>
        </Animate>
    );
};

export default BadgeTotem;
