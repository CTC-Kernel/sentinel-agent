
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../ui/DataTable';
import { SystemLog } from '../../types';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Activity, User, Shield } from '../ui/Icons';

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
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
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
                let colorClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                if (['create', 'add', 'upload'].some(k => action.toLowerCase().includes(k))) {
                    colorClass = "bg-green-100 text-green-700 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400";
                } else if (['delete', 'remove', 'destroy'].some(k => action.toLowerCase().includes(k))) {
                    colorClass = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
                } else if (['update', 'edit', 'modify'].some(k => action.toLowerCase().includes(k))) {
                    colorClass = "bg-blue-100 text-blue-700 dark:text-blue-400 dark:bg-blue-900/30 dark:text-blue-400";
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
            cell: ({ row }) => {
                const { resource, resourceId } = row.original;
                let linkPath = null;

                if (resourceId) {
                    switch (resource) {
                        case 'Risk':
                        case 'Risque':
                            linkPath = `/risks?open=${resourceId}`;
                            break;
                        case 'Asset':
                        case 'Actif':
                            linkPath = `/assets?open=${resourceId}`;
                            break;
                        case 'Control':
                        case 'Contrôle':
                            linkPath = `/compliance?open=${resourceId}`;
                            break;
                        case 'Audit':
                            linkPath = `/audits?open=${resourceId}`;
                            break;
                        case 'Document':
                            linkPath = `/documents?open=${resourceId}`;
                            break;
                        case 'Incident':
                            linkPath = `/incidents?open=${resourceId}`;
                            break;
                        case 'Project':
                        case 'Projet':
                            linkPath = `/projects?open=${resourceId}`;
                            break;
                        case 'Supplier':
                        case 'Fournisseur':
                            linkPath = `/suppliers?open=${resourceId}`;
                            break;
                        default:
                            linkPath = null;
                    }
                }

                return (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-muted-foreground">
                        <Shield className="h-4 w-4" />
                        {linkPath ? (
                            <Link to={linkPath} className="hover:text-brand-600 hover:underline transition-colors font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-sm">
                                {resource}
                            </Link>
                        ) : (
                            <span>{resource}</span>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: 'details',
            header: 'Détails',
            cell: ({ row }) => {
                const { details, changes } = row.original;
                return (
                    <div className="text-sm">
                        {details && <div className="text-slate-500 truncate max-w-xs" title={details}>{details}</div>}
                        {changes && changes.length > 0 && (
                            <details className="mt-1 group">
                                <summary className="cursor-pointer text-xs text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1 font-medium select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-sm px-1 -ml-1">
                                    Voir {changes.length} modifications
                                </summary>
                                <div className="mt-2 text-xs bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-border/40 dark:border-white/5 space-y-1 max-w-sm overflow-x-auto">
                                    {changes.map((change, i) => (
                                        <div key={`change-${i || 'unknown'}`} className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate" title={change.field}>{change.field}</span>
                                            <span className="text-muted-foreground">→</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-red-500 line-through opacity-70 truncate max-w-[80px]" title={String(change.oldValue)}>{String(change.oldValue)}</span>
                                                <span className="text-green-600 dark:text-green-400 font-bold truncate max-w-[80px]" title={String(change.newValue)}>{String(change.newValue)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                );
            }
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
                        <Activity className="h-12 w-12 mb-4 opacity-60" />
                        <p className="text-lg font-medium">Aucune activité enregistrée</p>
                    </div>
                }
            />

            {hasMore && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        className="px-6 py-2 bg-white dark:bg-slate-800 border border-border/40 dark:border-border/40 rounded-3xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        {loading ? 'Chargement...' : 'Charger plus d\'activités'}
                    </button>
                </div>
            )}
        </div>
    );
};
