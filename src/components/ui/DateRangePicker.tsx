import React from 'react';
import { Calendar } from './Icons';

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    label?: string;
    error?: string;
    className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    label = 'Période',
    error,
    className = ''
}) => {
    return (
        <div className={className}>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" /> {label}
            </label>
            <div className={`
                flex items-center gap-2 p-1 rounded-2xl border transition-all duration-200
                ${error
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border/40 dark:border-border/40 bg-slate-50/50 dark:bg-black/20 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-300'
                }
            `}>
                <input aria-label="Date de début" value={startDate}
                    type="date"
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm font-medium text-slate-900 dark:text-white rounded-3xl focus:bg-white dark:focus:bg-white/5 transition-colors"
                />
                <span className="text-slate-500 font-medium">→</span>
                <input aria-label="Date de fin" value={endDate}
                    type="date"
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm font-medium text-slate-900 dark:text-white rounded-3xl focus:bg-white dark:focus:bg-white/5 transition-colors"
                />
            </div>
            {error && (
                <p className="text-destructive text-xs mt-1.5 ml-1 font-medium animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    );
};
