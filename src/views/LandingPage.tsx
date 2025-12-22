import React from 'react';

import { LucideIcon } from 'lucide-react';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Shield, Layers, CheckCircle2 } from '../components/ui/Icons';
import { SEO } from '../components/SEO';
import { LandingDashboardMockup } from '../components/landing/LandingDashboardMockup';
import { SystemEntrance } from '../components/landing/SystemEntrance';

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
    return (
        <div className="min-h-screen font-apple selection:bg-brand-500 selection:text-white overflow-x-hidden">
            <MasterpieceBackground />
            <SEO
                title="Sentinel GRC — Gouvernance Cyber Souveraine"
                description="Reprenez le contrôle. La plateforme GRC conçue comme un centre de commandement pour votre cybersécurité et conformité ISO 27001."
            />

            {/* Top Bar - Minimalist Status for non-hero sections maybe? No, SystemEntrance takes over whole screen first fold. */}

            {/* Hero Section - The Command Center Entrance */}
            <header className="relative min-h-screen">
                <SystemEntrance />
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
