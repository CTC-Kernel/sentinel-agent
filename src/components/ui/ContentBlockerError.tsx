import React from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const ContentBlockerError: React.FC = () => {
    const { dismissBlockerError } = useAuth();

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in">
                <div className="p-8 text-center">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-400" />
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                        Connexion Interrompue
                    </h1>

                    <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                        Nous avons détecté que certains services de sécurité (Google reCAPTCHA) sont bloqués ou inaccessibles.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 mb-8 text-left border border-slate-100 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 mr-2"></span>
                            Solutions possibles :
                        </h3>
                        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 pl-3.5">
                            <li>• Désactivez votre bloqueur de publicité.</li>
                            <li>• Vérifiez votre connexion internet.</li>
                            <li>• Rechargez la page.</li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Recharger la page
                        </button>

                        <button
                            onClick={dismissBlockerError}
                            className="w-full py-3 px-4 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                        >
                            <AlertTriangle className="w-4 h-4" />
                            Ignorer et continuer (Risqué)
                        </button>
                    </div>

                    <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
                        Code erreur: AUTH_BLOCKED_BY_CLIENT
                    </p>
                </div>
            </div>
        </div>
    );
};
