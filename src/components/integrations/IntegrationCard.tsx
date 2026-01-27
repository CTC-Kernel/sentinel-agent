import React from 'react';
import { IntegrationProvider } from '../../services/integrationService';
import { CheckCircle2, Plug, Loader2 } from '../ui/Icons';

interface IntegrationCardProps {
    provider: IntegrationProvider;
    onConnect: (provider: IntegrationProvider) => void;
    onDisconnect: (provider: IntegrationProvider) => void;
    isConnecting: boolean;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({ provider, onConnect, onDisconnect, isConnecting }) => {
    const isConnected = provider.status === 'connected';

    return (
        <div className={`group relative p-6 rounded-3xl border transition-all duration-300 ${isConnected
            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-500/30 shadow-lg shadow-emerald-500/5'
            : 'glass-panel hover:shadow-xl hover:border-brand-300 dark:hover:border-white/20'
            }`}>
            {/* Inner Glow Effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/50 to-transparent dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-70 transition-opacity pointer-events-none" />

            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={`p-3.5 rounded-2xl transition-colors duration-300 ${isConnected
                    ? 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 dark:from-emerald-500/20 dark:to-emerald-500/10 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 group-hover:bg-brand-50 dark:group-hover:bg-brand-900 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                    }`}>
                    {/* Placeholder for actual icons based on provider.icon */}
                    <Plug className="h-6 w-6" />
                </div>
                {isConnected && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-500/20 border border-emerald-200/50 dark:border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-400 backdrop-blur-sm">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Connecté
                    </div>
                )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 relative z-10">{provider.name}</h3>
            <p className="text-sm text-slate-500 dark:text-muted-foreground mb-6 min-h-[40px] leading-relaxed relative z-10">
                {provider.description}
            </p>

            <div className="flex items-center justify-between mt-auto relative z-10">
                <button
                    onClick={() => isConnected ? onDisconnect(provider) : onConnect(provider)}
                    disabled={isConnecting}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${isConnected
                        ? 'bg-white/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-red-500 dark:hover:text-red-400'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-brand-600 hover:text-white dark:hover:bg-brand-500 dark:hover:text-white shadow-lg hover:shadow-brand-500/25'
                        }`}
                >
                    {isConnecting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Traitement...
                        </>
                    ) : isConnected ? (
                        'Déconnecter'
                    ) : (
                        'Connecter'
                    )}
                </button>
            </div>
        </div>
    );
};
