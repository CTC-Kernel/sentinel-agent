import { Component, ErrorInfo, ReactNode } from 'react';
import { Shield, RefreshCw, Home } from './ui/Icons';
import { Button } from './ui/button';
import { MasterpieceBackground } from './ui/MasterpieceBackground';
import i18n from '../i18n';

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

  <div className="glass-premium p-12 md:p-16 rounded-3xl max-w-lg w-full mx-6 text-center shadow-2xl border border-border/40 relative z-decorator transition-all duration-500">
  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner ring-1 ring-white/10 ${isPermissionError
  ? 'bg-warning-bg text-warning'
  : 'bg-error-bg text-destructive'
  }`}>
  <Shield className="h-10 w-10" />
  </div>

  <h1 className="text-3xl font-black text-foreground mb-4 font-display tracking-tight">
  {isPermissionError
  ? i18n.t('errorBoundary.accessDenied', { defaultValue: 'Accès Refusé' })
  : i18n.t('errorBoundary.errorOccurred', { defaultValue: 'Une erreur est survenue' })}
  </h1>

  <p className="text-lg text-muted-foreground mb-10 leading-relaxed font-light">
  {isPermissionError
  ? i18n.t('errorBoundary.permissionDenied', { defaultValue: "Vous n'avez pas les permissions nécessaires pour accéder à cette ressource." })
  : i18n.t('errorBoundary.unexpectedError', { defaultValue: "Une erreur inattendue s'est produite. Notre équipe a été notifiée." })}
  </p>

  <div className="flex flex-col gap-4">
  <Button
  onClick={() => window.location.reload()}
  className="w-full text-base py-6 rounded-3xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
  >
  <RefreshCw className="mr-2 h-5 w-5" />
  {i18n.t('errorBoundary.reloadPage', { defaultValue: 'Recharger la page' })}
  </Button>

  <Button
  variant="ghost"
  onClick={() => window.location.href = '/'} // Intentional: full reload to recover from error state
  className="w-full text-base py-6 rounded-3xl font-medium text-muted-foreground hover:bg-muted transition-all"
  >
  <Home className="mr-2 h-5 w-5" />
  {i18n.t('errorBoundary.backToDashboard', { defaultValue: 'Retour au tableau de bord' })}
  </Button>
  </div>

  {!isPermissionError && import.meta.env.DEV && (
  <div className="mt-8 p-4 bg-black/40 rounded-3xl text-left overflow-auto max-h-40 border border-white/5 custom-scrollbar">
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
