import { Component, ErrorInfo, ReactNode } from 'react';
import { Shield, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            const isPermissionError = this.state.error?.message.includes('permission-denied') ||
                this.state.error?.message.includes('Missing or insufficient permissions');

            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                    <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center border border-slate-200 dark:border-slate-700">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${isPermissionError ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                            <Shield size={32} />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                            {isPermissionError ? 'Accès Refusé' : 'Une erreur est survenue'}
                        </h1>

                        <p className="text-slate-600 dark:text-slate-400 mb-8">
                            {isPermissionError
                                ? "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource. Veuillez contacter le propriétaire de votre organisation."
                                : "Une erreur inattendue s'est produite. Notre équipe a été notifiée."}
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={18} />
                                Recharger la page
                            </button>

                            <button
                                onClick={() => window.location.href = '/dashboard'}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Home size={18} />
                                Retour au tableau de bord
                            </button>
                        </div>

                        {!isPermissionError && process.env.NODE_ENV === 'development' && (
                            <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg text-left overflow-auto max-h-40">
                                <p className="text-xs font-mono text-red-600 dark:text-red-400">
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
