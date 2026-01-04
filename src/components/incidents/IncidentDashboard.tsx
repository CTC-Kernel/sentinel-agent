import React, { useMemo } from 'react';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { ShieldAlert, CalendarDays, Siren, Trash2, CheckCircle2 } from '../ui/Icons';
import { Incident, Criticality } from '../../types';
import { useStore } from '../../store';
import { EmptyState } from '../ui/EmptyState';
import { CardSkeleton } from '../ui/Skeleton';
import { hasPermission } from '../../utils/permissions';
import { DataTable } from '../ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { EmptyChartState } from '../ui/EmptyChartState';
import { ChartTooltip } from '../ui/ChartTooltip';

interface IncidentDashboardProps {
    incidents: Incident[];
    onCreate: () => void;
    onSelect: (incident: Incident) => void;
    loading?: boolean;
    onDelete?: (id: string) => void;
    onBulkDelete?: (ids: string[]) => void;
    viewMode: 'list' | 'grid';
    filter: string;
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

export const IncidentDashboard: React.FC<IncidentDashboardProps> = ({ incidents, onCreate, onSelect, loading = false, onDelete, onBulkDelete, viewMode, filter }) => {
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
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {row.original.reporter}
                </span>
            )
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
    ], [canDelete, onDelete]);

    const totalIncidents = incidents.length;
    const openIncidents = incidents.filter(i => i.status !== 'Résolu' && i.status !== 'Fermé').length;
    const criticalIncidents = incidents.filter(i => i.severity === Criticality.CRITICAL && (i.status !== 'Résolu' && i.status !== 'Fermé')).length;
    const resolutionRate = totalIncidents > 0
        ? Math.round(((totalIncidents - openIncidents) / totalIncidents) * 100)
        : 100;

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Summary Card */}
            <div className="glass-premium p-6 md:p-8 rounded-[2.5rem] border border-white/60 dark:border-white/5 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative overflow-hidden group bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                {/* Tech Corners Generic */}
                <svg className="absolute top-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute top-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-100 opacity-70"></div>
                </div>

                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-decorator">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="-4 -4 104 104">
                            <defs>
                                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#10B981" />
                                    <stop offset="100%" stopColor="#34D399" />
                                </linearGradient>
                            </defs>
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-slate-200/50 dark:text-slate-700/50"
                            />
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="url(#progressGradient)"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * resolutionRate) / 100}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out drop-shadow-sm"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white">{resolutionRate}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Taux de Résolution</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px] leading-snug">
                            Pourcentage d'incidents résolus ou fermés.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2 relative z-decorator">
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{totalIncidents}</div>
                    </div>
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">En Cours</div>
                        <div className={`text-2xl font-black ${openIncidents > 0 ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>
                            {openIncidents}
                        </div>
                    </div>
                    <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Critiques</div>
                        <div className={`text-2xl font-black ${criticalIncidents > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                            {criticalIncidents}
                        </div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[200px] relative z-decorator">
                    {criticalIncidents > 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/20 px-4 py-2.5 rounded-xl border border-red-100 dark:border-red-800/30 backdrop-blur-sm">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span>{criticalIncidents} critiques ouverts</span>
                        </div>
                    )}
                    {openIncidents > 0 && criticalIncidents === 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50/80 dark:bg-orange-900/20 px-4 py-2.5 rounded-xl border border-orange-100 dark:border-orange-800/30 backdrop-blur-sm">
                            <Siren className="h-4 w-4 shrink-0" />
                            <span>{openIncidents} incidents actifs</span>
                        </div>
                    )}
                    {openIncidents === 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/20 px-4 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800/30 backdrop-blur-sm">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>Aucun incident actif</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Graphs Section (Added for "Overview" request) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Incidents by Category */}
                <div className="glass-premium p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide font-mono text-muted-foreground">Par Catégorie</h4>
                    <div className="h-[250px] w-full">
                        {categoryData.length === 0 ? (
                            <EmptyChartState variant="pie" message="Aucune catégorie" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={65}
                                        outerRadius={85}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={4}
                                    >
                                        {categoryData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981'][index % 5]} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: 'none' }} />
                                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Incidents Timeline (Last 6 Months) */}
                <div className="glass-premium p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide font-mono text-muted-foreground">Historique (6 mois)</h4>
                    <div className="h-[250px] w-full">
                        {timelineData.length === 0 ? (
                            <EmptyChartState variant="bar" message="Aucun historique récent" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={timelineData}
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="incidentGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ outline: 'none' }} />
                                    <Bar dataKey="count" fill="url(#incidentGradient)" radius={[6, 6, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

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
                                        {new Date(inc.dateReported).toLocaleDateString()} • {inc.reporter}
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
