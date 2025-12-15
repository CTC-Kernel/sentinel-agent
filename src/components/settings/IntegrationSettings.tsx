import React, { useState } from 'react';
import { useStore } from '../../store';
import { BrainCircuit, Key, Calendar, CheckCircle2, Download } from '../ui/Icons';
import { useForm, SubmitHandler } from 'react-hook-form';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { ErrorLogger } from '../../services/errorLogger';
import { useGoogleLogin } from '@react-oauth/google';
import { Project, Audit } from '../../types';
import { mapAuditsToEvents, mapTasksToEvents, generateICS, downloadICS } from '../../utils/calendarUtils';
import { Button } from '../ui/button';

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
            {/* AI Settings */}
            <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center"><BrainCircuit className="h-5 w-5 mr-3 text-purple-500" />{t('settings.aiSettings')}</h3>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            {t('settings.aiDescription')}
                        </p>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">{t('settings.geminiApiKey')}</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-medium text-sm dark:text-white pr-10"
                                    placeholder="AIzaSy..."
                                    {...register('geminiApiKey')}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <Key className="h-4 w-4 text-slate-500" />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1.5 ml-1">
                                {t('settings.geminiPlaceholder')}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleSubmit(handleUpdateKeys)}
                        disabled={savingKeys}
                        className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/10 flex items-center justify-center mt-4"
                    >
                        {savingKeys ? '...' : t('settings.saveProfile')}
                    </button>
                </div>
            </div>

            {/* Google Calendar */}
            <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-full">
                <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                        <Calendar className="h-5 w-5 mr-3 text-blue-500" />
                        {t('settings.googleCalendar')}
                    </h3>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-center space-y-6">
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            {t('settings.googleCalendarDescription')}
                        </p>

                        {localStorage.getItem('google_access_token') ? (
                            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-100 dark:border-green-900/20">
                                <span className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center">
                                    <CheckCircle2 className="h-5 w-5 mr-2" />
                                    {t('settings.accountConnected')}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        localStorage.removeItem('google_access_token');
                                        addToast(t('settings.disconnectGoogle'), "info");
                                        window.location.reload();
                                    }}
                                    className="text-xs bg-white dark:bg-white/10 px-3 py-1.5 rounded-lg text-red-500 hover:text-red-600 font-bold shadow-sm"
                                >
                                    {t('settings.disconnectGoogle')}
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => loginToGoogle()}
                                className="w-full py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-white/10 rounded-2xl text-sm font-bold text-slate-700 dark:text-white hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center shadow-sm group"
                            >
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                                {t('settings.connectGoogle')}
                            </button>
                        )}
                    </div>

                    <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Export iCal / Outlook</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                            Téléchargez vos tâches et audits pour Outlook, Apple Calendar, etc.
                        </p>
                        <Button
                            onClick={handleExportCalendar}
                            isLoading={exportingCalendar}
                            variant="outline"
                            className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all shadow-sm flex items-center justify-center"
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
