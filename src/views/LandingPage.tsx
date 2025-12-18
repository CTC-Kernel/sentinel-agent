import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { Spotlight } from '../components/ui/aceternity/Spotlight';
import { Button } from '../components/ui/button';
import { Lock, ArrowRight, Sun, Moon, Shield, CheckCircle2 } from '../components/ui/Icons';
import { SparklesCore } from '../components/ui/aceternity/Sparkles';
import { ContainerScroll } from '../components/ui/aceternity/ContainerScroll';
import { BorderBeam } from '../components/ui/aceternity/BorderBeam';
import { SEO } from '../components/SEO';
import { LandingDashboardMockup } from '../components/landing/LandingDashboardMockup';
import { useStore } from '../store';
import { motion } from 'framer-motion';

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useStore();

    return (
        <AuroraBackground className="min-h-screen font-apple selection:bg-brand-500 selection:text-white !block !h-auto overflow-hidden bg-slate-950">
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
                <div className="max-w-7xl mx-auto flex items-center justify-between glass-panel px-5 py-3 md:px-8 md:py-4 rounded-full border border-white/10 shadow-glass-sm mt-2 md:mt-4 bg-slate-900/50 backdrop-blur-md">
                    <div className="flex items-center space-x-2 md:space-x-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-lg ring-1 ring-white/20">
                            <Lock className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
                        </div>
                        <span className="text-lg md:text-xl font-bold tracking-tight text-white">Sentinel GRC</span>
                    </div>
                    <div className="flex items-center space-x-2 md:space-x-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full text-slate-400 hover:bg-white/10 transition-colors"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </nav>

            <div className="relative z-10">
                <ContainerScroll
                    titleComponent={
                        <div className="flex flex-col items-center justify-center space-y-8 mb-10">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5 }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors cursor-default shadow-lg shadow-brand-500/10"
                            >
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-sm font-medium text-slate-300 tracking-wide uppercase text-[10px] md:text-xs">Système Opérationnel</span>
                            </motion.div>

                            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-none tracking-tight text-center max-w-5xl mx-auto">
                                Bienvenue sur <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-blue-400 to-brand-400 animate-gradient-x">Sentinel GRC</span>
                            </h1>

                            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed text-center">
                                Le centre de commande nouvelle génération pour votre gouvernance cyber.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto pt-4 relative z-20">
                                <Button
                                    onClick={() => navigate('/login')}
                                    size="lg"
                                    className="h-14 px-8 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-lg hover:scale-105 transition-all shadow-[0_0_30px_-5px_rgba(79,70,229,0.4)] w-full sm:w-auto relative overflow-hidden group border border-white/10"
                                >
                                    <span className="relative z-10 flex items-center">
                                        Accéder à l'espace
                                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                                </Button>
                                <Button onClick={() => navigate('/login?mode=signup')} variant="ghost" size="lg" className="h-14 px-8 rounded-2xl text-slate-400 hover:text-white hover:bg-white/5 font-bold text-lg w-full sm:w-auto border border-transparent hover:border-white/10 transition-all">
                                    Créer un compte
                                </Button>
                            </div>
                        </div>
                    }
                >
                    <div className="w-full h-full relative group">
                        <LandingDashboardMockup />
                        <BorderBeam duration={8} size={400} />

                        {/* Floating Glass Cards - 3D Parallax Effect */}
                        <motion.div
                            className="absolute -right-4 md:-right-12 top-20 md:top-12 p-4 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-20 max-w-[200px] hidden md:block"
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                                    <Shield className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-white">Score Global</span>
                            </div>
                            <div className="text-2xl font-bold text-white">92%</div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full mt-2 overflow-hidden">
                                <div className="h-full w-[92%] bg-emerald-500 rounded-full"></div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="absolute -left-4 md:-left-12 bottom-20 md:bottom-12 p-4 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-20 max-w-[200px] hidden md:block"
                            animate={{ y: [0, 10, 0] }}
                            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-brand-500/20 text-brand-400">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold text-white">Conformité ISO</span>
                            </div>
                            <div className="text-xs text-slate-400">Audit interne terminé avec succès.</div>
                        </motion.div>
                    </div>
                </ContainerScroll>
            </div>

        </AuroraBackground>
    );
};
