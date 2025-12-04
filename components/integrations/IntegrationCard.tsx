import React from 'react';
import { IntegrationProvider } from '../../services/integrationService';
import { CheckCircle2, Plug, Loader2 } from 'lucide-react';

interface IntegrationCardProps {
    provider: IntegrationProvider;
    onConnect: (provider: IntegrationProvider) => void;
    onDisconnect: (provider: IntegrationProvider) => void;
    isConnecting: boolean;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({ provider, onConnect, onDisconnect, isConnecting }) => {
    const isConnected = provider.status === 'connected';

    return (
        <div className={`group relative p-6 rounded-2xl border transition-all duration-300 ${isConnected
            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/30'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-lg'
            }`}>
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${isConnected ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-700'
                    }`}>
                    {/* Placeholder for actual icons based on provider.icon */}
                    <Plug className={`h-6 w-6 ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
                </div>
                {isConnected && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Connecté
                    </div>
                )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{provider.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 min-h-[40px] leading-relaxed">
                {provider.description}
            </p>

            <div className="flex items-center justify-between mt-auto">
                <button
                    onClick={() => isConnected ? onDisconnect(provider) : onConnect(provider)}
                    disabled={isConnecting}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${isConnected
                        ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] shadow-md hover:shadow-lg'
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
