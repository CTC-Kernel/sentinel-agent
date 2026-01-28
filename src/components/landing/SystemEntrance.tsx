import React, { useState } from 'react';
import { ChevronRight, Shield, Globe, Loader2 } from '../ui/Icons';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { LandingMap } from './LandingMap';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useNavigate } from 'react-router-dom';

export const SystemEntrance: React.FC = () => {
    const [isScanning, setIsScanning] = useState(false);
    const navigate = useNavigate();

    const handleInitialize = () => {
        setIsScanning(true);
        // Direct hash navigation for robustness
        setTimeout(() => {
            navigate('/login');
        }, 800);
    };

    const [bootSequence, setBootSequence] = useState<string[]>([]);
    const [isBooting, setIsBooting] = useState(true);

    React.useEffect(() => {
        const sequence = [
            "INITIALISATION DU NOYAU SENTINEL v2.0...",
            "CHARGEMENT DES MODULES DE SÉCURITÉ...",
            "ÉTABLISSEMENT DE LA LIAISON SÉCURISÉE...",
            "ACCÈS AUTORISÉ."
        ];

        let currentIndex = 0;
        const interval = setInterval(() => {
            if (currentIndex >= sequence.length) {
                clearInterval(interval);
                setTimeout(() => setIsBooting(false), 800);
                return;
            }
            setBootSequence(prev => [...prev, sequence[currentIndex]]);
            currentIndex++;
        }, 600);

        return () => clearInterval(interval);
    }, []);

    // Boot Screen (Theme Aware)
    if (isBooting) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-green-600 dark:text-green-400 font-mono flex items-center justify-center p-8 transition-colors duration-500">
                <div className="w-full max-w-lg">
                    {bootSequence.map((line, i) => (
                        <div key={`msg-${i}`} className="mb-2 animate-fade-in font-bold">
                            <span className="opacity-60 mr-2">{`>`}</span>
                            {line}
                        </div>
                    ))}
                    <div className="animate-pulse">_</div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white selection:bg-brand-500 selection:text-white transition-colors duration-700">

            {/* Background Map & Effects */}
            <div className="absolute inset-0 z-0">
                <LandingMap />
                <div className="absolute inset-0 bg-grid-slate-900/[0.04] dark:bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
            </div>

            {/* Theme Toggle (Top Right) */}
            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>

            {/* Central HUD / Interface */}
            <div className="relative z-10 w-full max-w-md mx-auto p-6 flex flex-col items-center text-center">

                {/* Brand Identity / Status */}
                <div className={`mb-12 transition-all duration-700 ${isScanning ? 'scale-90 opacity-60' : 'scale-100 opacity-70'}`}>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 dark:bg-white/5 border border-border/40 dark:border-border/40 mb-6 backdrop-blur-md shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[11px] font-mono uppercase tracking-widest text-slate-500 dark:text-muted-foreground font-bold">Système Sécurisé • Niveau 4</span>
                    </div>
                    <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-white dark:to-slate-500 drop-shadow-2xl animate-fade-in">
                        SENTINEL <span className="text-brand-600 dark:text-brand-500 animate-pulse">_</span>
                    </h1>
                    <p className="text-sm md:text-base text-slate-500 dark:text-muted-foreground font-medium tracking-widest uppercase">
                        Commandement Cyber Souverain
                    </p>
                </div>

                {/* Interaction Module */}
                <div className={cn(
                    "relative w-full backdrop-blur-xl bg-white/40 dark:bg-white/5 border border-border/40 dark:border-border/40 rounded-3xl p-8 transition-all duration-500 overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none",
                    isScanning ? "border-brand-400 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)]" : "hover:border-white/80 dark:hover:border-white/20 hover:bg-white/60 dark:hover:bg-white/10"
                )}>

                    {/* Loading Overlay */}
                    {isScanning && (
                        <div className="absolute inset-0 bg-white/90 dark:bg-black/80 z-20 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
                            <div className="relative">
                                <Loader2 className="h-12 w-12 text-slate-500 dark:text-slate-300 animate-spin" />
                            </div>
                            <div className="mt-6 font-mono text-sm tracking-widest text-slate-600 dark:text-muted-foreground font-bold uppercase">
                                Chargement...
                            </div>
                        </div>
                    )}

                    {/* Default State Content */}
                    <div className={cn("space-y-6 transition-opacity duration-300", isScanning ? "opacity-0" : "opacity-70")}>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/5 flex flex-col items-center gap-2 group hover:bg-white/60 dark:hover:bg-white/10 transition-colors cursor-default">
                                <Shield className="h-6 w-6 text-slate-500 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                                <span className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold">Protéger</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/5 flex flex-col items-center gap-2 group hover:bg-white/60 dark:hover:bg-white/10 transition-colors cursor-default">
                                <Globe className="h-6 w-6 text-slate-500 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                                <span className="text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-300 font-bold">Surveiller</span>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                onClick={handleInitialize}
                                size="lg"
                                className="w-full h-14 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 font-bold tracking-tight text-lg rounded-3xl shadow-none hover:scale-[1.01] transition-all group border border-transparent dark:border-white/5 relative z-30"
                            >
                                ACCÈS À L'AUTHENTIFICATION
                                <ChevronRight className="ml-2 h-5 w-5 opacity-60 group-hover:opacity-70 group-hover:translate-x-1 transition-all" />
                            </Button>
                            <p className="mt-4 text-xs text-slate-500 dark:text-slate-300 font-mono font-medium">
                                EST. 2024 • CONNEXION CHIFFRÉE
                            </p>
                        </div >
                    </div >

                </div >

            </div >

            {/* Footer Status Bar */}
            < div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-end text-xs font-mono text-slate-500 dark:text-slate-300 uppercase tracking-widest pointer-events-none z-10 font-bold" >
                <div className="hidden md:block">
                    LAT: 48.8566 N <br /> LON: 2.3522 E
                </div>
                <div className="flex gap-8">
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Réseau: En Ligne
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Intel: Actif
                    </span>
                </div>
            </div >

        </div >
    );
};
