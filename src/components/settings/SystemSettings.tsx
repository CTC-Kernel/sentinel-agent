import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { Activity, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { hasPermission } from '../../utils/permissions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SystemLog } from '../../types';
import { DataTable } from '../ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';

export const SystemSettings: React.FC = () => {
    const { user, addToast, t } = useStore();
    const [auditLogs, setAuditLogs] = useState<SystemLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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

    const handleDeleteAccount = () => {
        setIsDeleting(true);
        // Simulate delete for now or implement real logic
        setTimeout(() => {
            addToast("Veuillez contacter votre administrateur pour supprimer votre compte.", "info");
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }, 1000);
    };

    const columns = useMemo<ColumnDef<SystemLog>[]>(() => [
        {
            accessorKey: 'timestamp',
            header: t('common.date'),
            cell: ({ row }) => {
                const val = row.original.timestamp;
                // Handle Firestore Timestamp or Date string
                if (!val) return '-';
                const date = (val as any).toDate ? (val as any).toDate() : new Date(val as any);
                return format(date, 'Pp', { locale: fr });
            }
        },
        {
            accessorKey: 'userId',
            header: t('common.user'),
            cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>
        },
        {
            accessorKey: 'action',
            header: t('common.action'),
            cell: ({ getValue }) => (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {getValue() as string}
                </span>
            )
        },
        {
            accessorKey: 'details', // Assuming key is 'details' or similar, implied from previous code
            header: 'Détails',
            cell: ({ row }) => {
                const details = (row.original as any).details || (row.original as any).message; // Fallback if needed
                const str = typeof details === 'string' ? details : JSON.stringify(details);
                return (
                    <span className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[200px] block" title={str}>
                        {str}
                    </span>
                );
            }
        }
    ], [t]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 animate-slide-in-left">{t('settings.system')}</h2>

            {hasPermission(user, 'Settings', 'read') && (
                <div className="glass-panel p-0 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400 backdrop-blur-md shadow-sm">
                                <Activity className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('settings.activityHistory')}</h3>
                        </div>
                    </div>
                    <div className="relative z-10 p-2">
                        <DataTable
                            columns={columns}
                            data={auditLogs}
                            loading={loadingLogs}
                            // emptyMessage is not part of props based on previous view, check if it's rendered inside?
                            // Checked DataTable.tsx: it renders "Aucune donnée à afficher" if rows.length === 0.
                            // The prop 'emptyMessage' does NOT exist in the interface in DataTable.tsx view!
                            // So I will omit it to be safe, or check if it supports it.
                            // ... wait, I saw line 238 "Aucune donnée à afficher" hardcoded?
                            // DataTable.tsx line 238: Aucune donnée à afficher. It does NOT take a prop.
                            // Check DataTableProps lines 16-28: no emptyMessage.
                            className="bg-transparent border-none"
                        />
                    </div>
                </div>
            )}

            {/* Danger Zone */}
            <div className="glass-panel p-8 rounded-[2.5rem] border border-red-500/30 dark:border-red-500/20 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-50" />
                <div className="relative z-10">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-red-500/10 dark:bg-red-500/20 rounded-2xl text-red-600 dark:text-red-400 shrink-0 backdrop-blur-md">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-red-900 dark:text-red-400 mb-2 flex items-center gap-2">
                                {t('settings.dangerZone')}
                            </h3>
                            <p className="text-sm text-red-700/80 dark:text-red-300/70 mb-6 leading-relaxed max-w-2xl">
                                {t('settings.deleteAccountDescription')}
                            </p>
                            <Button
                                variant="destructive"
                                isLoading={isDeleting}
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="w-full sm:w-auto shadow-lg shadow-red-500/20 rounded-xl"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('settings.deleteAccount')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
