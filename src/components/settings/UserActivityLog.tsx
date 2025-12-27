import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import { Activity, Globe, User } from 'lucide-react';
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
    const [viewMode, setViewMode] = useState<'my' | 'global'>('my');

    const isAdmin = user?.role === 'admin' || user?.role === 'rssi';

    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchLogs = async () => {
            setLoading(true);
            const logsRef = collection(db, 'system_logs');
            try {
                let q;

                if (viewMode === 'global' && isAdmin) {
                    // Global Query
                    // Requires index: [organizationId, timestamp]
                    q = query(
                        logsRef,
                        where('organizationId', '==', user.organizationId),
                        orderBy('timestamp', 'desc'),
                        limit(100)
                    );
                } else {
                    // Personal Query
                    // Requires index: [userId, timestamp] (or composite with orgId to be safe)
                    // The original query used organizationId + userId.
                    q = query(
                        logsRef,
                        where('userId', '==', user.uid),
                        where('organizationId', '==', user.organizationId),
                        orderBy('timestamp', 'desc'),
                        limit(50)
                    );
                }

                const snapshot = await getDocs(q);
                const fetchedLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog));
                setLogs(fetchedLogs);
            } catch (error) {
                ErrorLogger.warn('Query failed, falling back to simple query', 'UserActivityLog.fetchLogs', { metadata: { error } });
                try {
                    // Fallback strategy if indexes are missing
                    const simpleQ = query(
                        logsRef,
                        where('organizationId', '==', user.organizationId),
                        limit(200) // Fetch more then sort client side
                    );
                    const snapshot = await getDocs(simpleQ);
                    let fetchedLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog));

                    // Client-side Filter for 'my'
                    if (viewMode === 'my') {
                        fetchedLogs = fetchedLogs.filter(l => l.userId === user.uid);
                    }

                    // Client-side Sort
                    fetchedLogs.sort((a, b) => {
                        const getMillis = (timestamp: unknown) => {
                            if (timestamp && typeof timestamp === 'object' && 'toMillis' in timestamp) {
                                return (timestamp as { toMillis: () => number }).toMillis();
                            }
                            // Handle if it's already a date object or string
                            return new Date(timestamp as string | number | Date).getTime();
                        };
                        return getMillis(b.timestamp) - getMillis(a.timestamp);
                    });

                    setLogs(fetchedLogs.slice(0, 100));

                } catch (retryError) {
                    ErrorLogger.handleErrorWithToast(retryError, 'UserActivityLog.fetchLogs', 'FETCH_FAILED');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, [user, viewMode, isAdmin]);

    const columns = useMemo<ColumnDef<SystemLog>[]>(() => {
        const cols: ColumnDef<SystemLog>[] = [
            {
                accessorKey: 'timestamp',
                header: t('common.date'),
                cell: ({ row }) => {
                    const val = row.original.timestamp;
                    if (!val) return '-';
                    const date = (typeof val === 'object' && val && 'toDate' in val)
                        ? (val as { toDate: () => Date }).toDate()
                        : new Date(val as string | number);
                    try {
                        // Check if date is valid
                        if (isNaN(date.getTime())) return '-';
                        return format(date, 'Pp', { locale: fr });
                    } catch { return '-'; }
                }
            }
        ];

        // Add User column if global view
        if (viewMode === 'global') {
            cols.push({
                accessorKey: 'userDisplayName',
                header: 'Utilisateur',
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="font-medium text-slate-900 dark:text-white text-sm">
                            {row.original.userDisplayName || row.original.userEmail}
                        </span>
                        <span className="text-xs text-slate-500">{row.original.userEmail}</span>
                    </div>
                )
            });
        }

        cols.push(
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
                cell: ({ getValue }) => {
                    const val = getValue() as string;
                    const displayVal = typeof val === 'object' ? JSON.stringify(val) : val;
                    return (
                        <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-xs block" title={displayVal}>
                            {displayVal || '-'}
                        </span>
                    );
                }
            }
        );
        return cols;
    }, [t, viewMode]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent animate-slide-in-left">
                        {isAdmin && viewMode === 'global' ? t('settings.activityPage.globalLog') : t('settings.activityPage.myLog')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        {isAdmin && viewMode === 'global' ? t('settings.activityPage.globalLogDesc') : t('settings.activityPage.myLogDesc')}
                    </p>
                </div>

                {isAdmin && (
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-white/10 self-start md:self-center">
                        <button
                            onClick={() => setViewMode('my')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${viewMode === 'my'
                                ? 'bg-white dark:bg-brand-600 text-brand-600 dark:text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                {t('settings.activityPage.me')}
                            </span>
                        </button>
                        <button
                            onClick={() => setViewMode('global')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${viewMode === 'global'
                                ? 'bg-white dark:bg-brand-600 text-brand-600 dark:text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            <span className="flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                {t('settings.activityPage.global')}
                            </span>
                        </button>
                    </div>
                )}
            </div>

            <div className="glass-panel p-0 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="relative z-10 p-6 border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-500/10 dark:bg-brand-500/20 rounded-xl text-brand-600 dark:text-brand-400 backdrop-blur-md shadow-sm">
                            <Activity className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {isAdmin && viewMode === 'global' ? t('settings.activityPage.recentActionsOrg') : t('settings.activityPage.recentActionsMe')}
                        </h3>
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
                                icon={viewMode === 'global' ? Globe : Activity}
                                title={t('settings.activityPage.noActivity')}
                                description={viewMode === 'global' ? t('settings.activityPage.noActivityGlobal') : t('settings.activityPage.noActivityMe')}
                                color="slate"
                            />
                        }
                    />
                </div>
            </div>
        </div>
    );
};
