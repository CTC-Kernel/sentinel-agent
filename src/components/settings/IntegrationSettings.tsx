import React, { useState } from 'react';
import { useStore } from '../../store';
import { BrainCircuit, Key, Calendar, CheckCircle2, Download, LogOut } from '../ui/Icons';
import { useForm, SubmitHandler } from 'react-hook-form';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { ErrorLogger } from '../../services/errorLogger';
import { useGoogleLogin } from '@react-oauth/google';
import { Project, Audit } from '../../types';
import { mapAuditsToEvents, mapTasksToEvents, generateICS, downloadICS } from '../../utils/calendarUtils';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';

export const IntegrationSettings: React.FC = () => {
    const { user, setUser, addToast, t } = useStore();
    const [savingKeys, setSavingKeys] = useState(false);
    const [exportingCalendar, setExportingCalendar] = useState(false);

    // AI Keys Form
    const { register, handleSubmit } = useForm({
        defaultValues: {
            geminiApiKey: user?.hasGeminiKey ? '' : '',
        }
    });

    const handleUpdateKeys: SubmitHandler<{ geminiApiKey: string }> = async (data) => {
        if (!user) return;
        setSavingKeys(true);
        try {
            const functions = getFunctions();
            const saveUserApiKeys = httpsCallable(functions, 'saveUserApiKeys');
            const payload: Record<string, string> = {};
            if (data.geminiApiKey) payload.geminiApiKey = data.geminiApiKey;

            await saveUserApiKeys(payload);

            const updatedUser = { ...user, hasGeminiKey: !!data.geminiApiKey || user.hasGeminiKey };
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
            localStorage.setItem('google_access_token', tokenResponse.access_token);
            addToast(t('settings.googleCalendarConnected'), "success");
            window.location.reload(); // Quick way to refresh UI state for this demo
        },
        scope: 'https://www.googleapis.com/auth/calendar'
    });

    const handleExportCalendar = async () => {
        if (!user?.organizationId) return;
        setExportingCalendar(true);
        try {
            // Fetch Projects
            const projectsRef = collection(db, 'projects');
            const qProj = query(projectsRef, where('organizationId', '==', user.organizationId));
            const projSnap = await getDocs(qProj);
            const projects = projSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Project[];

            // Extract tasks assigned to user
            const myTasks = projects.flatMap(p => p.tasks || []).filter(task => task.assigneeId === user.uid);

            // Fetch Audits
            const auditsRef = collection(db, 'audits');
            const qAudit = query(auditsRef, where('organizationId', '==', user.organizationId));
            const auditSnap = await getDocs(qAudit);
            const audits = auditSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Audit[];

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 col-span-1 md:col-span-2">{t('settings.integrations')}</h2>

            {/* AI Settings */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <BrainCircuit className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.aiSettings')}</h3>
                    </div>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                            {t('settings.aiDescription')}
                        </p>
                        <form onSubmit={handleSubmit(handleUpdateKeys)} className="space-y-4">
                            {/* Accessibility: hidden username field for password managers */}
                            <input
                                type="text"
                                name="username"
                                autoComplete="username"
                                className="hidden"
                                aria-hidden="true"
                                readOnly
                            />
                            <FloatingLabelInput
                                label={t('settings.geminiApiKey')}
                                type="password"
                                {...register('geminiApiKey')}
                                autoComplete="new-password"
                                icon={Key}
                                placeholder={user?.hasGeminiKey ? '••••••••••••••••' : ''}
                            />
                            <p className="text-[10px] text-slate-500 ml-1">
                                {t('settings.geminiPlaceholder')}
                            </p>
                            <Button
                                type="submit"
                                isLoading={savingKeys}
                                className="w-full mt-2"
                            >
                                {t('settings.saveProfile')}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Google Calendar */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {t('settings.googleCalendar')}
                        </h3>
                    </div>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-center space-y-6">
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {t('settings.googleCalendarDescription')}
                        </p>

                        {localStorage.getItem('google_access_token') ? (
                            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                                <span className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center">
                                    <CheckCircle2 className="h-5 w-5 mr-2" />
                                    {t('settings.accountConnected')}
                                </span>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        localStorage.removeItem('google_access_token');
                                        addToast(t('settings.disconnectGoogle'), "info");
                                        window.location.reload();
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    {t('settings.disconnectGoogle')}
                                </Button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => loginToGoogle()}
                                className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-white hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center shadow-sm group"
                            >
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                                {t('settings.connectGoogle')}
                            </button>
                        )}
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-slate-700/50">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Export iCal / Outlook</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                            Téléchargez vos tâches et audits pour Outlook, Apple Calendar, etc.
                        </p>
                        <Button
                            onClick={handleExportCalendar}
                            isLoading={exportingCalendar}
                            variant="outline"
                            className="w-full"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Télécharger .ics
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
