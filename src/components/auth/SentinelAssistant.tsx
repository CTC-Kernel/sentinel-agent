import React, { useEffect, useState } from 'react';
import { Bot, Lock, Globe } from '../ui/Icons';
import { useStore } from '../../store';
import Sentinel3DCore from './Sentinel3DCore';
import SentinelChat from './SentinelChat';

export const SentinelAssistant: React.FC = () => {
    const { } = useStore();
    const [greeting, setGreeting] = useState('');
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Bonjour');
        else if (hour < 18) setGreeting('Bon après-midi');
        else setGreeting('Bonsoir');
    }, []);

    return (
        <div className="hidden lg:flex flex-col justify-center w-full max-w-lg p-8 relative">
            {/* Abstract Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-500/20 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
            </div>

            {/* Main Card */}
            <div className="relative z-10 bg-white/90 dark:bg-white/5 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-[2.5rem] p-10 shadow-xl overflow-hidden group hover:shadow-2xl hover:border-slate-300/60 dark:hover:border-white/10 hover:-translate-y-0.5 transition-all duration-700 ease-out">

                {/* Subtle glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-b from-brand-500/0 via-transparent to-brand-500/0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-700 pointer-events-none"></div>

                {/* AI Avatar / Core */}
                {/* AI Avatar / Core */}
                <div className="flex items-center gap-4 mb-4" onMouseEnter={() => setShowChat(true)}>
                    <div className="relative w-28 h-28 flex items-center justify-center -ml-2">
                        <div className="absolute inset-[-20px] w-[calc(100%+40px)] h-[calc(100%+40px)]">
                            <Sentinel3DCore />
                        </div>
                    </div>
                    <div className="z-10">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                            Sentinel-Core AI
                            <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-600 dark:text-brand-300 text-[10px] border border-brand-500/30">BETA</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">
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
                                <h3 className="text-4xl font-extrabold text-slate-900 dark:text-white leading-tight">
                                    {greeting},<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-blue-600 dark:from-brand-300 dark:to-blue-300">
                                        Je suis à votre écoute.
                                    </span>
                                </h3>
                                <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed font-light">
                                    Passez la souris sur mon cœur ou commencez à taper pour discuter. Je peux vous informer sur notre sécurité, nos tarifs ou votre ROI.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowChat(true)}
                                className="group flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-brand-50 dark:hover:bg-white/20 border border-slate-200 dark:border-white/10 transition-all w-full text-left"
                            >
                                <div className="p-2 bg-brand-500/20 rounded-lg text-brand-600 dark:text-brand-300 group-hover:scale-110 transition-transform">
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
                        <Globe className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">SecNumCloud Ready</span>
                    </div>
                    <div className="flex items-center gap-2" title="Chiffrement de bout en bout">
                        <Lock className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">End-To-End Encrypted</span>
                    </div>
                </div>

            </div>
        </div>
    );
};
