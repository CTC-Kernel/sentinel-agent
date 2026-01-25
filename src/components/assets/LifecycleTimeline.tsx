import React from 'react';
import { ShoppingCart, Wrench, ShieldCheck, Trash2, Archive, CheckCircle2 } from '../ui/Icons';

interface LifecycleTimelineProps {
    status: string;
    purchaseDate?: string;
    warrantyEnd?: string;
    nextMaintenance?: string;
}

export const LifecycleTimeline: React.FC<LifecycleTimelineProps> = ({
    status,
    purchaseDate,
    warrantyEnd,
    nextMaintenance
}) => {
    const steps = [
        { id: 'Neuf', label: 'Achat', icon: ShoppingCart, date: purchaseDate },
        { id: 'En service', label: 'En Service', icon: CheckCircle2, date: null },
        { id: 'Maintenance', label: 'Maintenance', icon: Wrench, date: nextMaintenance ? `Prochaine: ${new Date(nextMaintenance).toLocaleDateString()}` : null },
        { id: 'Garantie', label: 'Fin Garantie', icon: ShieldCheck, date: warrantyEnd },
        { id: 'Fin de vie', label: 'Fin de Vie', icon: Archive, date: null },
        { id: 'Rebut', label: 'Rebut', icon: Trash2, date: null }
    ];

    const getCurrentStepIndex = () => {
        switch (status) {
            case 'Neuf': return 0;
            case 'En service': return 1;
            case 'En réparation': return 2;
            case 'Fin de vie': return 4;
            case 'Rebut': return 5;
            default: return 1;
        }
    };

    const currentStep = getCurrentStepIndex();

    return (
        <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 dark:bg-white/5 -translate-y-1/2 rounded-full" />
            <div
                className="absolute top-1/2 left-0 h-1 bg-brand-500 -translate-y-1/2 rounded-full transition-all duration-500"
                style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            />

            <div className="relative flex justify-between">
                {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index <= currentStep;
                    const isCurrent = index === currentStep;

                    return (
                        <div key={step.id} className="flex flex-col items-center group">
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10
                                ${isCompleted
                                    ? 'bg-brand-500 border-brand-100 dark:border-brand-900 text-white'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-400'
                                }
                                ${isCurrent ? 'scale-110 shadow-lg shadow-brand-500/30' : ''}
                            `}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <div className="mt-3 text-center">
                                <p className={`text-xs font-bold uppercase tracking-wider ${isCompleted ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                    {step.label}
                                </p>
                                {step.date && (
                                    <p className="text-[10px] font-medium text-slate-600 mt-0.5">
                                        {step.date.includes('Prochaine') ? step.date : new Date(step.date).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
