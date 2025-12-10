import React, { useState, useMemo } from 'react';
import { ShieldAlert, CalendarDays, Search, FileSpreadsheet, Siren, Trash2, LayoutGrid, List, CheckCircle2 } from '../ui/Icons';
import { Incident, Criticality } from '../../types';
import { useStore } from '../../store';
import { EmptyState } from '../ui/EmptyState';
import { CardSkeleton } from '../ui/Skeleton';
import { usePersistedState } from '../../hooks/usePersistedState';
import { hasPermission } from '../../utils/permissions';
import { DataTable } from '../ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';

interface IncidentDashboardProps {
    incidents: Incident[];
    onCreate: () => void;
    onSelect: (incident: Incident) => void;
    loading?: boolean;
    onDelete?: (id: string) => void;
    onBulkDelete?: (ids: string[]) => void;
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
        case 'Fermé': return 'text-slate-500 bg-slate-100 dark:bg-slate-800 line-through decoration-slate-400';
        default: return 'text-slate-600 bg-gray-50';
    }
};

export const IncidentDashboard: React.FC<IncidentDashboardProps> = ({ incidents, onCreate, onSelect, loading = false, onDelete, onBulkDelete }) => {
    const { user } = useStore();
    const canEdit = !!user && (hasPermission(user, 'Incident', 'update') || hasPermission(user, 'Incident', 'delete'));
    const [filter, setFilter] = useState('');
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list'>('incidents_view_mode', 'grid');

    const filteredIncidents = useMemo(() => {
        return incidents.filter(i => i.title.toLowerCase().includes(filter.toLowerCase()));
    }, [incidents, filter]);

    const handleExportCSV = () => {
        const headers = ['Titre', 'Sévérité', 'Statut', 'Date', 'Reporter', 'Description'];
        const rows = filteredIncidents.map(inc => [
            inc.title,
            inc.severity,
            inc.status,
            new Date(inc.dateReported).toLocaleDateString(),
            inc.reporter,
            inc.description || ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `incidents_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    // Metrics for Summary Card
    const columns = useMemo<ColumnDef<Incident>[]>(() => [
        {
            accessorKey: 'title',
            header: 'Incident',
            cell: ({ row }) => (
                <div>
                    <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.title}</div>
                    <div className="text-xs text-slate-500 font-medium line-clamp-1">{row.original.description}</div>
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
                <div className="text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()}>
                    {canEdit && onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(row.original.id);
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100"
                            title="Supprimer"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
            )
        }
    ], [canEdit, onDelete]);

    const totalIncidents = incidents.length;
    const openIncidents = incidents.filter(i => i.status !== 'Résolu' && i.status !== 'Fermé').length;
    const criticalIncidents = incidents.filter(i => i.severity === Criticality.CRITICAL && (i.status !== 'Résolu' && i.status !== 'Fermé')).length;
    const resolutionRate = totalIncidents > 0
        ? Math.round(((totalIncidents - openIncidents) / totalIncidents) * 100)
        : 100;

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-7 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group">
                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-slate-200 dark:text-slate-700"
                            />
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * resolutionRate) / 100}
                                className="text-emerald-500 transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white">{resolutionRate}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Taux de Résolution</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px]">
                            Pourcentage d'incidents résolus ou fermés.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2">
                    <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Incidents</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalIncidents}</div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">En Cours</div>
                        <div className={`text-2xl font-bold ${openIncidents > 0 ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>
                            {openIncidents}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Critiques</div>
                        <div className={`text-2xl font-bold ${criticalIncidents > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                            {criticalIncidents}
                        </div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[180px]">
                    {criticalIncidents > 0 && (
                        <div className="flex items-center gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/30">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span className="font-medium">{criticalIncidents} critiques ouverts</span>
                        </div>
                    )}
                    {openIncidents > 0 && criticalIncidents === 0 && (
                        <div className="flex items-center gap-3 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded-xl border border-orange-100 dark:border-orange-800/30">
                            <Siren className="h-4 w-4 shrink-0" />
                            <span className="font-medium">{openIncidents} incidents actifs</span>
                        </div>
                    )}
                    {openIncidents === 0 && (
                        <div className="flex items-center gap-3 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span className="font-medium">Aucun incident actif</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Rechercher un incident..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
                <button
                    onClick={handleExportCSV}
                    className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                    title="Exporter CSV"
                >
                    <FileSpreadsheet className="h-4 w-4" />
                </button>
                <div className="flex bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm ml-2">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vue Grille"><LayoutGrid className="h-4 w-4" /></button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vue Liste"><List className="h-4 w-4" /></button>
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
                                className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover flex flex-col relative overflow-hidden cursor-pointer group"
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
                                    {canEdit && onDelete && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDelete(inc.id);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-600 transition-colors leading-tight">
                                    {inc.title}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 leading-relaxed">
                                    {inc.description}
                                </p>
                                <div className="flex items-center justify-between pt-5 border-t border-dashed border-gray-200 dark:border-white/10 mt-auto">
                                    <div className="flex items-center text-xs font-medium text-slate-400">
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
                                                className="text-xs px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg hover:scale-105 transition-transform font-bold"
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
