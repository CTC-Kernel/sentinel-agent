import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from './Icons';
import { Button } from './button';
import { ErrorLogger } from '@/services/errorLogger';
import { useLocale } from '@/hooks/useLocale';

// ---------------------------------------------------------------------------
// RouteErrorBoundary
// ---------------------------------------------------------------------------
// A reusable error boundary designed to wrap individual route pages. When a
// child component throws, this boundary catches the error, logs it via
// ErrorLogger, and renders an Apple-style glass-panel recovery UI with two
// options: retry (reset the error state) or navigate back to the dashboard.
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode;
}

interface InternalProps extends Props {
  t: (key: string, opts?: { defaultValue?: string }) => string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RouteErrorBoundaryInner extends Component<InternalProps, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    ErrorLogger.error(error, 'RouteErrorBoundary.uncaught', {
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: 'Route',
        timestamp: new Date().toISOString(),
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
      },
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    // Full page navigation to reset React tree and recover from broken state
    window.location.href = '/';
  };

  public render() {
    const { t } = this.props;

    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 animate-fade-in">
          <div className="glass-panel rounded-2xl p-10 max-w-lg w-full text-center shadow-apple-md">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6 text-destructive">
              <AlertTriangle className="w-8 h-8" />
            </div>

            {/* Heading */}
            <h2 className="text-xl font-bold text-foreground mb-2 font-display tracking-tight">
              {t('routeErrorBoundary.title', {
                defaultValue: 'Une erreur est survenue',
              })}
            </h2>

            {/* Description */}
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-sm mx-auto">
              {t('routeErrorBoundary.description', {
                defaultValue:
                  "Cette page a rencontre un probleme inattendu. Vos donnees ne sont pas perdues.",
              })}
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={this.handleRetry}
                className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                {t('routeErrorBoundary.retry', {
                  defaultValue: 'Reessayer',
                })}
              </Button>

              <Button
                onClick={this.handleGoHome}
                className="rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Home className="w-4 h-4 mr-2" />
                {t('routeErrorBoundary.backToDashboard', {
                  defaultValue: 'Retour au dashboard',
                })}
              </Button>
            </div>

            {/* Dev-only error details */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-8 p-4 bg-muted rounded-2xl text-left overflow-auto max-h-48 border border-border/40 custom-scrollbar">
                <p className="text-xs font-mono text-destructive break-all mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.error.stack && (
                  <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper to inject the i18n t() function into the class component
export const RouteErrorBoundary: React.FC<Props> = (props) => {
  const { t } = useLocale();
  return <RouteErrorBoundaryInner {...props} t={t} />;
};
