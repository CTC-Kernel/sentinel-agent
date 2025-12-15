import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { History, Trash2, Download, AlertTriangle } from '../ui/Icons';
import { Button } from '../ui/button';
import { collection, query, where, getDocs, limit, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { hasPermission } from '../../utils/permissions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SystemLog } from '../../types';

export const SystemSettings: React.FC = () => {
    const { user, addToast, t } = useStore();
    const [auditLogs, setAuditLogs] = useState<SystemLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        if (!hasPermission(user, 'Settings', 'read')) return;

        const fetchLogs = async () => {
            setLoadingLogs(true);
            try {
                // Fetch last 50 logs for the user's org
                const logsRef = collection(db, 'auditLogs');
                const q = query(
                    logsRef,
                    where('organizationId', '==', user?.organizationId),
                    orderBy('timestamp', 'desc'),
                    limit(20)
                );
                const snapshot = await getDocs(q);
                setAuditLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SystemLog[]);
            } catch (error) {
                ErrorLogger.handleErrorWithToast(error, 'SystemSettings.fetchLogs', 'FETCH_FAILED');
            } finally {
                setLoadingLogs(false);
            }
        };

        fetchLogs();
    }, [user]);

    const formatDate = (timestamp: string | Timestamp | undefined | null) => {
        if (!timestamp) return '-';
        let date: Date;
        if (typeof timestamp === 'object' && 'seconds' in timestamp) {
            date = new Date(timestamp.seconds * 1000);
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else {
            return '-';
        }
        return format(date, 'dd/MM/yyyy HH:mm', { locale: fr });
    };

    const handleExportLogs = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Date,Action,Details\n"
            + auditLogs.map(log => {
                const date = formatDate(log.timestamp as unknown as Timestamp);
                return `${date},${log.action},"${typeof log.details === 'string' ? log.details : JSON.stringify(log.details).replace(/"/g, '""')}"`;
            }).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `system_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDeleteAccount = () => {
        addToast("Veuillez contacter votre administrateur pour supprimer votre compte.", "info");
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('settings.system')}</h2>

            {hasPermission(user, 'Settings', 'read') && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                                <History className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Historique des activités</h3>
                                <p className="text-xs text-slate-500">Activités récentes de l'organisation</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExportLogs} className="bg-white dark:bg-slate-900">
                            <Download className="h-4 w-4 mr-2" />
                            Export CSV
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Détails</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {loadingLogs ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                                            Chargement...
                                        </td>
                                    </tr>
                                ) : auditLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                                            Aucune activité récente.
                                        </td>
                                    </tr>
                                ) : (
                                    auditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                                                {formatDate(log.timestamp as unknown as Timestamp)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{log.action}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 truncate max-w-xs font-mono" title={JSON.stringify(log.details)}>
                                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Danger Zone */}
            <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl p-8 border border-red-100 dark:border-red-900/20">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl text-red-600 dark:text-red-400 shrink-0">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-red-900 dark:text-red-400 mb-2">Zone Danger</h3>
                        <p className="text-sm text-red-700/80 dark:text-red-300/70 mb-6 leading-relaxed">
                            La suppression de votre compte est une action irréversible. Toutes vos données personnelles, ainsi que l'accès à l'organisation, seront définitivement effacés.
                        </p>
                        <Button
                            onClick={handleDeleteAccount}
                            className="bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-500/20"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer mon compte
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
