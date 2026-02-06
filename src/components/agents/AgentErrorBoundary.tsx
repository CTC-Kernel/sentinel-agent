import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorLogger } from '@/services/errorLogger';
import { AlertTriangle } from '@/components/ui/Icons';
import i18n from '@/i18n';

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
 const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
 return (
 <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 text-center">
  <AlertTriangle className="h-8 w-8 text-red-400 mb-3" />
  <p className="text-sm font-medium text-red-600 dark:text-red-400">
  {this.props.fallbackMessage ?? i18n.t('agent.componentError', { defaultValue: 'Ce composant a rencontré une erreur.' })}
  </p>
  <p className="text-xs text-red-400/70 dark:text-red-500/50 mt-1 font-mono">
  {i18n.t('agent.errorRef', { defaultValue: 'Réf :' })} {errorId}
  </p>
  <div className="flex items-center gap-3 mt-3">
  <button
  onClick={() => this.setState({ hasError: false, error: null })}
  className="text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 underline transition-colors"
  >
  {i18n.t('agent.retry', { defaultValue: 'Réessayer' })}
  </button>
  <span className="text-red-300 dark:text-red-700">•</span>
  <button
  onClick={() => window.location.reload()}
  className="text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 underline transition-colors"
  >
  {i18n.t('agent.reloadPage', { defaultValue: 'Recharger la page' })}
  </button>
  </div>
 </div>
 );
 }

 return this.props.children;
 }
}
