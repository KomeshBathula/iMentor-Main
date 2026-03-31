// frontend/src/components/landing/LandingNav.jsx
import React, { useState } from 'react';
import { Sparkles, Menu, X } from 'lucide-react';
import Button from '../core/Button';
import Animate from '../core/Animate.jsx';

const LandingNav = ({ onLoginClick }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navItems = ["Tutor", "Challenges", "Bounties", "Roadmap", "Features"];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-xl border-b border-white/5">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo with enhanced styling */}
                    <a href="#home" className="flex items-center gap-2.5 group">
                        <div className="relative">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white to-gray-400 flex items-center justify-center shadow-lg shadow-white/10">
                                <Sparkles size={16} className="text-black" />
                            </div>
                            {/* Subtle glow on hover */}
                            <div className="absolute inset-0 rounded-lg bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                        <span className="text-xl font-bold text-white tracking-tight">
                            iMentor
                        </span>
                    </a>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-1">
                        {navItems.map(item => (
                            <a
                                key={item}
                                href={`#${item.toLowerCase().replace(' ', '-')}`}
                                className="relative px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200 group"
                            >
                                {item}
                                {/* Animated underline on hover */}
                                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-white/50 group-hover:w-4/5 transition-all duration-300 rounded-full" />
                            </a>
                        ))}
                    </div>

                    {/* Auth Buttons */}
                    <div className="hidden md:flex items-center space-x-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onLoginClick(true)}
                            className="text-white hover:text-white hover:bg-white/10 transition-all font-medium"
                        >
                            Login
                        </Button>
                        <div
                            className="group relative hover:scale-[1.02] active:scale-[0.98] transition-transform"
                        >
                            {/* Subtle glow behind Sign Up */}
                            <div className="absolute -inset-0.5 bg-white/10 rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <Button
                                variant="monochrome-outline"
                                size="sm"
                                onClick={() => onLoginClick(false)}
                                className="relative bg-white text-black hover:bg-gray-100 border-none font-medium shadow-lg shadow-black/20"
                            >
                                Sign Up
                            </Button>
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="text-white p-2 hover:bg-white/5 rounded-lg transition-colors"
                        >
                            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu */}
            <Animate
                show={isMenuOpen}
                unmount
                animation="height-in"
                className="md:hidden border-t border-white/5 bg-black/95 backdrop-blur-xl"
            >
                        <div className="px-4 py-4 space-y-1">
                            {navItems.map(item => (
                                <a
                                    key={item}
                                    href={`#${item.toLowerCase().replace(' ', '-')}`}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="block px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                >
                                    {item}
                                </a>
                            ))}
                            <div className="flex items-center gap-2 pt-3 border-t border-white/5 mt-3">
                                <Button
                                    fullWidth
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { onLoginClick(true); setIsMenuOpen(false); }}
                                    className="text-white hover:bg-white/10"
                                >
                                    Login
                                </Button>
                                <Button
                                    fullWidth
                                    variant="monochrome-outline"
                                    size="sm"
                                    onClick={() => { onLoginClick(false); setIsMenuOpen(false); }}
                                    className="bg-white text-black border-none hover:bg-gray-100"
                                >
                                    Sign Up
                                </Button>
                            </div>
                        </div>
                    </div>
            </Animate>
        </header>
    );
};

export default LandingNav;