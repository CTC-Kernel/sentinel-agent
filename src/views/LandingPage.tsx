import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { Spotlight } from '../components/ui/aceternity/Spotlight';
import { Button } from '../components/ui/button';
import { Shield, Lock, FileText, Activity, Layers, ArrowRight, CheckCircle2 } from '../components/ui/Icons';
import { SparklesCore } from '../components/ui/aceternity/Sparkles';
import { SEO } from '../components/SEO';

const FeatureCard = ({ icon: Icon, title, description, delay }: { icon: any, title: string, description: string, delay: string }) => (
    <div className={`glass-panel p-8 rounded-[2rem] border border-white/20 hover:border-brand-500/50 hover:shadow-glow-sm transition-all duration-500 group animate-slide-up`} style={{ animationDelay: delay }}>
        <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-6 text-brand-600 group-hover:scale-110 transition-transform duration-500">
            <Icon className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
);

const BenefitItem = ({ text }: { text: string }) => (
    <div className="flex items-center space-x-3 text-slate-700 dark:text-slate-300">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
        <span className="font-medium">{text}</span>
    </div>
);

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background relative overflow-hidden font-sans selection:bg-brand-500 selection:text-white">
            <SEO
                title="Sentinel GRC - Orchestration de Gouvernance Cyber"
                description="La plateforme GRC nouvelle génération pour piloter votre cybersécurité, risques et conformité ISO 27001."
            />

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 transition-all duration-300">
                <div className="max-w-7xl mx-auto flex items-center justify-between glass-panel px-8 py-4 rounded-full border border-white/20 shadow-glass-sm mt-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg">
                            <Lock className="h-5 w-5" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Sentinel GRC</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={() => navigate('/login')} className="text-sm font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors px-4 py-2">
                            Se connecter
                        </button>
                        <Button onClick={() => navigate('/login')} className="rounded-full px-6 bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg shadow-brand-500/20">
                            Commencer
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <AuroraBackground className="min-h-screen flex flex-col items-center justify-center relative pt-32 pb-20">
                <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />

                <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <SparklesCore
                        id="tsparticleslanding"
                        background="transparent"
                        minSize={0.6}
                        maxSize={1.4}
                        particleDensity={40}
                        className="w-full h-full absolute inset-0"
                        particleColor="#FFFFFF"
                    />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-8">
                    <div className="inline-flex items-center px-4 py-2 rounded-full glass-panel border border-brand-500/30 text-brand-600 dark:text-brand-400 text-sm font-bold uppercase tracking-wider mb-4 animate-fade-in">
                        <span className="relative flex h-2 w-2 mr-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                        </span>
                        Nouvelle Génération GRC
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight animate-slide-up opacity-0" style={{ animationFillMode: 'forwards' }}>
                        Orchestrez votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-400">Gouvernance Cyber</span> comme un centre de commande.
                    </h1>

                    <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed animate-slide-up opacity-0" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                        Cartographie dynamique, registres ISO 27001 IA, et pilotage des risques en temps réel. La sécurité n'a jamais été aussi claire.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
                        <Button onClick={() => navigate('/login')} size="lg" className="h-14 px-8 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-brand-500/10 w-full sm:w-auto">
                            Démarrer gratuitement
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                        <Button variant="outline" size="lg" className="h-14 px-8 rounded-2xl border-slate-300 dark:border-white/20 hover:bg-slate-50 dark:hover:bg-white/10 font-bold text-lg text-slate-700 dark:text-white w-full sm:w-auto">
                            Découvrir la démo
                        </Button>
                    </div>

                    {/* Dashboard Preview Mockup */}
                    <div className="mt-20 relative mx-auto w-full max-w-5xl animate-slide-up opacity-0" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
                        <div className="relative rounded-[2rem] border border-white/20 bg-white/10 backdrop-blur-md shadow-2xl overflow-hidden aspect-[16/9] group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                            {/* Placeholder for actual dashboard screenshot */}
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium bg-slate-100/50 dark:bg-slate-900/50">
                                <div className="text-center space-y-4">
                                    <Activity className="h-16 w-16 mx-auto opacity-50" />
                                    <p>Interface Dashboard Haute Fidélité</p>
                                </div>
                            </div>
                        </div>
                        {/* Decorative glow behind mockup */}
                        <div className="absolute -inset-4 bg-gradient-to-r from-brand-500 to-purple-600 rounded-[2.5rem] blur-2xl opacity-20 -z-10"></div>
                    </div>
                </div>
            </AuroraBackground>

            {/* Features Grid */}
            <section className="py-32 px-6 relative bg-white dark:bg-background">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20 max-w-3xl mx-auto space-y-4">
                        <h2 className="text-4xl font-bold text-slate-900 dark:text-white">Tout ce dont vous avez besoin pour sécuriser votre organisation</h2>
                        <p className="text-lg text-slate-600 dark:text-slate-400">Une suite complète d'outils intégrés pour simplifier chaque aspect de votre conformité.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={Layers}
                            title="Gestion des Actifs"
                            description="Inventaire dynamique et classification automatique. Liez vos actifs aux risques et projets en un clic."
                            delay="0s"
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Analyse de Risques IA"
                            description="Méthode ISO 27005 pilotée par l'IA. Évaluation automatique des impacts et probabilités."
                            delay="0.1s"
                        />
                        <FeatureCard
                            icon={CheckCircle2}
                            title="Conformité ISO 27001"
                            description="Suivi en temps réel de votre annexe A. Génération automatique du Statement of Applicability (SoA)."
                            delay="0.2s"
                        />
                        <FeatureCard
                            icon={Activity}
                            title="Projets SSI & SLA"
                            description="Suivez vos plans d'actions et le respect des SLA. Tableaux de bord pour le COMEX."
                            delay="0.3s"
                        />
                        <FeatureCard
                            icon={FileText}
                            title="Audits & Rapports"
                            description="Générez des preuves d'audit et des rapports PDF professionnels prêts pour la certification."
                            delay="0.4s"
                        />
                        <FeatureCard
                            icon={Lock}
                            title="RBAC & Sécurité"
                            description="Gestion fine des permissions par rôles. Séparez les responsabilités (RSSI, DPO, Auditeur)."
                            delay="0.5s"
                        />
                    </div>
                </div>
            </section>

            {/* Trust/Social Proof Section */}
            <section className="py-24 bg-slate-50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Pourquoi les leaders de la sécurité choisissent Sentinel</h2>
                        <div className="space-y-4">
                            <BenefitItem text="Conformité prête pour l'audit (ISO, SOC2, NIS2)" />
                            <BenefitItem text="Réduction de 40% du temps de gestion administrative" />
                            <BenefitItem text="Visibilité temps réel pour le COMEX" />
                            <BenefitItem text="Collaboration fluide entre équipes IT et Métier" />
                        </div>
                        <Button size="lg" className="rounded-2xl px-8 bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg">
                            Rejoindre l'élite de la cybersécurité
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col justify-center items-center text-center h-32">
                            <span className="text-3xl font-bold text-slate-900 dark:text-white mb-1">500+</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Audits Réussis</span>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col justify-center items-center text-center h-32">
                            <span className="text-3xl font-bold text-slate-900 dark:text-white mb-1">10k+</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Risques Traités</span>
                        </div>
                        <div className="col-span-2 p-6 bg-brand-600 rounded-2xl shadow-lg border border-brand-500 flex flex-col justify-center items-center text-center h-32 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-brand-600 to-indigo-600"></div>
                            <span className="relative z-10 text-3xl font-bold text-white mb-1">100%</span>
                            <span className="relative z-10 text-xs font-bold uppercase tracking-wider text-brand-100">Satisfaction Client</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white dark:bg-black py-12 border-t border-slate-200 dark:border-white/10">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center">
                            <Lock className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">Sentinel GRC</span>
                    </div>
                    <div className="flex space-x-8 text-sm font-medium text-slate-500">
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Fonctionnalités</a>
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Tarifs</a>
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contact</a>
                        <a href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">Légal</a>
                    </div>
                    <p className="text-xs text-slate-400">© 2024 Sentinel GRC. Tous droits réservés.</p>
                </div>
            </footer>
        </div>
    );
};
