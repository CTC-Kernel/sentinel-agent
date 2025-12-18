
import React, { useMemo } from 'react';
import { DataTable } from '../ui/DataTable';
import { SystemLog } from '../../types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Activity, User, Shield } from 'lucide-react';

interface ActivityLogListProps {
    logs: SystemLog[];
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
}

export const ActivityLogList: React.FC<ActivityLogListProps> = ({ logs, loading, hasMore, onLoadMore }) => {

    const columns = useMemo<ColumnDef<SystemLog>[]>(() => [
        {
            accessorKey: 'timestamp',
            header: 'Date',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium text-slate-900 dark:text-white">
                        {format(new Date(row.original.timestamp), 'dd MMM yyyy', { locale: fr })}
                    </span>
                    <span className="text-xs text-slate-500">
                        {format(new Date(row.original.timestamp), 'HH:mm:ss', { locale: fr })}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'userEmail',
            header: 'Utilisateur',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                        <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {row.original.userEmail}
                        </span>
                        {/* We could fetch Display Name if we had it, but email is reliable */}
                    </div>
                </div>
            )
        },
        {
            accessorKey: 'action',
            header: 'Action',
            cell: ({ row }) => {
                const action = row.original.action;
                let colorClass = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                if (['create', 'add', 'upload'].some(k => action.toLowerCase().includes(k))) {
                    colorClass = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
                } else if (['delete', 'remove', 'destroy'].some(k => action.toLowerCase().includes(k))) {
                    colorClass = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                } else if (['update', 'edit', 'modify'].some(k => action.toLowerCase().includes(k))) {
                    colorClass = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                }

                return (
                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${colorClass}`}>
                        {action}
                    </span>
                );
            }
        },
        {
            accessorKey: 'resource',
            header: 'Ressource',
            cell: ({ row }) => (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Shield className="h-4 w-4" />
                    <span>{row.original.resource}</span>
                </div>
            )
        },
        {
            accessorKey: 'details',
            header: 'Détails',
            cell: ({ row }) => (
                <div className="truncate max-w-xs text-slate-500" title={row.original.details}>
                    {row.original.details || '-'}
                </div>
            )
        }
    ], []);

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={logs}
                loading={loading && logs.length === 0}
                searchable
                exportable
                exportFilename={`audit-logs-${format(new Date(), 'yyyy-MM-dd')}`}
                pageSize={25}
                emptyState={
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <Activity className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-lg font-medium">Aucune activité enregistrée</p>
                    </div>
                }
            />

            {hasMore && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Chargement...' : 'Charger plus d\'activités'}
                    </button>
                </div>
            )}
        </div>
    );
};
