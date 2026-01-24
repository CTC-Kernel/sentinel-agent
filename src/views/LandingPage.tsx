import React from 'react';

import { LucideIcon } from '../components/ui/Icons';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { Shield, Layers, CheckCircle2 } from '../components/ui/Icons';
import { SEO } from '../components/SEO';
import { LandingDashboardMockup } from '../components/landing/LandingDashboardMockup';
import { SystemEntrance } from '../components/landing/SystemEntrance';

const FeatureCard = ({ icon: Icon, title, description, delay }: { icon: LucideIcon, title: string, description: string, delay: string }) => (
    <div className={`glass-premium p-8 rounded-3xl bg-white/70 dark:bg-white/5 overflow-hidden transition-all duration-500 group animate-slide-up flex flex-col items-start relative hover:z-20`} style={{ animationDelay: delay }}>
        {/* Hover Highlight Line */}
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 group-hover:bg-brand-50 dark:group-hover:bg-brand-500/20 group-hover:text-brand-600 dark:group-hover:text-brand-400 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 mb-6 ring-1 ring-slate-200 dark:ring-white/10 group-hover:ring-brand-500/20 dark:group-hover:ring-brand-500/20">
            <span className="inline-flex" inert>
                <Icon className="h-8 w-8" />
            </span>
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-200 mb-3 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors font-mono tracking-tight">{title}</h3>
        <p className="text-slate-500 dark:text-muted-foreground leading-relaxed font-medium">{description}</p>
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
                    <div className="absolute inset-x-0 -top-40 h-[500px] bg-gradient-to-b from-transparent via-slate-200/50 dark:via-brand-500/5 to-transparent pointer-events-none"></div>

                    <div className="relative rounded-5xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-900 shadow-2xl overflow-hidden transform transition-all duration-1000 group-hover:rotate-x-2 group-hover:scale-[1.01] shadow-slate-200/50 dark:shadow-brand-500/10">
                        {/* Tech Corners Generic */}
                        <svg className="absolute top-8 left-8 w-6 h-6 text-slate-400/50 dark:text-white/20 z-20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                        <svg className="absolute top-8 right-8 w-6 h-6 text-slate-400/50 dark:text-white/20 rotate-90 z-20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                        <svg className="absolute bottom-8 left-8 w-6 h-6 text-slate-400/50 dark:text-white/20 -rotate-90 z-20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                        <svg className="absolute bottom-8 right-8 w-6 h-6 text-slate-400/50 dark:text-white/20 rotate-180 z-20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                        <div className="absolute inset-0 bg-grid-slate-900/[0.02] dark:bg-grid-white/[0.05] pointer-events-none z-10"></div>
                        <LandingDashboardMockup aria-hidden="true" />

                        {/* Reflection Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-100 via-transparent to-transparent dark:from-slate-900 dark:via-transparent dark:to-transparent opacity-60 z-10"></div>
                    </div>
                </div>
            </section>

            {/* Core Capabilities - Simplified & Direct */}
            <section className="relative z-10 py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20 max-w-3xl mx-auto space-y-6">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                            L'ARSENAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-600 to-slate-400 dark:from-white dark:to-slate-400">COMPLET</span>.
                        </h2>
                        <p className="text-xl text-slate-500 dark:text-muted-foreground font-mono text-sm tracking-wide uppercase">
                            Tout ce dont vous avez besoin pour gouverner.
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
            <footer className="relative z-10 py-12 border-t border-slate-200 dark:border-white/5 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-xl text-center">
                <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center space-y-6 sm:space-y-8">
                    <div className="w-12 h-1 bg-slate-300 dark:bg-slate-800 rounded-full"></div>
                    <p className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400 uppercase tracking-widest">Opérationnel dans toute l'Europe</p>

                    <p className="text-[10px] text-muted-foreground font-mono">
                        © 2022 SENTINEL GRC. CYBER THREAT CONSULTING.
                    </p>
                </div>
            </footer>
        </div>
    );
};
