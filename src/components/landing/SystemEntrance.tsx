import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, ChevronRight, Shield, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { LandingMap } from './LandingMap';

export const SystemEntrance: React.FC = () => {
    const navigate = useNavigate();
    const [isScanning, setIsScanning] = useState(false);
    const [scanSuccess, setScanSuccess] = useState(false);

    const handleInitialize = () => {
        setIsScanning(true);
        // Simulate biometric scan delay
        setTimeout(() => {
            setScanSuccess(true);
            // Simulate access granted & redirect
            setTimeout(() => {
                navigate('/login');
            }, 800);
        }, 1500);
    };

    const [bootSequence, setBootSequence] = useState<string[]>([]);
    const [isBooting, setIsBooting] = useState(true);

    React.useEffect(() => {
        const sequence = [
            "INITIALIZING SENTINEL KERNEL v2.0...",
            "LOADING SECURITY MODULES...",
            "ESTABLISHING SECURE UPLINK...",
            "ACCESS GRANTED."
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

    // Boot Screen
    if (isBooting) {
        return (
            <div className="min-h-screen bg-[#020617] text-emerald-500 font-mono flex items-center justify-center p-8">
                <div className="w-full max-w-lg">
                    {bootSequence.map((line, i) => (
                        <div key={i} className="mb-2 animate-fade-in">
                            <span className="opacity-50 mr-2">{`>`}</span>
                            {line}
                        </div>
                    ))}
                    <div className="animate-pulse">_</div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#020617] text-white selection:bg-brand-500 selection:text-white">

            {/* Background Map & Effects */}
            <div className="absolute inset-0 z-0">
                <LandingMap />
                <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
            </div>

            {/* Central HUD / Interface */}
            <div className="relative z-10 w-full max-w-md mx-auto p-6 flex flex-col items-center text-center">

                {/* Brand Identity / Status */}
                <div className={`mb-12 transition-all duration-700 ${isScanning ? 'scale-90 opacity-50' : 'scale-100 opacity-100'}`}>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">System Secure • Tier 4</span>
                    </div>
                    <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-500 drop-shadow-2xl animate-fade-in">
                        SENTINEL
                        <span className="text-brand-500 animate-blink">_</span>
                    </h1>
                    <p className="text-sm md:text-base text-slate-400 font-light tracking-widest uppercase">
                        Sovereign Cyber Command
                    </p>
                </div>

                {/* Interaction Module */}
                <div className={cn(
                    "relative w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 transition-all duration-500 overflow-hidden",
                    isScanning ? "border-brand-500/50 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)]" : "hover:border-white/20 hover:bg-white/10"
                )}>

                    {/* Scanning Overlay */}
                    {isScanning && (
                        <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center animate-fade-in">
                            <div className="relative">
                                <Fingerprint className={cn("h-16 w-16 text-brand-500 transition-all duration-300", scanSuccess ? "text-emerald-500 scale-110" : "animate-pulse")} />
                                {scanSuccess && <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/20" />}
                            </div>
                            <div className="mt-4 font-mono text-sm tracking-widest text-brand-400">
                                {scanSuccess ? <span className="text-emerald-400">ACCESS GRANTED</span> : "VERIFYING IDENTITY..."}
                            </div>
                        </div>
                    )}

                    {/* Default State Content */}
                    <div className={cn("space-y-6 transition-opacity duration-300", isScanning ? "opacity-0" : "opacity-100")}>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center gap-2 group hover:bg-white/10 transition-colors cursor-default">
                                <Shield className="h-6 w-6 text-slate-400 group-hover:text-white transition-colors" />
                                <span className="text-[10px] uppercase tracking-wider text-slate-500">Protect</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center gap-2 group hover:bg-white/10 transition-colors cursor-default">
                                <Globe className="h-6 w-6 text-slate-400 group-hover:text-white transition-colors" />
                                <span className="text-[10px] uppercase tracking-wider text-slate-500">Monitor</span>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                onClick={handleInitialize}
                                size="lg"
                                className="w-full h-14 bg-white text-black hover:bg-slate-200 font-bold tracking-tight text-lg rounded-xl shadow-lg hover:scale-[1.02] transition-all group"
                            >
                                INITIALIZE SYSTEM
                                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                            <p className="mt-4 text-xs text-slate-500 font-mono">
                                EST. 2024 • ENCRYPTED CONNECTION
                            </p>
                        </div>
                    </div>

                </div>

            </div>

            {/* Footer Status Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-end text-xs font-mono text-slate-600 uppercase tracking-widest pointer-events-none z-10">
                <div className="hidden md:block">
                    LAT: 48.8566 N <br /> LON: 2.3522 E
                </div>
                <div className="flex gap-8">
                    <span className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                        Grid: Online
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                        Intel: Active
                    </span>
                </div>
            </div>

        </div>
    );
};
