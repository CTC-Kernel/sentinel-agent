import React from 'react';
import { Incident } from '../../types';
import { CheckCircle2 } from '../ui/Icons';

interface IncidentPlaybookProps {
    incident: Incident;
}

export const IncidentPlaybook: React.FC<IncidentPlaybookProps> = ({ incident }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Détails de l'incident</h3>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{incident.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{incident.description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <span className="text-xs text-slate-500 block mb-1">Sévérité</span>
                            <span className="font-bold text-slate-900 dark:text-white">{incident.severity}</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <span className="text-xs text-slate-500 block mb-1">Statut</span>
                            <span className="font-bold text-slate-900 dark:text-white">{incident.status}</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <span className="text-xs text-slate-500 block mb-1">Catégorie</span>
                            <span className="font-bold text-slate-900 dark:text-white">{incident.category}</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <span className="text-xs text-slate-500 block mb-1">Signalé par</span>
                            <span className="font-bold text-slate-900 dark:text-white">{incident.reporter}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Étapes du Playbook</h3>
                {incident.playbookStepsCompleted && incident.playbookStepsCompleted.length > 0 ? (
                    <div className="space-y-3">
                        {incident.playbookStepsCompleted.map((step, idx) => (
                            <div key={idx} className="flex items-start p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{step}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                        <p className="text-sm text-slate-400 italic">Aucune étape enregistrée pour ce playbook.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
