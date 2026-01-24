import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    isolate?: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ error, errorInfo });
        
        // Log error to monitoring service
        if (typeof window !== 'undefined' && (window as unknown as { errorLogger?: { error: (error: Error, context: string, metadata?: Record<string, unknown>) => void } }).errorLogger) {
            (window as unknown as { errorLogger: { error: (error: Error, context: string, metadata?: Record<string, unknown>) => void } }).errorLogger.error(error, 'ErrorBoundary.componentDidCatch', {
                metadata: {
                    componentStack: errorInfo.componentStack,
                    errorBoundary: true,
                    errorInfo
                }
            });
        }
        
        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
        
        // Send error to analytics
        if (typeof window !== 'undefined' && (window as unknown as { usageAnalytics?: { trackError: (type: string, message: string, metadata?: Record<string, unknown>) => void } }).usageAnalytics) {
            (window as unknown as { usageAnalytics: { trackError: (type: string, message: string, metadata?: Record<string, unknown>) => void } }).usageAnalytics.trackError('react_error_boundary', error.message, {
                componentStack: errorInfo.componentStack,
                errorBoundary: true
            });
        }
    }

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                const FallbackComponent = this.props.fallback;
                return React.createElement(FallbackComponent, { 
                    error: this.state.error!, 
                    resetError: this.resetError 
                });
            }
            
            // Default error UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                    <div className="text-center p-8">
                        <div className="mb-4">
                            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h8m-8-6v2m0 4h8" />
                                </svg>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            Une erreur est survenue
                        </h1>
                        <p className="text-slate-600 dark:text-muted-foreground mb-4">
                            {this.state.error?.message || 'Une erreur inattendue est survenue.'}
                        </p>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md mx-auto">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                Détails de l'erreur
                            </h2>
                            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                                <p><strong>Type:</strong> {this.state.error?.name || 'Erreur inconnue'}</p>
                                <p><strong>Message:</strong> {this.state.error?.message}</p>
                                {this.state.errorInfo && (
                                    <details className="mt-4">
                                        <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200">
                                            Informations techniques
                                        </summary>
                                        <pre className="mt-2 text-xs bg-slate-100 dark:bg-slate-900 p-4 rounded overflow-auto">
                                            {JSON.stringify(this.state.errorInfo, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={this.resetError}
                            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                            Réessayer
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }

    resetError = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };
}

export default ErrorBoundary;
