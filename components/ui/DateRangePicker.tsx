import React from 'react';
import { Calendar } from 'lucide-react';

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
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" /> {label}
            </label>
            <div className={`
                flex items-center gap-2 p-1 rounded-2xl border transition-all duration-200
                ${error
                    ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
                    : 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20'
                }
            `}>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm font-medium text-slate-900 dark:text-white rounded-xl focus:bg-white dark:focus:bg-white/5 transition-colors"
                />
                <span className="text-slate-400 font-medium">→</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm font-medium text-slate-900 dark:text-white rounded-xl focus:bg-white dark:focus:bg-white/5 transition-colors"
                />
            </div>
            {error && (
                <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    );
};
