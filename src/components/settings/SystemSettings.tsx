import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { History, Trash2, Download } from '../ui/Icons';
import { Button } from '../ui/button';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { hasPermission } from '../../utils/permissions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SystemLog } from '../../types';

export const SystemSettings: React.FC = () => {
    const { user, addToast } = useStore();
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
    const handleExportLogs = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Date,Action,Details\n"
            + auditLogs.map(log => {
                const date = log.timestamp ? format(new Date((log.timestamp as any).seconds * 1000), 'dd/MM/yyyy HH:mm', { locale: fr }) : '-';
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
            {hasPermission(user, 'Settings', 'read') && (
                <div className="glass-panel rounded-[2.5rem] overflow-hidden border border-white/50 dark:border-white/5 shadow-sm">
                    <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                            <History className="h-5 w-5 mr-3 text-slate-500" />
                            Historique des activités
                        </h3>
                        <Button variant="ghost" size="sm" onClick={handleExportLogs} className="text-xs">
                            <Download className="h-4 w-4 mr-2" />
                            Export CSV
                        </Button>
                    </div>
                    <div className="p-0 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 border-b border-gray-100 dark:border-white/5">
                                <tr>
                                    <th className="px-6 py-3 font-semibold uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 font-semibold uppercase tracking-wider">Action</th>
                                    <th className="px-6 py-3 font-semibold uppercase tracking-wider">Détails</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
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
                                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                                                {log.timestamp ? format(new Date((log.timestamp as any).seconds * 1000), 'dd MMM HH:mm', { locale: fr }) : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{log.action}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 truncate max-w-xs" title={JSON.stringify(log.details)}>
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
            <div className="glass-panel rounded-[2.5rem] p-8 border border-red-200 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/5">
                <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">Zone Danger</h3>
                <p className="text-sm text-red-600/70 dark:text-red-400/70 mb-6">
                    La suppression de votre compte est irréversible. Toutes vos données personnelles seront effacées.
                </p>
                <div className="flex justify-end">
                    <button
                        onClick={handleDeleteAccount}
                        className="px-4 py-2 bg-white dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors flex items-center text-sm"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer mon compte
                    </button>
                </div>
            </div>
        </div>
    );
};
