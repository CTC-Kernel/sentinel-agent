import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from '../ui/Icons';
import { Button } from '../ui/button';
import { ErrorLogger } from '../../services/errorLogger';
import { useLocale } from '../../hooks/useLocale';

interface Props {
 children: ReactNode;
 onReset?: () => void;
}

interface InternalProps extends Props {
 t: (key: string, opts?: { defaultValue?: string }) => string;
}

interface State {
 hasError: boolean;
 error: Error | null;
}

class SettingsErrorBoundaryInner extends Component<InternalProps, State> {
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
 const { t } = this.props;

 if (this.state.hasError) {
 return (
 <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[400px] animate-fade-in">
  <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 text-red-500">
  <AlertTriangle className="w-8 h-8" />
  </div>

  <h3 className="text-xl font-bold text-foreground mb-2">
  {t('settings.errorBoundary.title', { defaultValue: 'Cette section est momentanément indisponible' })}
  </h3>

  <p className="text-muted-foreground max-w-md mb-6">
  {t('settings.errorBoundary.description', { defaultValue: "Une erreur technique empêche l'affichage de cet onglet. Vos données ne sont pas perdues." })}
  </p>

  <div className="flex gap-3">
  <Button
  variant="outline"
  onClick={() => window.location.reload()}
  className="flex items-center gap-2"
  >
  <RefreshCw className="w-4 h-4" />
  {t('settings.errorBoundary.reload', { defaultValue: 'Recharger la page' })}
  </Button>

  <Button
  onClick={this.handleReset}
  className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
  >
  <Home className="w-4 h-4" />
  {t('settings.errorBoundary.backToProfile', { defaultValue: 'Retour au profil' })}
  </Button>
  </div>

  {import.meta.env.DEV && this.state.error && (
  <div className="mt-8 p-4 bg-muted rounded-2xl text-left w-full max-w-lg overflow-auto text-xs font-mono text-muted-foreground border border-border/40">
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

// Functional wrapper to provide i18n t() to the class component
export const SettingsErrorBoundary: React.FC<Props> = (props) => {
 const { t } = useLocale();
 return <SettingsErrorBoundaryInner {...props} t={t} />;
};
