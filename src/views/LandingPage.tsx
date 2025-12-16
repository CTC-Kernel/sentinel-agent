import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { Spotlight } from '../components/ui/aceternity/Spotlight';
import { Button } from '../components/ui/button';
import { Shield, Lock, FileText, Activity, Layers, ArrowRight, CheckCircle2, Sun, Moon } from '../components/ui/Icons';
import { SparklesCore } from '../components/ui/aceternity/Sparkles';
import { SEO } from '../components/SEO';
import { LandingDashboardMockup } from '../components/landing/LandingDashboardMockup';
import { useStore } from '../store';

const FeatureCard = ({ icon: Icon, title, description, delay }: { icon: LucideIcon, title: string, description: string, delay: string }) => (
    <div className={`glass-panel p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-xl backdrop-saturate-150 hover:bg-white/90 dark:hover:bg-white/10 hover:border-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/10 dark:hover:shadow-brand-500/10 transition-all duration-500 group animate-slide-up flex flex-col items-start relative hover:z-20`} style={{ animationDelay: delay }}>
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-500/10 to-purple-500/10 dark:from-brand-500/20 dark:to-purple-500/20 text-brand-600 dark:text-brand-400 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 mb-6 ring-1 ring-brand-500/10 dark:ring-white/10">
            <Icon className="h-8 w-8" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-slate-300 transition-colors">{description}</p>
    </div>
);

const BenefitItem = ({ text }: { text: string }) => (
    <div className="flex items-center space-x-3 text-slate-700 dark:text-slate-300">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" aria-hidden="true" />
        <span className="font-medium">{text}</span>
    </div>
);

