import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { BrainCircuit, Key, Calendar, CheckCircle2, Download, LogOut, ShieldCheck } from '../ui/Icons';
import { SubmitHandler } from 'react-hook-form';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { useZodForm } from '../../hooks/useZodForm';
import { aiSettingsSchema, AISettingsFormData } from '../../schemas/settingsSchema';
import { ErrorLogger } from '../../services/errorLogger';
import { useGoogleLogin } from '@react-oauth/google';
import { mapAuditsToEvents, mapTasksToEvents, generateICS, downloadICS } from '../../utils/calendarUtils';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { useLayoutData } from '../../hooks/layout/useLayoutData';
import { useAuditsActions } from '../../hooks/audits/useAuditsActions';
// Form validation: zod schema with resolver pattern

export const IntegrationSettings: React.FC = () => {
    // Use individual selectors to prevent unnecessary re-renders
    const user = useStore(state => state.user);
    const setUser = useStore(state => state.setUser);
    const addToast = useStore(state => state.addToast);
    const t = useStore(state => state.t);

    const { projects } = useLayoutData();
    const { audits } = useAuditsActions();

    // Local state for Google Token (removed from global store for security)
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
    const [googleTokenExpiry, setGoogleTokenExpiry] = useState<number | null>(null);

    const [savingKeys, setSavingKeys] = useState(false);
    const [exportingCalendar, setExportingCalendar] = useState(false);

    const setGoogleToken = (token: string, expiresInSeconds: number) => {
        const now = Date.now();
        const expiry = now + Math.max(expiresInSeconds * 1000 - 5000, 0);
        setGoogleAccessToken(token);
        setGoogleTokenExpiry(expiry);
    };

    const clearGoogleToken = () => {
        setGoogleAccessToken(null);
        setGoogleTokenExpiry(null);
    };

    const hasGoogleCalendarSession = useMemo(() => {
        if (!googleAccessToken) return false;
        if (!googleTokenExpiry) return true;
        return googleTokenExpiry > Date.now();
    }, [googleAccessToken, googleTokenExpiry]);

    // AI Keys Form
    const { register, handleSubmit } = useZodForm<typeof aiSettingsSchema>({
        schema: aiSettingsSchema,
        mode: 'onChange',
        defaultValues: {
            geminiCredential: user?.hasGeminiKey ? '' : '',
        }
    });

    const handleUpdateKeys: SubmitHandler<AISettingsFormData> = async (data) => {
        if (!user) return;
        setSavingKeys(true);
        try {
            const functions = getFunctions();
            const saveUserApiKeys = httpsCallable(functions, 'saveUserApiKeys');
            const payload: Record<string, string> = {};
            if (data.geminiCredential) payload.geminiApiKey = data.geminiCredential; // Function expects geminiApiKey

            await saveUserApiKeys(payload);

            const updatedUser = { ...user, hasGeminiKey: !!data.geminiCredential || user.hasGeminiKey };
            setUser(updatedUser);
            addToast(t('settings.profileUpdated'), "success");
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'IntegrationSettings.handleUpdateKeys', 'UPDATE_FAILED');
        } finally {
            setSavingKeys(false);
        }
    };

    const loginToGoogle = useGoogleLogin({
        onSuccess: tokenResponse => {
            setGoogleToken(tokenResponse.access_token, tokenResponse.expires_in);
            addToast(t('settings.googleCalendarConnected'), "success");
        },
        onError: () => {
            addToast(t('settings.googleCalendarFailed'), "error");
        },
        scope: 'https://www.googleapis.com/auth/calendar'
    });

    const handleExportCalendar = async () => {
        if (!user?.uid) return;
        setExportingCalendar(true);
        try {
            // Extract tasks assigned to user
            const myTasks = projects.flatMap(p => p.tasks || []).filter(task => task.assigneeId === user.uid);

            // Filter audits
            const myAudits = audits.filter(a => a.auditor === user.displayName || a.auditor === user.email);

            const auditEvents = mapAuditsToEvents(myAudits);
            const taskEvents = mapTasksToEvents(myTasks);

            const ics = generateICS([...auditEvents, ...taskEvents]);
            downloadICS(`sentinel_calendar_${new Date().toISOString().split('T')[0]}.ics`, ics);
            addToast("Calendrier exporté avec succès", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'IntegrationSettings.handleExportCalendar', 'FETCH_FAILED');
        } finally {
            setExportingCalendar(false);
        }
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 col-span-1 md:col-span-2">{t('settings.integrations')}</h2>

            {/* AI Settings */}
            <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 dark:border-border/40 shadow-sm relative overflow-hidden flex flex-col h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-500/10 dark:bg-purple-500/20 rounded-3xl text-purple-600 dark:text-purple-400 backdrop-blur-md">
                            <BrainCircuit className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.aiSettings')}</h3>
                    </div>
                </div>
                <div className="relative z-10 p-6 flex-1 flex flex-col justify-between space-y-6">
                    <div>
                        <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6 leading-relaxed">
                            {t('settings.aiDescription')}
                        </p>
                        <form onSubmit={handleSubmit(handleUpdateKeys)} className="space-y-4">
                            {/* Accessibility: hidden username field for password managers */}
                            <input aria-label="Nom d'utilisateur (caché)"
                                type="text"
                                name="username"
                                autoComplete="username"
                                className="sr-only"
                                aria-hidden="true"
                                readOnly
                                value={user?.email || ''}
                            />
                            <FloatingLabelInput
                                label={t('settings.geminiCredential')}
                                type="password"
                                {...register('geminiCredential')}
                                autoComplete="new-password"
                                icon={Key}
                                placeholder={user?.hasGeminiKey ? '••••••••••••••••' : ''}
                            />
                            <p className="text-[11px] text-slate-500 dark:text-slate-300 ml-1">
                                {t('settings.geminiPlaceholder')}
                            </p>
                            <Button
                                type="submit"
                                isLoading={savingKeys}
                                className="w-full mt-2 rounded-3xl shadow-lg shadow-brand-500/20"
                            >
                                {t('settings.saveProfile')}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Google Calendar */}
            <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 dark:border-border/40 shadow-sm relative overflow-hidden flex flex-col h-full">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-3xl text-blue-600 dark:text-blue-400 backdrop-blur-md">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {t('settings.googleCalendar')}
                        </h3>
                    </div>
                </div>
                <div className="relative z-10 p-6 flex-1 flex flex-col justify-center space-y-6">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-muted-foreground leading-relaxed">
                            {t('settings.googleCalendarDescription')}
                        </p>

                        {hasGoogleCalendarSession ? (
                            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-500/20 rounded-3xl border border-green-500/20 backdrop-blur-sm">
                                <span className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center">
                                    <CheckCircle2 className="h-5 w-5 mr-2" />
                                    {t('settings.accountConnected')}
                                </span>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        clearGoogleToken();
                                        addToast(t('settings.disconnectGoogle'), "info");
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800 dark:border-red-900/30"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    {t('settings.disconnectGoogle')}
                                </Button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => loginToGoogle()}
                                className="w-full py-4 bg-white/50 dark:bg-white/5 border-2 border-white/40 dark:border-border/40 rounded-3xl text-sm font-bold text-slate-700 dark:text-white hover:border-blue-500 hover:bg-blue-500 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center shadow-sm group backdrop-blur-sm"
                            >
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                                {t('settings.connectGoogle')}
                            </button>
                        )}
                    </div>

                    <div className="pt-6 border-t border-white/20 dark:border-white/5">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{t('settings.integrationsPage.exportIcal')}</h4>
                        <p className="text-xs text-slate-600 dark:text-muted-foreground mb-4">
                            {t('settings.integrationsPage.exportIcalDesc')}
                        </p>
                        <Button
                            onClick={handleExportCalendar}
                            isLoading={exportingCalendar}
                            variant="outline"
                            className="w-full border-white/40 dark:border-border/40"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            {t('settings.integrationsPage.downloadIcs')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* SSO Settings - Enterprise */}
            <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 dark:border-border/40 shadow-sm relative overflow-hidden flex flex-col h-full md:col-span-2">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-50 dark:bg-brand-900 rounded-3xl text-brand-600 dark:text-brand-400 backdrop-blur-md">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.integrationsPage.ssoTitle')}</h3>
                        <span className="ml-auto px-2 py-1 text-[11px] font-bold bg-brand-100 text-brand-700 rounded-full border border-brand-200">ENTERPRISE</span>
                    </div>
                </div>
                <div className="relative z-10 p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-muted-foreground leading-relaxed">
                            {t('settings.integrationsPage.ssoDesc')}
                        </p>

                        <form className="space-y-4 pt-2" onSubmit={(e) => e.preventDefault()}>
                            <FloatingLabelInput
                                label="Provider URL / Issuer"
                                type="url"
                                name="ssoIssuer"
                                icon={ShieldCheck}
                                autoComplete="url"
                            />
                            <FloatingLabelInput
                                label="Client ID"
                                type="text"
                                name="ssoClientId"
                                icon={Key}
                                autoComplete="username"
                            />
                            <FloatingLabelInput
                                label="Client Secret"
                                type="password"
                                name="ssoClientSecret"
                                icon={Key}
                                autoComplete="current-password"
                            />
                        </form>
                    </div>

                    <div className="space-y-4 md:border-l md:border-white/20 md:pl-8 dark:border-white/5">
                        <h4 className="font-medium text-slate-900 dark:text-white">{t('settings.integrationsPage.ssoStatus')}</h4>
                        <div className="p-4 rounded-3xl bg-slate-50 dark:bg-white/5 border border-border/40 dark:border-border/40 flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                            <span className="text-sm text-slate-600 dark:text-muted-foreground">{t('settings.integrationsPage.notConfigured')}</span>
                        </div>

                        <div className="pt-4">
                            <Button className="w-full" disabled={true} variant="secondary">
                                {t('settings.integrationsPage.saveAndTest')}
                            </Button>
                            <p className="mt-2 text-xs text-center text-muted-foreground">
                                {t('settings.integrationsPage.contactSupport')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
