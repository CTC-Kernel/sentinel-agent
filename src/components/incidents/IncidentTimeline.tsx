import React from 'react';
import { CheckCircle2, AlertCircle, Clock, FileText } from '../ui/Icons';
import { Incident } from '../../types';

interface IncidentTimelineProps {
    selectedIncident?: Incident;
    getTimeToResolve?: (incident: Incident) => string | null;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ selectedIncident, getTimeToResolve }) => {
    if (!selectedIncident) {
        return (
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm h-full flex flex-col justify-center items-center text-center">
                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                    <Clock className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Chronologie</h3>
                <p className="text-xs text-slate-600 dark:text-muted-foreground">Sélectionnez un incident pour voir son historique.</p>
            </div>
        );
    }

    // Define timeline steps based on incident status
    const steps = [
        {
            id: 'reported',
            label: 'Signalé',
            date: selectedIncident.dateReported,
            status: 'completed',
            icon: AlertCircle,
            description: `Incident signalé par ${selectedIncident.reporter}`
        },
        {
            id: 'analysis',
            label: 'En Analyse',
            date: selectedIncident.dateAnalysis || (['Analyse', 'Contenu', 'Résolu', 'Fermé'].includes(selectedIncident.status) ? selectedIncident.dateReported : undefined),
            status: ['Analyse', 'Contenu', 'Résolu', 'Fermé'].includes(selectedIncident.status) ? 'completed' : selectedIncident.status === 'Nouveau' ? 'current' : 'upcoming',
            icon: FileText,
            description: 'Analyse initiale et qualification'
        },
        {
            id: 'contained',
            label: 'Contenu',
            date: selectedIncident.dateContained,
            status: ['Contenu', 'Résolu', 'Fermé'].includes(selectedIncident.status) ? 'completed' : selectedIncident.status === 'Analyse' ? 'current' : 'upcoming',
            icon: CheckCircle2,
            description: 'Mesures de contournement appliquées'
        },
        {
            id: 'resolved',
            label: 'Résolu',
            date: selectedIncident.dateResolved,
            status: ['Résolu', 'Fermé'].includes(selectedIncident.status) ? 'completed' : selectedIncident.status === 'Contenu' ? 'current' : 'upcoming',
            icon: CheckCircle2,
            description: 'Incident résolu et service rétabli'
        }
    ];

    return (
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-6 rounded-3xl border border-white/60 dark:border-white/10 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300">Chronologie</h3>
                {selectedIncident.dateResolved && (
                    <div className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                        <Clock className="h-3 w-3 mr-1" />
                        Résolu en {getTimeToResolve ? getTimeToResolve(selectedIncident) : '-'}
                    </div>
                )}
            </div>

            <div className="relative pl-4 border-l-2 border-slate-100 dark:border-slate-700 space-y-8 my-4">
                {steps.map((step) => {
                    const isCompleted = step.status === 'completed';
                    const isCurrent = step.status === 'current';

                    return (
                        <div key={step.id} className="relative">
                            {/* Dot */}
                            <div className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 ${isCompleted ? 'bg-brand-500 border-brand-500' :
                                isCurrent ? 'bg-white border-brand-500 animate-pulse' :
                                    'bg-slate-200 border-slate-200 dark:bg-slate-700 dark:border-slate-700'
                                }`} />

                            <div className={`flex flex-col ${isCompleted || isCurrent ? 'opacity-70' : 'opacity-60'}`}>
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm font-bold ${isCurrent ? 'text-brand-700 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>
                                        {step.label}
                                    </span>
                                    {step.date && (
                                        <span className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                                            {new Date(step.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{step.description}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
