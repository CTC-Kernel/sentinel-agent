import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorLogger } from '@/services/errorLogger';
import { AlertTriangle } from '@/components/ui/Icons';

interface Props {
    children: ReactNode;
    fallbackMessage?: string;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Lightweight inline error boundary for agent components.
 *
 * Unlike the full-page ErrorBoundary, this renders an inline error card
 * so a single failing widget doesn't crash the entire Agents page.
 */
export class AgentErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        ErrorLogger.error(error, `AgentErrorBoundary.${this.props.componentName ?? 'unknown'}`, {
            metadata: { componentStack: errorInfo.componentStack },
        });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 text-center">
                    <AlertTriangle className="h-8 w-8 text-red-400 mb-3" />
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {this.props.fallbackMessage ?? 'Ce composant a rencontré une erreur.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="mt-3 text-xs text-red-500 hover:text-red-700 underline"
                    >
                        Réessayer
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
