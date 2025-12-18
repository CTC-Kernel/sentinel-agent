import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { Activity, Search } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SystemLog } from '../../types';
import { DataTable } from '../ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { EmptyState } from '../ui/EmptyState';

export const UserActivityLog: React.FC = () => {
    const { user, t } = useStore();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user?.uid) return;

        const fetchLogs = async () => {
            setLoading(true);
            const logsRef = collection(db, 'system_logs');
            try {
                // Create a compound query for user-specific logs
                // Note: Requires composite index on [userId, timestamp]
                const q = query(
                    logsRef,
                    where('userId', '==', user.uid),
                    where('organizationId', '==', user.organizationId),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );

                const snapshot = await getDocs(q);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fetchedLogs = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) })) as SystemLog[];
                setLogs(fetchedLogs);
            } catch (error) {
                // If index fails, try client-side sorting or simpler query
                console.warn('Index missing or query failed, trying simpler query', error);
                try {
                    const simpleQ = query(
                        logsRef,
                        where('userId', '==', user.uid),
                        limit(100)
                    );
                    const snapshot = await getDocs(simpleQ);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const fetchedLogs = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) })) as SystemLog[];
                    fetchedLogs.sort((a, b) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const tA = (a.timestamp as any)?.toMillis?.() || new Date(a.timestamp as string).getTime() || 0;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const tB = (b.timestamp as any)?.toMillis?.() || new Date(b.timestamp as string).getTime() || 0;
                        return tB - tA;
                    });
                    setLogs(fetchedLogs.slice(0, 50));
                } catch (retryError) {
                    ErrorLogger.handleErrorWithToast(retryError, 'UserActivityLog.fetchLogs', 'FETCH_FAILED');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [user]);

    const columns = useMemo<ColumnDef<SystemLog>[]>(() => [
        {
            accessorKey: 'timestamp',
            header: t('common.date'),
            cell: ({ row }) => {
                const val = row.original.timestamp;
                if (!val) return '-';
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const date = (val as any).toDate ? (val as any).toDate() : new Date(val as string | number);
                return format(date, 'Pp', { locale: fr });
            }
        },
        {
            accessorKey: 'action',
            header: t('common.action'),
            cell: ({ getValue }) => (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800">
                    {getValue() as string}
                </span>
            )
        },
        {
            accessorKey: 'resource',
            header: 'Module',
            cell: ({ getValue }) => (
                <span className="font-medium text-slate-600 dark:text-slate-400 text-xs">
                    {getValue() as string}
                </span>
            )
        },
        {
            accessorKey: 'details',
            header: 'Détails',
            cell: ({ row }) => {
                const details = row.original.details || (row.original as any).message;
                const str = typeof details === 'string' ? details : JSON.stringify(details);
                return (
                    <span className="text-slate-500 dark:text-slate-400 text-xs truncate max-w-[300px] block" title={str}>
                        {str}
                    </span>
                );
            }
        }
    ], [t]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white animate-slide-in-left">Mon Activité</h2>
                <p className="text-slate-500 dark:text-slate-400">Historique de vos actions récentes sur la plateforme.</p>
            </div>

            <div className="glass-panel p-0 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-500/10 dark:bg-brand-500/20 rounded-xl text-brand-600 dark:text-brand-400 backdrop-blur-md shadow-sm">
                            <Activity className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Journal d'activité</h3>
                    </div>
                </div>
                <div className="relative z-10 p-2">
                    <DataTable
                        columns={columns}
                        data={logs}
                        loading={loading}
                        className="bg-transparent border-none"
                        emptyState={
                            <EmptyState
                                icon={Search}
                                title="Aucune activité"
                                description="Vous n'avez pas encore effectué d'actions enregistrées."
                                color="slate"
                            />
                        }
                    />
                </div>
            </div>
        </div>
    );
};
