import React, { useState, useMemo } from 'react';
import { Plus, ShieldAlert, CalendarDays, Download, Activity, AlertTriangle, Clock, Search, FileSpreadsheet, Siren, Trash2 } from '../ui/Icons';
import { Incident, Criticality } from '../../types';
import { useStore } from '../../store';
import { IncidentPlaybookModal } from './IncidentPlaybookModal';
import { IncidentTimeline } from './IncidentTimeline';
import { EmptyState } from '../ui/EmptyState';
import { CardSkeleton } from '../ui/Skeleton';

interface IncidentDashboardProps {
    incidents: Incident[];
    onCreate: () => void;
    onSelect: (incident: Incident) => void;
    loading?: boolean;
    onDelete?: (id: string) => void;
}

export const IncidentDashboard: React.FC<IncidentDashboardProps> = ({ incidents, onCreate, onSelect, loading = false, onDelete }) => {
    const { user } = useStore();
    const canEdit = user?.role === 'admin' || user?.role === 'auditor';
    const [showTimeline, setShowTimeline] = useState(false);
    const [showPlaybookModal, setShowPlaybookModal] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
    const [filter, setFilter] = useState('');

    const stats = useMemo(() => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return {
            open: incidents.filter(i => i.status !== 'Fermé' && i.status !== 'Résolu').length,
            critical: incidents.filter(i => i.severity === Criticality.CRITICAL).length,
            recent: incidents.filter(i => new Date(i.dateReported) > lastMonth).length
        };
    }, [incidents]);

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

    const handleIncidentClick = (inc: Incident) => {
        setSelectedIncident(inc);
        onSelect(inc);
    };

    const getSeverityColor = (s: Criticality) => {
        switch (s) {
            case Criticality.CRITICAL: return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800/50 shadow-red-500/10';
            case Criticality.HIGH: return 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800/50 shadow-orange-500/10';
            case Criticality.MEDIUM: return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 shadow-amber-500/10';
            default: return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50 shadow-blue-500/10';
        }
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Nouveau': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
            case 'Analyse': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
            case 'Contenu': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
            case 'Résolu': return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
            case 'Fermé': return 'text-slate-500 bg-slate-100 dark:bg-slate-800 line-through decoration-slate-400';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Incidents</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Gestion et réponse aux incidents de sécurité.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowTimeline(!showTimeline)}
                        className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:scale-105 transition-all shadow-sm border border-slate-200 dark:border-white/5 font-bold text-sm"
                    >
                        <CalendarDays className="h-4 w-4 mr-2" />
                        {showTimeline ? 'Masquer' : 'Afficher'} Timeline
                    </button>
                    {canEdit && (
                        <button
                            onClick={onCreate}
                            className="flex items-center px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-slate-900/20 dark:shadow-none"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Déclarer un incident
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Incidents Ouverts</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.open}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                        <Activity className="h-6 w-6" />
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Incidents Critiques</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.critical}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">30 derniers jours</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.recent}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
                        <Clock className="h-6 w-6" />
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all border border-slate-200 dark:border-white/5">
                <Search className="h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Rechercher un incident..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
                <button
                    onClick={handleExportCSV}
                    className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                    title="Exporter CSV"
                >
                    <FileSpreadsheet className="h-4 w-4" />
                </button>
            </div>

            {/* Timeline View */}
            {showTimeline && selectedIncident && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 animate-slide-up">
                    <IncidentTimeline selectedIncident={selectedIncident} />
                </div>
            )}

            {/* Incident list */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {loading ? (
                    <div className="col-span-full"><CardSkeleton count={4} /></div>
                ) : filteredIncidents.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={Siren}
                            title="Aucun incident signalé"
                            description={filter ? "Aucun incident ne correspond à votre recherche." : "Tout est calme. Aucun incident de sécurité n'a été rapporté pour le moment."}
                            actionLabel={filter ? undefined : "Déclarer un incident"}
                            onAction={filter ? undefined : onCreate}
                        />
                    </div>
                ) : (
                    filteredIncidents.map((inc) => (
                        <div
                            key={inc.id}
                            onClick={() => handleIncidentClick(inc)}
                            className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover flex flex-col relative overflow-hidden cursor-pointer group border border-white/50 dark:border-white/5"
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
                                                setSelectedIncident(inc);
                                                setShowPlaybookModal(true);
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

            {/* Playbook Modal */}
            {showPlaybookModal && selectedIncident && (
                <IncidentPlaybookModal
                    isOpen={showPlaybookModal}
                    title={`Playbook: ${selectedIncident.category || 'Incident'}`}
                    onClose={() => {
                        setShowPlaybookModal(false);
                        setSelectedIncident(null);
                    }}
                >
                    <div className="space-y-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                                {selectedIncident.title}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {selectedIncident.description}
                            </p>
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <p>Sévérité: <span className="font-semibold">{selectedIncident.severity}</span></p>
                            <p>Statut: <span className="font-semibold">{selectedIncident.status}</span></p>
                            <p>Reporter: <span className="font-semibold">{selectedIncident.reporter}</span></p>
                        </div>
                        {selectedIncident.playbookStepsCompleted && selectedIncident.playbookStepsCompleted.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Étapes complétées:</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                    {selectedIncident.playbookStepsCompleted.map((step, idx) => (
                                        <li key={idx}>{step}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </IncidentPlaybookModal>
            )}
        </div>
    );
};
