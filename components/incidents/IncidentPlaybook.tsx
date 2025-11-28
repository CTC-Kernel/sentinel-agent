import React from 'react';
import { Incident } from '../../types';
import { CheckCircle2, Circle } from '../ui/Icons';
import { PLAYBOOKS } from '../../data/incidentPlaybooks';

interface IncidentPlaybookProps {
    incident: Incident;
    onToggleStep?: (step: string) => void;
    readOnly?: boolean;
}

export const IncidentPlaybook: React.FC<IncidentPlaybookProps> = ({ incident, onToggleStep, readOnly = false }) => {
    const category = incident.category || 'Autre';
    const steps = PLAYBOOKS[category] || PLAYBOOKS['Autre'];
    const completedSteps = incident.playbookStepsCompleted || [];

    const progress = Math.round((completedSteps.length / steps.length) * 100);

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Progression du Playbook</h3>
                    <span className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-2 py-1 rounded-lg">{progress}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2 mb-6">
                    <div className="bg-brand-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="space-y-4">
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-1">{incident.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{incident.description}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Étapes : {category}</h3>
                <div className="space-y-3">
                    {steps.map((step, idx) => {
                        const isCompleted = completedSteps.includes(step);
                        return (
                            <div
                                key={idx}
                                onClick={() => !readOnly && onToggleStep && onToggleStep(step)}
                                className={`flex items-start p-3 rounded-xl border transition-all cursor-pointer ${isCompleted
                                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'
                                    : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                                    }`}
                            >
                                {isCompleted ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                                ) : (
                                    <Circle className="h-5 w-5 text-slate-300 mr-3 mt-0.5 flex-shrink-0" />
                                )}
                                <span className={`text-sm font-medium ${isCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {step}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

