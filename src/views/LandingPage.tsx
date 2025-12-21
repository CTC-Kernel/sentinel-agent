import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Button } from '../components/ui/button';
import { Shield, Lock, Activity, Layers, CheckCircle2, ChevronRight } from '../components/ui/Icons';
import { SEO } from '../components/SEO';
import { LandingDashboardMockup } from '../components/landing/LandingDashboardMockup';
import { HolographicShield } from '../components/landing/HolographicShield';
import { FloatingLabelInput } from '../components/ui/FloatingLabelInput';

const FeatureCard = ({ icon: Icon, title, description, delay }: { icon: LucideIcon, title: string, description: string, delay: string }) => (
    <div className={`glass-panel p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl backdrop-saturate-150 hover:bg-white/90 dark:hover:bg-white/10 hover:border-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/10 dark:hover:shadow-brand-500/10 transition-all duration-500 group animate-slide-up flex flex-col items-start relative hover:z-20`} style={{ animationDelay: delay }}>
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-500/10 to-blue-500/10 dark:from-brand-500/20 dark:to-purple-500/20 text-brand-600 dark:text-brand-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 mb-6 ring-1 ring-brand-500/10 dark:ring-white/10 shadow-glow">
            <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-slate-300 transition-colors">{description}</p>
    </div>
);

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen font-apple selection:bg-brand-500 selection:text-white overflow-x-hidden">
            <MasterpieceBackground />
            <SEO
                title="Sentinel GRC — Gouvernance Cyber Souveraine"
                description="Reprenez le contrôle. La plateforme GRC conçue comme un centre de commandement pour votre cybersécurité et conformité ISO 27001."
            />

            {/* Top Bar - Minimalist */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 animate-fade-in">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-3 backdrop-blur-md bg-white/10 dark:bg-black/20 px-4 py-2 rounded-full border border-white/10 shadow-glass-sm">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg">
                            <Lock className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Sentinel GRC</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={() => navigate('/login')} className="text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors px-4 py-2 hidden sm:block">
                            Connexion
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section - The Command Center Entrance */}
            <header className="min-h-screen relative flex flex-col items-center justify-center pt-24 pb-20 px-6">
                <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    {/* Left Column: The "Pitch" */}
                    <div className="text-left space-y-8 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50/50 dark:bg-white/5 border border-brand-500/30 backdrop-blur-md animate-fade-in hover:bg-slate-100/50 dark:hover:bg-white/10 transition-colors cursor-default shadow-glow">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">Système Opérationnel</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-200 dark:to-slate-400 tracking-tighter leading-[1] drop-shadow-sm animate-slide-up">
                            REPRENEZ <br />
                            LE <span className="text-brand-600 dark:text-brand-500">CONTRÔLE</span>.
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 leading-relaxed font-light animate-slide-up" style={{ animationDelay: '0.1s' }}>
                            La première plateforme GRC conçue comme un <strong className="text-slate-900 dark:text-white font-semibold">Centre de Commandement Cyber</strong>. Audits, Risques, ISO 27001 — pilotés avec une précision militaire.
                        </p>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                            <div className="relative flex-grow max-w-md group">
                                <FloatingLabelInput
                                    label="Votre email professionnel"
                                    id="hero-email"
                                    className="w-full"
                                />
                                <div className="absolute right-2 top-2 bottom-2">
                                    <Button onClick={() => navigate('/login')} size="sm" className="h-full rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold hover:scale-105 transition-transform shadow-lg">
                                        Initialiser
                                        <ChevronRight className="ml-1 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <span className="text-sm text-slate-400 font-medium px-2">ou</span>
                            <button onClick={() => navigate('/login')} className="text-sm font-bold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors underline underline-offset-4 decoration-2 decoration-transparent hover:decoration-current">
                                Démo Rapide
                            </button>
                        </div>

                        <div className="pt-8 flex items-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Élu par</span>
                            <div className="flex -space-x-4">
                                {/* Pseud-avatars or logos could go here for social proof */}
                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-black"></div>
                                <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-black"></div>
                                <div className="w-10 h-10 rounded-full bg-slate-400 dark:bg-slate-500 border-2 border-white dark:border-black flex items-center justify-center text-[10px] font-bold text-white">+500</div>
                            </div>
                            <span className="text-sm font-medium text-slate-500">Leaders Cybersécurité</span>
                        </div>
                    </div>

                    {/* Right Column: The "Visual" */}
                    <div className="relative hidden lg:flex items-center justify-center h-full animate-in fade-in zoom-in duration-1000 delay-300">
                        {/* Holographic Shield as the central visual anchor */}
                        <div className="relative z-10 transform hover:scale-105 transition-transform duration-700 hover:rotate-2">
                            <HolographicShield />

                            {/* Floating "Status" Cards */}
                            <div className="absolute -top-10 -right-10 glass-panel p-4 rounded-2xl animate-float animation-delay-1000 border border-emerald-500/30">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">ISO 27001: Conforme</span>
                                </div>
                            </div>

                            <div className="absolute -bottom-10 -left-10 glass-panel p-4 rounded-2xl animate-float animation-delay-2000 border border-brand-500/30">
                                <div className="flex items-center gap-3">
                                    <Activity className="w-4 h-4 text-brand-500" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Risques: Monitorés</span>
                                </div>
                            </div>
                        </div>

                        {/* Background Glow */}
                        <div className="absolute inset-0 bg-brand-500/20 blur-[120px] rounded-full -z-10 animate-pulse-slow"></div>
                    </div>
                </div>
            </header>

            {/* Mockup Section - "The Console" */}
            <section className="relative z-10 py-20 px-6">
                <div className="max-w-6xl mx-auto relative group perspective-1000">
                    <div className="absolute inset-x-0 -top-40 h-[500px] bg-gradient-to-b from-transparent via-brand-500/5 to-transparent pointer-events-none"></div>

                    <div className="relative rounded-[1.5rem] border border-slate-200/50 dark:border-white/10 bg-slate-900 shadow-2xl overflow-hidden transform transition-all duration-1000 group-hover:rotate-x-2 group-hover:scale-[1.01] shadow-brand-500/20">
                        <div className="absolute inset-0 bg-grid-white/[0.05] pointer-events-none"></div>
                        <LandingDashboardMockup aria-hidden="true" />

                        {/* Reflection Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60"></div>
                    </div>
                </div>
            </section>

            {/* Core Capabilities - Simplified & Direct */}
            <section className="relative z-10 py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20 max-w-3xl mx-auto space-y-6">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                            L'Arsenal <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-purple-500">Complet</span>.
                        </h2>
                        <p className="text-xl text-slate-600 dark:text-slate-400 font-light">
                            Tout ce dont vous avez besoin pour gouverner, centralisé dans une interface digne de la NSA.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={Layers}
                            title="Cartographie Totale"
                            description="Vision à 360° de vos actifs. Fini les angles morts. Une maîtrise absolue de votre périmètre."
                            delay="0s"
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Guerre aux Risques"
                            description="ISO 27005 pilotée par IA. Identifiez, analysez et neutralisez les menaces avant qu'elles ne frappent."
                            delay="0.1s"
                        />
                        <FeatureCard
                            icon={CheckCircle2}
                            title="Conformité Continue"
                            description="Ne subissez plus les audits. Soyez prêt chaque jour, avec des preuves générées automatiquement."
                            delay="0.2s"
                        />
                    </div>
                </div>
            </section>

            {/* Trust Footer */}
            <footer className="relative z-10 py-12 border-t border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-black/50 backdrop-blur-lg">
                <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center space-y-6">
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">Opérationnel dans toute l'Europe</p>
                    <div className="flex gap-8 grayscale opacity-50">
                        {/* Placeholder Logos */}
                        <div className="h-8 w-24 bg-slate-300 dark:bg-slate-700 rounded"></div>
                        <div className="h-8 w-24 bg-slate-300 dark:bg-slate-700 rounded"></div>
                        <div className="h-8 w-24 bg-slate-300 dark:bg-slate-700 rounded"></div>
                        <div className="h-8 w-24 bg-slate-300 dark:bg-slate-700 rounded"></div>
                    </div>
                    <p className="text-xs text-slate-400 pt-8">
                        © 2024 Sentinel GRC. Cyber Threat Consulting.
                    </p>
                </div>
            </footer>
        </div>
    );
};
