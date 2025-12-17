import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { Spotlight } from '../components/ui/aceternity/Spotlight';
import { Button } from '../components/ui/button';
import { Lock, ArrowRight, Sun, Moon } from '../components/ui/Icons';
import { SparklesCore } from '../components/ui/aceternity/Sparkles';
import { SEO } from '../components/SEO';
import { LandingDashboardMockup } from '../components/landing/LandingDashboardMockup';
import { useStore } from '../store';
import { motion } from 'framer-motion';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useStore();

    return (
        <AuroraBackground className="min-h-screen font-apple selection:bg-brand-500 selection:text-white !block !h-auto overflow-hidden">
            <SEO
                title="Sentinel GRC — Accès Sécurisé"
                description="Portail d'accès sécurisé à votre espace de gouvernance Sentinel GRC."
            />

            <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill={theme === 'dark' ? "white" : "#3b82f6"} />

            <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
                <SparklesCore
                    id="tsparticleslanding"
                    background="transparent"
                    particleColor={theme === 'dark' ? "#FFFFFF" : "#0ea5e9"}
                    minSize={theme === 'dark' ? 0.6 : 0.4}
                    maxSize={theme === 'dark' ? 1.4 : 1.0}
                    particleDensity={theme === 'dark' ? 20 : 15}
                />
            </div>

            {/* Minimal Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-4 md:px-6 md:py-6 transition-all duration-300">
                <div className="max-w-7xl mx-auto flex items-center justify-between glass-panel px-5 py-3 md:px-8 md:py-4 rounded-full border border-white/20 shadow-glass-sm mt-2 md:mt-4">
                    <div className="flex items-center space-x-2 md:space-x-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg">
                            <Lock className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
                        </div>
                        <span className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-white">Sentinel GRC</span>
                    </div>
                    <div className="flex items-center space-x-2 md:space-x-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Onboarding Hero Section */}
            <div className="min-h-screen relative flex flex-col items-center justify-center pt-32 pb-10 px-4">
                <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8 animate-fade-in">

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-6"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50/50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 backdrop-blur-md mb-4 hover:bg-slate-100/50 dark:hover:bg-white/10 transition-colors cursor-default shadow-sm shadow-brand-500/5">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 tracking-wide">Système Opérationnel</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 tracking-tight leading-[1.1] drop-shadow-sm">
                            Bienvenue sur <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-blue-500 to-brand-600 dark:from-brand-400 dark:via-blue-400 dark:to-brand-400 animate-gradient-x">Sentinel GRC</span>
                        </h1>

                        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                            Votre centre de commande unifié pour la gouvernance, la gestion des risques et la conformité.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <Button onClick={() => navigate('/login')} size="lg" className="h-14 px-8 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-brand-500/20 w-full sm:w-auto">
                                Accéder à l'espace sécurisé
                                <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                            </Button>
                            <Button onClick={() => navigate('/login?mode=signup')} variant="ghost" size="lg" className="h-14 px-8 rounded-2xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-lg w-full sm:w-auto">
                                Créer un compte
                            </Button>
                        </div>
                    </motion.div>

                    {/* Dashboard Preview Mockup - Centered & Heroic */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="mt-16 relative mx-auto w-full max-w-6xl perspective-1000"
                    >
                        <div className="relative rounded-[1.5rem] border border-white/10 bg-slate-900/40 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5 overflow-hidden h-auto min-h-[400px] md:min-h-[600px] md:aspect-[16/10] group transform transition-all duration-700 hover:scale-[1.01] hover:shadow-[0_20px_50px_-12px_rgba(79,70,229,0.3)]">
                            <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 via-transparent to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-10 mix-blend-overlay"></div>
                            {/* Mask overlay to focus attention on center/top if needed, or keeping full visibility */}
                            <LandingDashboardMockup aria-hidden="true" />

                            {/* Glass overlay with Login prompt on hover? No, keep it clean visuals */}
                        </div>
                        {/* Decorative glow behind mockup */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-brand-500/20 blur-[100px] -z-10 rounded-full opacity-40"></div>
                    </motion.div>

                </div>
            </div>

            {/* Minimal Footer */}
            <footer className="relative z-10 py-8 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    © 2024 Sentinel GRC. Accès restreint et sécurisé.
                </p>
            </footer>

        </AuroraBackground>
    );
};
