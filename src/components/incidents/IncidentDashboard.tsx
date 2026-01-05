import React, { useMemo } from 'react';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Trash2, CalendarDays, Siren, ShieldAlert } from '../ui/Icons';
import { Incident, Criticality, UserProfile } from '../../types';
import { useStore } from '../../store';
import { EmptyState } from '../ui/EmptyState';
import { CardSkeleton } from '../ui/Skeleton';
import { hasPermission } from '../../utils/permissions';
import { DataTable } from '../ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { IncidentSummaryCard } from './dashboard/IncidentSummaryCard';
import { IncidentCharts } from './dashboard/IncidentCharts';
import { getUserAvatarUrl } from '../../utils/avatarUtils';

interface IncidentDashboardProps {
    incidents: Incident[];
    onCreate: () => void;
    onSelect: (incident: Incident) => void;
    loading?: boolean;
    onDelete?: (id: string) => void;
    onBulkDelete?: (ids: string[]) => void;
    viewMode: 'list' | 'grid';
    filter: string;
    users?: UserProfile[];
}

const getSeverityColor = (s: Criticality) => {
    switch (s) {
        case Criticality.CRITICAL: return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50 shadow-red-500/10';
        case Criticality.HIGH: return 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 shadow-orange-500/10';
        case Criticality.MEDIUM: return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 shadow-amber-500/10';
        default: return 'bg-blue-50 dark:bg-slate-900 text-blue-700 dark:bg-slate-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 shadow-blue-500/10';
    }
};

const getStatusColor = (s: string) => {
    switch (s) {
        case 'Nouveau': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
        case 'Analyse': return 'text-blue-600 bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20';
        case 'Contenu': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
        case 'Résolu': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
        case 'Fermé': return 'text-slate-600 bg-slate-100 dark:bg-slate-800 line-through decoration-slate-400';
        default: return 'text-slate-600 bg-gray-50';
    }
};

