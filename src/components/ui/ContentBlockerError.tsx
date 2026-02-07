import React from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle } from './Icons';
import { useAuth } from '../../hooks/useAuth';
import { useLocale } from '../../hooks/useLocale';

export const ContentBlockerError: React.FC = () => {
 const { dismissBlockerError } = useAuth();
 const { t } = useLocale();

 return (
 <div className="min-h-screen flex items-center justify-center bg-background p-4">
 <div className="max-w-md w-full bg-card rounded-2xl shadow-xl border border-border/40 overflow-hidden animate-fade-in">
 <div className="p-8 text-center">
  <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
  <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-400" />
  </div>

  <h1 className="text-2xl font-bold text-foreground mb-3">
  {t('ui.contentBlocker.title', { defaultValue: 'Connexion Interrompue' })}
  </h1>

  <p className="text-muted-foreground mb-6 leading-relaxed">
  {t('ui.contentBlocker.description', { defaultValue: 'Nous avons détecté que certains services de sécurité (Google reCAPTCHA) sont bloqués ou inaccessibles.' })}
  </p>

  <div className="bg-muted/50 rounded-3xl p-4 mb-8 text-left border border-border/40">
  {/* Heading hierarchy: h2 for solutions section (follows h1) */}
  <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center">
  <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2"></span>
  {t('ui.contentBlocker.solutionsTitle', { defaultValue: 'Solutions possibles :' })}
  </h2>
  <ul className="text-sm text-muted-foreground space-y-2 pl-3.5">
  <li>{t('ui.contentBlocker.solution1', { defaultValue: '• Désactivez votre bloqueur de publicité.' })}</li>
  <li>{t('ui.contentBlocker.solution2', { defaultValue: '• Vérifiez votre connexion internet.' })}</li>
  <li>{t('ui.contentBlocker.solution3', { defaultValue: '• Rechargez la page.' })}</li>
  </ul>
  </div>

  <div className="space-y-3">
  <button
  onClick={() => window.location.reload()}
  className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 "
  >
  <RefreshCw className="w-4 h-4" />
  {t('ui.contentBlocker.reload', { defaultValue: 'Recharger la page' })}
  </button>

  <button
  onClick={dismissBlockerError}
  className="w-full py-3 px-4 bg-transparent hover:bg-muted text-muted-foreground rounded-3xl font-medium transition-colors flex items-center justify-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
  >
  <AlertTriangle className="w-4 h-4" />
  {t('ui.contentBlocker.ignoreAndContinue', { defaultValue: 'Ignorer et continuer (Risqué)' })}
  </button>
  </div>

  <p className="mt-4 text-xs text-muted-foreground">
  {t('ui.contentBlocker.errorCode', { defaultValue: 'Code erreur: AUTH_BLOCKED_BY_CLIENT' })}
  </p>
 </div>
 </div>
 </div>
 );
};
