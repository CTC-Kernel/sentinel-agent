import React, { useMemo, useCallback } from 'react';
import { PremiumCard } from '../ui/PremiumCard';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Trash2, CalendarDays, Siren, ShieldAlert, Lock, Mail, HardDrive, WifiOff, Database } from '../ui/Icons';
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
import { NIS2DeadlineTimer } from './NIS2DeadlineTimer';

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
        case Criticality.CRITICAL: return 'bg-error-bg text-error-text border-error-border/60 shadow-sm';
        case Criticality.HIGH: return 'bg-warning-bg text-warning-text border-warning-border/60 shadow-sm';
        case Criticality.MEDIUM: return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 shadow-sm';
        default: return 'bg-info-bg text-info-text border-info-border/60 shadow-sm';
    }
};

const getStatusColor = (s: string) => {
    switch (s) {
        case 'Nouveau': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800/50';
        case 'Analyse': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800';
        case 'Contenu': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800';
        case 'Résolu': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800/50';
        case 'Fermé': return 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 line-through opacity-70';
        default: return 'text-slate-600 bg-slate-50 border-slate-200 dark:border-slate-700';
    }
};

const getIncidentCategoryStyles = (category: string) => {
    switch (category) {
        case 'Ransomware':
            return { icon: Lock, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-800' };
        case 'Phishing':
            return { icon: Mail, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-100 dark:border-purple-800/50' };
        case 'Vol Matériel':
            return { icon: HardDrive, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-100 dark:border-orange-800/50' };
        case 'Indisponibilité':
            return { icon: WifiOff, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800' };
        case 'Fuite de Données':
            return { icon: Database, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800' };
        default:
            return { icon: ShieldAlert, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-white/5', border: 'border-slate-100 dark:border-white/10' };
    }
};

export const IncidentDashboard: React.FC<IncidentDashboardProps> = ({ incidents, onCreate, onSelect, loading = false, onDelete, onBulkDelete, viewMode, filter, users }) => {
    const { user, t } = useStore();
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
            const cat = inc.category || t('incidents.uncategorized');
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(data).map(([name, value]) => ({ name, value }));
    }, [incidents, t]);

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

    // Helper for localizing status/severity labels - wrapped in useCallback for memoization stability
    const getStatusLabel = useCallback((s: string) => {
        switch (s) {
            case 'Nouveau': return t('incidents.status.new');
            case 'Analyse': return t('incidents.status.analysis');
            case 'Contenu': return t('incidents.status.containment');
            case 'Résolu': return t('incidents.status.resolved');
            case 'Fermé': return t('incidents.status.closed');
            default: return s;
        }
    }, [t]);

    const getSeverityLabel = useCallback((s: Criticality) => {
        switch (s) {
            case Criticality.CRITICAL: return t('incidents.severity.critical');
            case Criticality.HIGH: return t('incidents.severity.high');
            case Criticality.MEDIUM: return t('incidents.severity.medium');
            case Criticality.LOW: return t('incidents.severity.low');
            default: return s;
        }
    }, [t]);

    // Metrics for Summary Card
    const columns = useMemo<ColumnDef<Incident>[]>(() => [
        {
            accessorKey: 'title',
            header: t('incidents.column.incident'),
            cell: ({ row }) => {
                const styles = getIncidentCategoryStyles(row.original.category || '');
                const CategoryIcon = styles.icon;
                return (
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg border shadow-sm ${styles.bg} ${styles.color} ${styles.border}`}>
                            <CategoryIcon className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.title}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-1">{row.original.description}</div>
                        </div>
                    </div>
                );
            }
        },
        {
            accessorKey: 'severity',
            header: t('incidents.column.severity'),
            meta: { className: 'hidden sm:table-cell' },
            cell: ({ row }) => (
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getSeverityColor(row.original.severity)}`}>
                    {getSeverityLabel(row.original.severity)}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: t('incidents.column.status'),
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => (
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getStatusColor(row.original.status)}`}>
                    {getStatusLabel(row.original.status)}
                </span>
            )
        },
        {
            accessorKey: 'dateReported',
            header: t('incidents.column.date'),
            meta: { className: 'hidden lg:table-cell' },
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-muted-foreground font-medium">
                    {new Date(row.original.dateReported).toLocaleDateString()}
                </span>
            )
        },
        {
            accessorKey: 'reporter',
            header: t('incidents.column.reporter'),
            meta: { className: 'hidden xl:table-cell' },
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
                        <span className="text-slate-600 dark:text-muted-foreground font-medium">
                            {reporterName}
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: 'category',
            header: t('incidents.column.category'),
            meta: { className: 'hidden md:table-cell' },
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-muted-foreground font-medium">
                    {row.original.category || '-'}
                </span>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()} role="presentation">
                    {canDelete && onDelete && (
                        <CustomTooltip content={t('common.delete')}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(row.original.id);
                                }}
                                className="p-2 text-slate-500 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-70 transform scale-90 hover:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:opacity-70"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </CustomTooltip>
                    )}
                </div>
            )
        }
    ], [canDelete, onDelete, users, t, getSeverityLabel, getStatusLabel]);

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
                <div className="glass-panel w-full max-w-full rounded-3xl overflow-hidden shadow-sm">
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
                                title={t('incidents.empty.title')}
                                description={filter ? t('incidents.empty.noResults') : t('incidents.empty.desc')}
                                actionLabel={filter || !hasPermission(user, 'Incident', 'create') ? undefined : t('incidents.declare')}
                                onAction={filter || !hasPermission(user, 'Incident', 'create') ? undefined : onCreate}
                            />
                        </div>
                    ) : (
                        filteredIncidents.map((inc) => (
                            <PremiumCard glass
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
                                hover={true}
                                className="p-7 flex flex-col relative overflow-hidden group border border-white/60 dark:border-white/10 focus:outline-none focus:ring-2 focus-visible:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                            >
                                {inc.severity === Criticality.CRITICAL && (
                                    <div className="absolute top-6 right-6 z-10">
                                        <span className="relative flex h-3.5 w-3.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 shadow-sm border-2 border-white dark:border-slate-900"></span>
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-2">
                                        <div className={`p-2 rounded-xl border shadow-sm ${getIncidentCategoryStyles(inc.category || '').bg} ${getIncidentCategoryStyles(inc.category || '').color} ${getIncidentCategoryStyles(inc.category || '').border}`}>
                                            {React.createElement(getIncidentCategoryStyles(inc.category || '').icon, { className: "h-5 w-5" })}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex gap-2">
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getSeverityColor(inc.severity)}`}>
                                                    {getSeverityLabel(inc.severity)}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getStatusColor(inc.status)}`}>
                                                    {getStatusLabel(inc.status)}
                                                </span>
                                            </div>
                                            {inc.isSignificant && (
                                                <div className="mt-1">
                                                    <NIS2DeadlineTimer incident={inc} compact={true} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {canDelete && onDelete && (
                                        <CustomTooltip content={t('common.delete')}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(inc.id);
                                                }}
                                                className="p-1.5 text-slate-500 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </CustomTooltip>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-600 transition-colors leading-tight">
                                    {inc.title}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6 line-clamp-2 leading-relaxed">
                                    {inc.description}
                                </p>
                                <div className="flex items-center justify-between pt-5 border-t border-dashed border-slate-200 dark:border-white/10 mt-auto">
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
                                                className="text-xs px-2 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600 hover:scale-105 transition-all font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                            >
                                                {t('incidents.playbook')}
                                            </button>
                                        )}
                                        <div className="text-xs text-brand-600 font-bold flex items-center group-hover:translate-x-1 transition-transform">
                                            {t('incidents.open')} <ShieldAlert className="ml-1.5 h-3.5 w-3.5" />
                                        </div>
                                    </div>
                                </div>
                            </PremiumCard>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
