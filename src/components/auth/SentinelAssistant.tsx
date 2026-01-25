import React, { useState } from 'react';
import { Bot, Lock, Globe } from '../ui/Icons';
import { useStore } from '../../store';
import Sentinel3DCore from './Sentinel3DCore';
import SentinelChat from './SentinelChat';

export const SentinelAssistant: React.FC = () => {
    useStore();
    const [greeting] = useState(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bonjour';
        else if (hour < 18) return 'Bon après-midi';
        else return 'Bonsoir';
    });
    const [showChat, setShowChat] = useState(false);

    return (
        <div className="hidden lg:flex flex-col justify-center w-full max-w-lg p-8 relative">
            {/* Abstract Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
            </div>

            {/* Main Card - Fluid Premium Design */}
            <div className="relative z-10 glass-premium glass-noise rounded-[3rem] p-12 shadow-2xl overflow-hidden group hover:shadow-[0_0_50px_-12px_rgba(var(--brand-500),0.3)] hover:border-brand-500/30 transition-all duration-700 ease-out h-[600px] flex flex-col justify-between">

                {/* Subtle glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-b from-brand-500/5 via-transparent to-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-brand-500/20 transition-colors duration-700"></div>

                {/* AI Avatar / Core */}
                {/* AI Avatar / Core */}
                <div className="flex items-center gap-4 mb-4" onMouseEnter={() => setShowChat(true)}>
                    <div className="relative w-28 h-28 flex items-center justify-center -ml-2">
                        <div className="absolute inset-[-20px] w-[calc(100%+40px)] h-[calc(100%+40px)]">
                            <Sentinel3DCore />
                        </div>
                    </div>
                    <div className="z-10">
                        <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                            Sentinel-Core AI
                            <span className="px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-[10px] border border-brand-200 dark:border-brand-800 font-bold">BETA</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                Online & Listening
                            </span>
                        </div>
                    </div>
                </div>

                {/* Content Switching: Greeting vs Chat */}
                <div className="relative h-[340px]">
                    {!showChat ? (
                        <div className="animate-fade-in flex flex-col justify-center h-full space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-4xl font-extrabold text-foreground leading-tight">
                                    {greeting},<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-purple-600 dark:from-brand-400 dark:to-purple-400 animate-gradient-x bg-[length:200%_auto]">
                                        Je suis à votre écoute.
                                    </span>
                                </h3>
                                <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed font-normal">
                                    Passez la souris sur mon cœur ou commencez à taper pour discuter. Je peux vous informer sur notre sécurité, nos tarifs ou votre ROI.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowChat(true)}
                                className="group flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-brand-50 dark:hover:bg-brand-900/20 border border-slate-200 dark:border-white/10 hover:border-brand-200 dark:hover:border-brand-800 transition-all w-full text-left"
                            >
                                <div className="p-2 bg-brand-100 dark:bg-brand-900/50 rounded-lg text-brand-700 dark:text-brand-300 group-hover:scale-110 transition-transform">
                                    <Bot size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Poser une question</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">"Comment garantissez-vous la sécurité ?"</p>
                                </div>
                            </button>
                        </div>
                    ) : (
                        <div className="animate-fade-in h-full">
                            <SentinelChat />
                        </div>
                    )}
                </div>

                {/* Footer / Certification Badges */}
                <div className="mt-10 pt-6 border-t border-slate-200 dark:border-white/10 flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2" title="Hébergement certifié SecNumCloud">
                        <Globe className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">SecNumCloud Ready</span>
                    </div>
                    <div className="flex items-center gap-2" title="Chiffrement de bout en bout">
                        <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">End-To-End Encrypted</span>
                    </div>
                </div>

            </div>
        </div>
    );
};
