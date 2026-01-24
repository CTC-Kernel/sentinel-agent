import React from 'react';
import { Shield, Lock, ExternalLink } from '../ui/Icons';
import { useStore } from '../../store';
import { Button } from '../ui/button';

export const SSOPlaceholder: React.FC = () => {
    const { t } = useStore();

    return (
        <div className="glass-panel p-6 rounded-5xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden flex flex-col h-full col-span-1 md:col-span-2">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-500/10 dark:bg-purple-500/20 rounded-xl text-purple-600 dark:text-purple-400 backdrop-blur-md">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Single Sign-On (SSO)</h3>
                        <p className="text-xs text-slate-500 dark:text-muted-foreground">{t('settings.ssoDescription') || "Authentification d'entreprise (SAML/OIDC)"}</p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 rounded-full text-[10px] font-bold uppercase tracking-wide">
                    Enterprise
                </div>
            </div>

            <div className="relative z-10 p-8 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-2">
                    <Lock className="w-8 h-8 text-muted-foreground" />
                </div>

                <div className="max-w-md space-y-2">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">{t('settings.centralizeAccess') || "Centralisez vos accès"}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {t('settings.ssoExplanation') || "Connectez Sentinel GRC à votre fournisseur d'identité existant (Azure AD, Okta, Google Workspace) pour simplifier la connexion de vos collaborateurs."}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-white/5 flex flex-col items-center gap-2">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft" className="h-6 w-6" />
                        <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Azure AD</span>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-white/5 flex flex-col items-center gap-2">
                        <div className="h-6 w-6 bg-slate-900 rounded-full flex items-center justify-center text-white text-[8px] font-bold">O</div>
                        <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Okta</span>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-white/5 flex flex-col items-center gap-2">
                        <img src="/google-logo.svg" alt="Google" className="h-6 w-6" />
                        <span className="text-xs font-medium text-slate-600 dark:text-muted-foreground">Workspace</span>
                    </div>
                </div>

                <Button
                    variant="outline"
                    className="mt-4 gap-2 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    onClick={() => window.location.href = 'mailto:contact@cyber-threat-consulting.com?subject=Demande d\'activation SSO Enterprise&body=Bonjour, je souhaite activer le SSO pour mon organisation.'}
                >
                    {t('settings.enableSSO') || "Activer le SSO"} <ExternalLink className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