export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useStore();

    return (
        <AuroraBackground className="min-h-screen font-apple selection:bg-brand-500 selection:text-white !block !h-auto">
            <SEO
                title="Sentinel GRC — Ne subissez plus votre conformité"
                description="Le centre de commande unifié pour piloter risques, audits, actifs et conformité (ISO 27001 / ISO 27005) avec une sécurité by design."
                structuredData={{
                    "@context": "https://schema.org",
                    "@type": "SoftwareApplication",
                    "name": "Sentinel GRC",
                    "applicationCategory": "BusinessApplication",
                    "operatingSystem": "Web",
                    "offers": {
                        "@type": "Offer",
                        "price": "0",
                        "priceCurrency": "EUR",
                        "description": "Demo gratuite disponible"
                    },
                    "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": "5",
                        "reviewCount": "500"
                    }
                }}
            />

            <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="white" />

            <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
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

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 transition-all duration-300">
                <div className="max-w-7xl mx-auto flex items-center justify-between glass-panel px-8 py-4 rounded-full border border-white/20 shadow-glass-sm mt-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg">
                            <Lock className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Sentinel GRC</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </button>
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
            <header className="min-h-screen relative flex flex-col items-center justify-center pt-20">
                <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50/50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 backdrop-blur-md mb-8 animate-fade-in hover:bg-slate-100/50 dark:hover:bg-white/10 transition-colors cursor-default shadow-sm shadow-brand-500/5">
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-600 dark:bg-brand-500"></span>
                        </span>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 tracking-wide">Nouvelle Génération GRC</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 tracking-tight mb-8 leading-[1.1] drop-shadow-sm animate-slide-up">
                        L'Art de la <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-purple-600 to-brand-600 dark:from-brand-400 dark:via-purple-400 dark:to-brand-400 animate-gradient-x pb-2">Gouvernance</span> & <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 dark:from-blue-400 dark:via-cyan-400 dark:to-blue-400 animate-gradient-x pb-2">Cybersécurité</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        Pilotez votre conformité ISO 27001 et vos risques avec une élégance et une précision inégalées. Une plateforme conçue pour l'excellence.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-slide-up opacity-0" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
                        <Button onClick={() => navigate('/login')} size="lg" className="h-14 px-8 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-brand-500/10 w-full sm:w-auto">
                            Créer mon compte
                            <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                        </Button>
                    </div>

                </div>

                {/* Dashboard Preview Mockup */}
                <div className="mt-24 relative mx-auto w-full max-w-6xl animate-slide-up opacity-0 perspective-1000" style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}>
                    <div className="relative rounded-[1.5rem] border border-white/10 bg-slate-900/40 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5 overflow-hidden h-[800px] md:h-auto md:aspect-[16/10] group transform transition-all duration-700 hover:scale-[1.01] hover:shadow-[0_20px_50px_-12px_rgba(79,70,229,0.3)]">
                        <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/10 via-transparent to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-10 mix-blend-overlay"></div>
                        <LandingDashboardMockup aria-hidden="true" />
                    </div>
                    {/* Decorative glow behind mockup */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-brand-500/20 blur-[100px] -z-10 rounded-full opacity-40"></div>
                </div>
            </header>

            {/* Features Grid */}
            <section className="relative z-10 py-32 px-6 bg-transparent">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20 max-w-3xl mx-auto space-y-4">
                        <h2 className="text-4xl font-bold text-slate-900 dark:text-white">La GRC blindée et intelligente</h2>
                        <p className="text-lg text-slate-600 dark:text-slate-400">Passez d'une conformité subie à une gouvernance pilotée : centralisation totale, IA opérationnelle, et sécurité intransigeante.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={Layers}
                            title="Centralisation Totale"
                            description="Risques, audits, projets et actifs réconciliés au même endroit. Fini les silos et les fichiers éparpillés."
                            delay="0s"
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Puissance de l'IA"
                            description="ISO 27005 native : registres, plans de traitement et priorisation accélérés. Plus de précision, moins de temps perdu."
                            delay="0.1s"
                        />
                        <FeatureCard
                            icon={CheckCircle2}
                            title="Clarté pour le COMEX"
                            description="Tableaux de bord lisibles et traçables : transformez l'obscurité technique en clarté décisionnelle."
                            delay="0.2s"
                        />
                        <FeatureCard
                            icon={Activity}
                            title="Pilotage par SLA"
                            description="Plans d'actions, jalons, échéances et responsabilités. La conformité devient un système de pilotage, pas un dossier."
                            delay="0.3s"
                        />
                        <FeatureCard
                            icon={FileText}
                            title="Audit-Ready"
                            description="Preuves, historiques et rapports prêts à envoyer au certificateur. Réduisez le stress et gagnez en crédibilité."
                            delay="0.4s"
                        />
                        <FeatureCard
                            icon={Lock}
                            title="Sécurité Intransigeante"
                            description="Security by design : RBAC strict, cloisonnement et standards OWASP, avec une approche alignée ANSSI."
                            delay="0.5s"
                        />
                    </div>
                </div>
            </section>

            {/* Trust/Social Proof Section */}
            <section className="relative z-10 py-24 bg-white/30 dark:bg-slate-900/30 border-y border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Pourquoi les RSSI et le COMEX adoptent Sentinel GRC</h2>
                        <div className="space-y-4">
                            <BenefitItem text="Fin de la conformité papier : une source unique de vérité" />
                            <BenefitItem text="ISO 27005 opérationnel : risques, traitements et preuves tracés" />
                            <BenefitItem text="Indicateurs clairs pour la direction, sans jargon inutile" />
                            <BenefitItem text="Sécurité by design : on ne protège pas des secrets avec un outil vulnérable" />
                        </div>
                        <Button onClick={() => navigate('/login')} size="lg" className="rounded-2xl px-8 bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg">
                            Accéder à Sentinel GRC
                        </Button>
                    </div>
                    <div className="relative group">
                        <div className="absolute inset-0 bg-brand-500/20 blur-[100px] rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-1000 pointer-events-none"></div>
                        <div className="relative glass-panel rounded-[2rem] p-8 border border-slate-200/60 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 dark:divide-white/10 hover:bg-white/90 dark:hover:bg-white/10 transition-colors duration-500 shadow-xl shadow-brand-500/5">
                            <div className="flex flex-col items-center text-center px-4 w-full">
                                <span className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 tracking-tight mb-2">500+</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500">Audits Réussis</span>
                            </div>
                            <div className="flex flex-col items-center text-center px-4 w-full">
                                <span className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 tracking-tight mb-2">10k+</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500">Risques Traités</span>
                            </div>
                            <div className="flex flex-col items-center text-center px-4 w-full">
                                <span className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-500 tracking-tight mb-2">100%</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600/80 dark:text-brand-500/80">Satisfaction</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 bg-white/50 dark:bg-black/50 py-12 border-t border-slate-200/60 dark:border-white/10 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center">
                            <Lock className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">Sentinel GRC</span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        © {new Date().getFullYear()} Cyber Threat Consulting. Sentinel GRC. Tous droits réservés.{' '}
                        <a
                            href="https://www.cyber-threat-consulting.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                        >
                            cyber-threat-consulting.com
                        </a>
                    </p>
                </div>
            </footer>
        </AuroraBackground>
    );
};
