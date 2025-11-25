import React from 'react';
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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Incidents</h1>
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

            {/* Incident list */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {incidents.map((inc) => (
                    <div
                        key={inc.id}
                        onClick={() => onSelect(inc)}
                        className="cursor-pointer glass-panel p-6 rounded-2xl border border-white/20 hover:shadow-apple transition-shadow"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{inc.title}</h2>
                            <ShieldAlert className="h-5 w-5 text-brand-500" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">{inc.description}</p>
                        <div className="flex items-center text-xs text-slate-500">
                            <CalendarDays className="h-3 w-3 mr-1" />
                            {new Date(inc.dateReported).toLocaleDateString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
