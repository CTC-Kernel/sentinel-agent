import React from 'react';
import { Button } from '../ui/button';
import { toast } from '@/lib/toast';
import { useStore } from '../../store';
import {
    ShieldCheck,
    Copy,
    Terminal,
    AlertTriangle,
} from '../ui/Icons';
import { Loader2 } from 'lucide-react';

interface EnrollmentTokenPanelProps {
    enrollmentToken: string | null;
    loading?: boolean;
    error?: string | null;
}

export const EnrollmentTokenPanel: React.FC<EnrollmentTokenPanelProps> = ({
    enrollmentToken,
    loading = false,
    error = null,
}) => {
    const { t } = useStore();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-4" />
                <p className="text-sm text-muted-foreground font-medium">
                    {t('agentSetup.tokenReady.generating', { defaultValue: 'Generation du token...' })}
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <div className="p-3 bg-destructive/10 rounded-full mb-4">
                    <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-sm text-destructive font-medium text-center">{error}</p>
            </div>
        );
    }

    if (!enrollmentToken) return null;

    return (
        <div className="space-y-6">
            {/* Token Card */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-brand-50 rounded-lg text-brand-600 dark:text-brand-400">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        {t('agentSetup.tokenReady.tokenLabel', { defaultValue: "Token d'Installation" })}
                    </h4>
                </div>

                <div className="p-4 bg-white dark:bg-slate-950 rounded-3xl border border-border/40 dark:border-border/40 shadow-sm">
                    <div className="font-mono text-xs text-brand-600 dark:text-brand-400 break-all select-all text-center mb-3">
                        {enrollmentToken}
                    </div>
                    <Button
                        size="sm"
                        className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-lg shadow-sm"
                        onClick={() => {
                            navigator.clipboard.writeText(enrollmentToken);
                            toast.success(t('agentSetup.tokenReady.tokenCopied', { defaultValue: 'Token copie !' }));
                        }}
                    >
                        <Copy className="w-3.5 h-3.5 mr-2" />
                        {t('agentSetup.tokenReady.copyToken', { defaultValue: 'Copier le Token' })}
                    </Button>
                    <p className="text-[11px] text-muted-foreground text-center mt-2.5">
                        {t('agentSetup.tokenReady.expiresNotice', { defaultValue: 'Expire dans 24 heures. Usage unique recommande.' })}
                    </p>
                </div>
            </div>

            {/* Quick Install Guide */}
            <div className="space-y-4 pt-4 border-t border-border/40 dark:border-border/40">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-500" />
                    {t('agentSetup.tokenReady.installCommand', { defaultValue: "Commande d'installation" })}
                </h4>

                <div className="relative group">
                    <pre className="p-4 bg-slate-900 dark:bg-black rounded-3xl text-[11px] text-emerald-400 overflow-x-auto border border-slate-800 shadow-inner custom-scrollbar">
                        <code>sentinel-agent enroll --token {enrollmentToken.substring(0, 8)}...</code>
                    </pre>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(`sentinel-agent enroll --token ${enrollmentToken}`);
                            toast.success(t('agentSetup.tokenReady.commandCopied', { defaultValue: 'Commande copiee !' }));
                        }}
                        className="absolute right-2 top-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors opacity-0 group-hover:opacity-70"
                        title={t('agentSetup.tokenReady.copyCommand', { defaultValue: 'Copier la commande' })}
                    >
                        <Copy className="w-3.5 h-3.5 text-white" />
                    </button>
                </div>

                <div className="text-xs text-muted-foreground space-y-2">
                    <p><strong className="text-slate-700 dark:text-slate-200">macOS / Linux :</strong> {t('agentSetup.tokenReady.platformMacLinux', { defaultValue: 'Ouvrez un terminal' })}</p>
                    <p><strong className="text-slate-700 dark:text-slate-200">Windows :</strong> {t('agentSetup.tokenReady.platformWindows', { defaultValue: 'PowerShell (Admin)' })}</p>
                </div>
            </div>
        </div>
    );
};
