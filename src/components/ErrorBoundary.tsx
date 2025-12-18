import { Component, ErrorInfo, ReactNode } from 'react';
import { Shield, RefreshCw, Home } from 'lucide-react';
import { MasterpieceBackground } from './ui/MasterpieceBackground';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

import { ErrorLogger } from '../services/errorLogger';

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        ErrorLogger.error(error, "ErrorBoundary.uncaught", { metadata: { componentStack: errorInfo.componentStack } });
    }

    public render() {
        if (this.state.hasError) {
            const isPermissionError = this.state.error?.message.includes('permission-denied') ||
                this.state.error?.message.includes('Missing or insufficient permissions');

            return (
                <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden">
                    <MasterpieceBackground />

                    <div className="glass-panel p-12 md:p-16 rounded-[2.5rem] max-w-lg w-full mx-6 text-center shadow-2xl border border-white/40 dark:border-white/5 relative z-10 transition-all duration-500">
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner ring-1 ring-white/10 ${isPermissionError
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-red-500/10 text-red-500'
                            }`}>
                            <Shield className="h-10 w-10" strokeWidth={1.5} />
                        </div>

                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-4 font-display tracking-tight">
                            {isPermissionError ? 'Accès Refusé' : 'Une erreur est survenue'}
                        </h1>

                        <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed font-light">
                            {isPermissionError
                                ? "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource."
                                : "Une erreur inattendue s'est produite. Notre équipe a été notifiée."}
                        </p>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-[0.98]"
                            >
                                <RefreshCw size={18} />
                                Recharger la page
                            </button>

                            <button
                                onClick={() => window.location.href = '/'}
                                className="w-full py-4 bg-transparent text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/20 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <Home size={18} />
                                Retour au tableau de bord
                            </button>
                        </div>

                        {!isPermissionError && process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 p-4 bg-black/40 rounded-xl text-left overflow-auto max-h-40 border border-white/5 custom-scrollbar">
                                <p className="text-xs font-mono text-red-400 break-all">
                                    {this.state.error?.toString()}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
