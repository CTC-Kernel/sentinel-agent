import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from '../ui/Icons';
import { Button } from '../ui/button';
import { ErrorLogger } from '../../services/errorLogger';

interface Props {
    children: ReactNode;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class SettingsErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        ErrorLogger.error(error, 'SettingsErrorBoundary', { 
            metadata: { 
                componentStack: errorInfo.componentStack,
                errorBoundary: 'Settings',
                timestamp: new Date().toISOString()
            } 
        });
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[400px] animate-fade-in">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 text-red-500">
                        <AlertTriangle className="w-8 h-8" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        Cette section est momentanément indisponible
                    </h3>

                    <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
                        Une erreur technique empêche l'affichage de cet onglet.
                        Vos données ne sont pas perdues.
                    </p>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Recharger la page
                        </Button>

                        <Button
                            onClick={this.handleReset}
                            className="bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-2"
                        >
                            <Home className="w-4 h-4" />
                            Retour au profil
                        </Button>
                    </div>

                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-left w-full max-w-lg overflow-auto text-xs font-mono text-slate-600 dark:text-muted-foreground">
                            <div className="mb-2 font-bold">Error Details:</div>
                            <div className="mb-2">{this.state.error.toString()}</div>
                            <div className="font-bold mb-1">Component Stack:</div>
                            <div className="whitespace-pre-wrap">{this.state.error.stack}</div>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
