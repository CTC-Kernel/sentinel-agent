import React from 'react';
import { AlertCircle, AlertTriangle, Info, Lightbulb } from 'lucide-react';

interface SeveritySelectorProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
}

export const SeveritySelector: React.FC<SeveritySelectorProps> = ({
    value,
    onChange,
    label = "Sévérité"
}) => {
    const options = [
        { value: 'Majeure', label: 'Majeure', icon: AlertCircle, color: 'bg-red-500', activeColor: 'bg-red-600', textColor: 'text-red-600' },
        { value: 'Mineure', label: 'Mineure', icon: AlertTriangle, color: 'bg-orange-500', activeColor: 'bg-orange-600', textColor: 'text-orange-600' },
        { value: 'Observation', label: 'Observation', icon: Info, color: 'bg-blue-500', activeColor: 'bg-blue-600', textColor: 'text-blue-600' },
        { value: 'Opportunité', label: 'Opportunité', icon: Lightbulb, color: 'bg-emerald-500', activeColor: 'bg-emerald-600', textColor: 'text-emerald-600' }
    ];

    return (
        <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600">
                {label}
            </label>
            <div className="grid grid-cols-4 gap-3">
                {options.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = value === opt.value;

                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => onChange(opt.value)}
                            className={`
                                relative flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200
                                ${isSelected
                                    ? 'bg-white dark:bg-slate-800 shadow-md ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-105 z-10'
                                    : 'bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm'
                                }
                            `}
                        >
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-colors
                                ${isSelected ? opt.color + ' text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600'}
                            `}>
                                <Icon className="h-4 w-4" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                {opt.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
