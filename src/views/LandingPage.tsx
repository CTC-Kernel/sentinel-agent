import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuroraBackground } from '../components/ui/AuroraBackground';
import { Spotlight } from '../components/ui/aceternity/Spotlight';
import { ContainerScroll } from '../components/ui/aceternity/ContainerScroll';
import { BorderBeam } from '../components/ui/aceternity/BorderBeam';
import { Button } from '../components/ui/button';
import { Lock, ArrowRight, Sun, Moon } from '../components/ui/Icons';
import { SparklesCore } from '../components/ui/aceternity/Sparkles';
import { SEO } from '../components/SEO';
import { LandingDashboardMockup } from '../components/landing/LandingDashboardMockup';
import { useStore } from '../store';
import { LegalModal } from '../components/ui/LegalModal';



export const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useStore();
    const [showLegalModal, setShowLegalModal] = useState(false);
    const [legalTab, setLegalTab] = useState<'mentions' | 'privacy' | 'terms' | 'cgv'>('mentions');

    return (
        <div className="bg-slate-950 min-h-screen w-full relative overflow-x-hidden selection:bg-brand-500 selection:text-white">
            <AuroraBackground className="min-h-screen !h-auto !fixed inset-0 z-0 pointer-events-none" showRadialGradient={true}>
                <div className="absolute inset-0 pointer-events-none" />
            </AuroraBackground>

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

            <Spotlight className="-top-40 left-0 md:left-60 md:-top-20 z-10" fill={theme === 'dark' ? "white" : "#3b82f6"} />

            <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
                <SparklesCore
                    id="tsparticleslanding"
                    background="transparent"
                    particleColor={theme === 'dark' ? "#FFFFFF" : "#0ea5e9"}
                    minSize={0.6}
                    maxSize={1.4}
                    particleDensity={10}
                    className="w-full h-full"
                />
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 transition-all duration-300 pointer-events-none">
                <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
                    <div className="glass-panel px-6 py-3 rounded-full border border-white/10 shadow-glass-sm flex items-center gap-4 bg-white/5 backdrop-blur-md">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg ring-1 ring-white/20">
                                <Lock className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <span className="text-lg font-bold tracking-tight text-white hidden sm:block">Sentinel GRC</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4 pointer-events-auto">
                        <button
                            onClick={toggleTheme}
                            className="p-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all backdrop-blur-md"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </button>
                        <Button onClick={() => navigate('/login')} className="rounded-full px-6 bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-[0_0_20px_rgba(79,70,229,0.5)] border border-brand-400/20 transition-all hover:scale-105">
                            Se connecter
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Container Scroll - Hero & Dashboard */}
            <div className="relative z-10">
                <ContainerScroll
                    titleComponent={
                        <>
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-white/10 backdrop-blur-md mb-8 animate-fade-in hover:bg-slate-900/70 transition-colors cursor-default shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                                </span>
                                <span className="text-sm font-medium text-slate-300 tracking-wide">Nouvelle Génération GRC</span>
                            </div>



                            <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
                                Pilotez votre conformité ISO 27001 et vos risques avec une élégance et une précision inégalées. Une plateforme conçue pour l'excellence.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                                <Button onClick={() => navigate('/login')} size="lg" className="h-14 px-8 rounded-full bg-white text-black font-bold text-lg hover:bg-slate-200 hover:scale-105 transition-all shadow-[0_0_25px_rgba(255,255,255,0.3)] w-full sm:w-auto flex items-center gap-2 group">
                                    Accedez à l'onboarding
                                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </div>
                        </>
                    }
                >
                    <div className="w-full h-full relative bg-slate-950 rounded-[inherit] overflow-hidden">
                        <LandingDashboardMockup />
                        <BorderBeam size={250} duration={12} delay={9} borderWidth={2} className="opacity-70" />
                    </div>
                </ContainerScroll>
            </div>

            {/* Footer */}
            <footer className="relative z-10 bg-black/40 py-12 border-t border-white/10 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center space-x-2 opacity-50 hover:opacity-100 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center">
                            <Lock className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-white">Sentinel GRC</span>
                    </div>

                    <div className="flex flex-wrap gap-4 md:gap-8 justify-center items-center text-xs font-medium text-slate-500">
                        <button onClick={() => { setLegalTab('mentions'); setShowLegalModal(true); }} className="hover:text-white transition-colors">Mentions Légales</button>
                        <button onClick={() => { setLegalTab('privacy'); setShowLegalModal(true); }} className="hover:text-white transition-colors">Confidentialité</button>
                        <button onClick={() => { setLegalTab('terms'); setShowLegalModal(true); }} className="hover:text-white transition-colors">CGU</button>
                        <button onClick={() => { setLegalTab('cgv'); setShowLegalModal(true); }} className="hover:text-white transition-colors">CGV</button>
                    </div>

                    <p className="text-xs text-slate-500">
                        © 2024 Cyber Threat Consulting. Sentinel GRC.
                    </p>
                </div>
            </footer>

            <LegalModal
                isOpen={showLegalModal}
                onClose={() => setShowLegalModal(false)}
                initialTab={legalTab}
            />
        </div>
    );
};
