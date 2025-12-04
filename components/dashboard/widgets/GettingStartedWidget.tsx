import React from 'react';
import { CheckCircle2, Circle, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../../store';

interface Step {
    id: string;
    label: string;
    path: string;
    isCompleted: boolean;
}

export const GettingStartedWidget: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const navigate = useNavigate();
    const { user } = useStore();

    // Determine completion status based on store data (simplified for now)
    // In a real app, we might check specific counts or flags
    const steps: Step[] = [
        {
            id: 'org',
            label: 'Créer votre organisation',
            path: '/settings',
            isCompleted: !!user?.organizationId
        },
        {
            id: 'team',
            label: 'Inviter votre équipe',
            path: '/team',
            isCompleted: false // TODO: Check if team members > 1
        },
        {
            id: 'asset',
            label: 'Ajouter votre premier actif',
            path: '/assets',
            isCompleted: false // TODO: Check asset count
        },
        {
            id: 'risk',
            label: 'Identifier un risque',
            path: '/risks',
            isCompleted: false // TODO: Check risk count
        }
    ];

    const completedCount = steps.filter(s => s.isCompleted).length;
    const progress = (completedCount / steps.length) * 100;

    if (completedCount === steps.length) return null;

    return (
        <div className="mb-8 glass-panel p-6 rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-50/50 to-white/50 dark:from-brand-900/10 dark:to-slate-900/50 relative overflow-hidden">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
                <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        Bienvenue sur Sentinel GRC ! 🚀
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-lg">
                        Suivez ces étapes pour configurer votre espace et sécuriser votre entreprise.
                    </p>

                    <div className="space-y-3">
                        {steps.map((step) => (
                            <div
                                key={step.id}
                                onClick={() => !step.isCompleted && navigate(step.path)}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${step.isCompleted
                                    ? 'opacity-60'
                                    : 'bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 cursor-pointer shadow-sm'
                                    }`}
                            >
                                {step.isCompleted ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                                ) : (
                                    <Circle className="h-5 w-5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                )}
                                <span className={`font-medium ${step.isCompleted ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                                    {step.label}
                                </span>
                                {!step.isCompleted && (
                                    <ArrowRight className="h-4 w-4 text-brand-500 ml-auto" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="w-full md:w-64 flex-shrink-0">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg text-center">
                        <div className="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 128 128">
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="56"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    fill="transparent"
                                    className="text-slate-100 dark:text-slate-700"
                                />
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="56"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    fill="transparent"
                                    strokeDasharray={351.86}
                                    strokeDashoffset={351.86 - (351.86 * progress) / 100}
                                    className="text-brand-500 transition-all duration-1000 ease-out"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-xl font-bold text-slate-900 dark:text-white">{Math.round(progress)}%</span>
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            Configuration
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
