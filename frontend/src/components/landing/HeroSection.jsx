// frontend/src/components/landing/HeroSection.jsx
import React from 'react';
import Button from '../core/Button';
import Animate from '../core/Animate.jsx';
import { ArrowRight } from 'lucide-react';

const HeroSection = ({ onLoginClick }) => {
    const headlineWords = ["Your", "AI", "Mentor", "for"];
    const subHeadlineWords = ["Limitless", "Learning"];

    return (
        <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden bg-black">

            {/* Animated Background Elements */}
            <div className="absolute inset-0 z-0">
                {/* Primary radial gradient spotlight from top */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.12),transparent)]" />

                {/* Secondary gradient from bottom corners */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(80,80,80,0.08),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(80,80,80,0.08),transparent_50%)]" />

                {/* Animated floating orbs */}
                <div
                    className="absolute top-[10%] left-[10%] w-[40vw] h-[40vw] rounded-full bg-white blur-[150px] animate-pulse opacity-[0.05]"
                />

                <div
                    className="absolute bottom-[10%] right-[10%] w-[35vw] h-[35vw] rounded-full bg-gray-400 blur-[130px] animate-pulse opacity-[0.04]"
                />

                <div
                    className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] rounded-full bg-gray-500 blur-[180px] animate-pulse opacity-[0.03]"
                />
            </div>

            {/* Grid Pattern with better visibility */}
            <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

            {/* Animated gradient ring behind content */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.03] animate-[spin_60s_linear_infinite]"
                style={{
                    background: "conic-gradient(from 0deg, transparent, white, transparent, white, transparent)"
                }}
            />

            {/* Subtle noise texture */}
            <div className="absolute inset-0 z-0 opacity-[0.02] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')]" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                <Animate
                    animation="slide-up"
                    duration="0.8s"
                    className="max-w-5xl mx-auto flex flex-col items-center justify-center"
                >
                    {/* Brand Name - iMentor - Centered Hero */}
                    <Animate
                        animation="scale-in"
                        duration="0.8s"
                        className="mb-6 relative"
                    >
                        {/* Animated glow ring behind brand */}
                        <div
                            className="absolute inset-0 blur-3xl bg-white/10 rounded-full -z-10 animate-pulse"
                        />
                        <span className="text-7xl sm:text-8xl lg:text-9xl xl:text-[10rem] font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-500 drop-shadow-2xl">
                            iMentor
                        </span>
                    </Animate>

                    {/* First line: Your AI Mentor for */}
                    <div
                        className="flex flex-wrap justify-center gap-x-2 sm:gap-x-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white/90"
                    >
                        {headlineWords.map((word, index) => (
                            <Animate
                                as="span"
                                key={index}
                                animation="slide-up"
                                stagger={80}
                                index={index}
                                delay={300}
                            >
                                {word}
                            </Animate>
                        ))}
                    </div>

                    {/* Second line: Limitless Learning */}
                    <div
                        className="flex flex-wrap justify-center gap-x-2 sm:gap-x-3 mt-1 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight"
                    >
                        {subHeadlineWords.map((word, index) => (
                            <Animate
                                as="span"
                                key={index}
                                animation="slide-up"
                                className="text-gray-400"
                                stagger={80}
                                index={headlineWords.length + index}
                                delay={300}
                            >
                                {word}
                            </Animate>
                        ))}
                    </div>

                    {/* Refined Subtitle */}
                    <Animate
                        as="p"
                        animation="slide-up"
                        delay={1200}
                        className="mt-8 max-w-xl mx-auto text-base lg:text-lg text-gray-500 leading-relaxed"
                    >
                        Learn through{' '}
                        <span className="text-gray-300">Socratic dialogue</span>,{' '}
                        <span className="text-gray-300">knowledge graphs</span>,{' '}
                        and{' '}
                        <span className="text-gray-300">gamified progression</span>.
                    </Animate>

                    {/* Enhanced CTA Buttons */}
                    <Animate
                        animation="slide-up"
                        delay={1400}
                        className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4"
                    >
                        {/* Primary CTA with glow */}
                        <div
                            className="group relative hover:scale-[1.03] active:scale-[0.97] transition-transform"
                        >
                            {/* Glow effect behind button */}
                            <div className="absolute -inset-1 bg-white/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <Button
                                size="lg"
                                variant="monochrome-outline"
                                onClick={() => onLoginClick(false)}
                                className="relative shadow-2xl shadow-black/30 text-lg px-8 py-4 h-auto bg-white text-black hover:bg-gray-100 border-none font-semibold rounded-xl"
                                rightIcon={<ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" />}
                            >
                                Start Learning Now
                            </Button>
                        </div>

                        {/* Secondary CTA with hover fill */}
                        <a
                            href="#tutor"
                            className="group inline-flex items-center justify-center rounded-xl border border-white/20 px-8 py-4 text-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 hover:border-white/40 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 h-auto"
                        >
                            See How It Works
                        </a>
                    </Animate>
                </Animate>
            </div>

            {/* Scroll Indicator */}
            <div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-600 animate-bounce"
            >
                <div className="w-6 h-10 border-2 border-current rounded-full flex justify-center p-1.5">
                    <div
                        className="w-1.5 h-2.5 bg-current rounded-full animate-pulse"
                    />
                </div>
            </div>
        </section>
    );
};

export default HeroSection;