export const IncidentDashboard: React.FC<IncidentDashboardProps> = ({ incidents, onCreate, onSelect, loading = false, onDelete, onBulkDelete, viewMode, filter, users }) => {
    const { user } = useStore();
    const canDelete = !!user && hasPermission(user, 'Incident', 'delete');

    const filteredIncidents = useMemo(() => {
        if (!filter) return incidents;
        return incidents.filter(inc =>
            inc.title.toLowerCase().includes(filter.toLowerCase()) ||
            inc.description.toLowerCase().includes(filter.toLowerCase()) ||
            inc.category?.toLowerCase().includes(filter.toLowerCase())
        );
    }, [incidents, filter]);

    // Memoized category data for pie chart
    const categoryData = useMemo(() => {
        const data = incidents.reduce((acc, inc) => {
            const cat = inc.category || 'Non catégorisé';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [incidents]);

    // Memoized timeline data for bar chart
    const timelineData = useMemo(() => {
        const months = new Array(6).fill(0).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - 5 + i);
            return {
                name: d.toLocaleString('default', { month: 'short' }),
                date: d,
                count: 0
            };
        });

        incidents.forEach(inc => {
            const d = new Date(inc.dateReported);
            const monthIndex = months.findIndex(m =>
                m.date.getMonth() === d.getMonth() &&
                m.date.getFullYear() === d.getFullYear()
            );
            if (monthIndex !== -1) months[monthIndex].count++;
        });
        return months.every(m => m.count === 0) ? [] : months;
    }, [incidents]);

    // Metrics for Summary Card
    const columns = useMemo<ColumnDef<Incident>[]>(() => [
        {
            accessorKey: 'title',
            header: 'Incident',
            cell: ({ row }) => (
                <div>
                    <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.title}</div>
                    <div className="text-xs text-slate-600 font-medium line-clamp-1">{row.original.description}</div>
                </div>
            )
        },
        {
            accessorKey: 'severity',
            header: 'Sévérité',
            cell: ({ row }) => (
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getSeverityColor(row.original.severity)}`}>
                    {row.original.severity}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: 'Statut',
            cell: ({ row }) => (
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getStatusColor(row.original.status)}`}>
                    {row.original.status}
                </span>
            )
        },
        {
            accessorKey: 'dateReported',
            header: 'Date',
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {new Date(row.original.dateReported).toLocaleDateString()}
                </span>
            )
        },
        {
            accessorKey: 'reporter',
            header: 'Reporter',
            cell: ({ row }) => {
                const reporterName = row.original.reporter;
                const reporterUser = users?.find(u => u.displayName === reporterName || u.email === reporterName);
                return (
                    <div className="flex items-center gap-2">
                        <img
                            src={getUserAvatarUrl(reporterUser?.photoURL, reporterUser?.role)}
                            alt={reporterName}
                            className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700 object-cover bg-slate-100 dark:bg-slate-800"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getUserAvatarUrl(null, reporterUser?.role);
                            }}
                        />
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                            {reporterName}
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'category',
            header: 'Catégorie',
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {row.original.category || '-'}
                </span>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()} role="presentation">
                    {canDelete && onDelete && (
                        <CustomTooltip content="Supprimer l'incident">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(row.original.id);
                                }}
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:opacity-100"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </CustomTooltip>
                    )}
                </div>
            )
        }
    ], [canDelete, onDelete, users]);

    const totalIncidents = incidents.length;
    const openIncidents = incidents.filter(i => i.status !== 'Fermé').length;
    const criticalIncidents = incidents.filter(i => i.severity === Criticality.CRITICAL && (i.status !== 'Résolu' && i.status !== 'Fermé')).length;
    const resolutionRate = totalIncidents > 0
        ? Math.round(((totalIncidents - openIncidents) / totalIncidents) * 100)
        : 100;

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Summary Card */}
            <IncidentSummaryCard
                resolutionRate={resolutionRate}
                totalIncidents={totalIncidents}
                openIncidents={openIncidents}
                criticalIncidents={criticalIncidents}
            />

            {/* Graphs Section (Added for "Overview" request) */}
            <IncidentCharts
                categoryData={categoryData}
                timelineData={timelineData}
            />

            {/* Incident list */}
            {viewMode === 'list' ? (
                <div className="glass-panel w-full max-w-full rounded-[2.5rem] overflow-hidden shadow-sm">
                    <DataTable
                        columns={columns}
                        data={filteredIncidents}
                        selectable={true}
                        onBulkDelete={onBulkDelete}
                        onRowClick={onSelect} // onSelect handles navigation or drawer opening
                        searchable={false}
                        loading={loading}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {loading ? (
                        <div className="col-span-full"><CardSkeleton count={4} /></div>
                    ) : filteredIncidents.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={Siren}
                                title="Aucun incident signalé"
                                description={filter ? "Aucun incident ne correspond à votre recherche." : "Tout est calme. Aucun incident de sécurité n'a été rapporté pour le moment."}
                                actionLabel={filter || !hasPermission(user, 'Incident', 'create') ? undefined : "Déclarer un incident"}
                                onAction={filter || !hasPermission(user, 'Incident', 'create') ? undefined : onCreate}
                            />
                        </div>
                    ) : (
                        filteredIncidents.map((inc) => (
                            <div
                                key={inc.id}
                                onClick={() => onSelect(inc)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onSelect(inc);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover flex flex-col relative overflow-hidden cursor-pointer group border border-white/60 dark:border-white/10 hover:shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                            >
                                {inc.severity === Criticality.CRITICAL && (
                                    <div className="absolute top-6 right-6">
                                        <span className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-2">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getSeverityColor(inc.severity)}`}>
                                            {inc.severity}
                                        </span>
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${getStatusColor(inc.status)}`}>
                                            {inc.status}
                                        </span>
                                    </div>
                                    {canDelete && onDelete && (
                                        <CustomTooltip content="Supprimer l'incident">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(inc.id);
                                                }}
                                                className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </CustomTooltip>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-600 transition-colors leading-tight">
                                    {inc.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-2 leading-relaxed">
                                    {inc.description}
                                </p>
                                <div className="flex items-center justify-between pt-5 border-t border-dashed border-gray-200 dark:border-white/10 mt-auto">
                                    <div className="flex items-center text-xs font-medium text-slate-500">
                                        <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                        <span>{new Date(inc.dateReported).toLocaleDateString()}</span>
                                        <span className="mx-2">•</span>
                                        <div className="flex items-center gap-1.5">
                                            <img
                                                src={getUserAvatarUrl(users?.find(u => u.displayName === inc.reporter || u.email === inc.reporter)?.photoURL, users?.find(u => u.displayName === inc.reporter || u.email === inc.reporter)?.role)}
                                                alt={inc.reporter}
                                                className="w-4 h-4 rounded-full object-cover bg-slate-100 dark:bg-slate-800"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = getUserAvatarUrl(null, users?.find(u => u.displayName === inc.reporter || u.email === inc.reporter)?.role);
                                                }}
                                            />
                                            <span>{inc.reporter}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {inc.category && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelect(inc);
                                                }}
                                                className="text-xs px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg hover:scale-105 transition-transform font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                            >
                                                Playbook
                                            </button>
                                        )}
                                        <div className="text-xs text-brand-600 font-bold flex items-center group-hover:translate-x-1 transition-transform">
                                            Ouvrir <ShieldAlert className="ml-1.5 h-3.5 w-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
