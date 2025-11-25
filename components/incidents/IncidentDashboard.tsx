import React, { useState } from 'react';
import { Plus, ShieldAlert, CalendarDays, Download } from '../ui/Icons';
import { Incident } from '../../types';
import { useStore } from '../../store';
import { IncidentPlaybookModal } from './IncidentPlaybookModal';
import { IncidentTimeline } from './IncidentTimeline';

interface IncidentDashboardProps {
    incidents: Incident[];
    onCreate: () => void;
    onSelect: (incident: Incident) => void;
}

export const IncidentDashboard: React.FC<IncidentDashboardProps> = ({ incidents, onCreate, onSelect }) => {
    const { user } = useStore();
    const canEdit = user?.role === 'admin' || user?.role === 'auditor';
    const [showTimeline, setShowTimeline] = useState(false);
    const [showPlaybookModal, setShowPlaybookModal] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

    const handleExportCSV = () => {
        const headers = ['Titre', 'Sévérité', 'Statut', 'Date', 'Reporter', 'Description'];
        const rows = incidents.map(inc => [
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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Incidents</h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowTimeline(!showTimeline)}
                        className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:scale-105 transition-all"
                    >
                        <CalendarDays className="h-4 w-4 mr-2" />
                        {showTimeline ? 'Masquer' : 'Afficher'} Timeline
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:scale-105 transition-all"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Exporter CSV
                    </button>
                    {canEdit && (
                        <button
                            onClick={onCreate}
                            className="flex items-center px-5 py-2.5 bg-brand-600 text-white rounded-xl hover:scale-105 transition-all shadow-lg"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Créer un incident
                        </button>
                    )}
                </div>
            </div>

            {/* Timeline View */}
            {showTimeline && selectedIncident && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <IncidentTimeline selectedIncident={selectedIncident} />
                </div>
            )}

            {/* Incident list */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {incidents.map((inc) => (
                    <div
                        key={inc.id}
                        onClick={() => handleIncidentClick(inc)}
                        className="cursor-pointer glass-panel p-6 rounded-2xl border border-white/20 hover:shadow-apple transition-shadow"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{inc.title}</h2>
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-brand-500" />
                                {inc.category && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedIncident(inc);
                                            setShowPlaybookModal(true);
                                        }}
                                        className="text-xs px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-lg hover:scale-105 transition-transform"
                                    >
                                        Playbook
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">{inc.description}</p>
                        <div className="flex items-center text-xs text-slate-500">
                            <CalendarDays className="h-3 w-3 mr-1" />
                            {new Date(inc.dateReported).toLocaleDateString()}
                        </div>
                    </div>
                ))}
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
