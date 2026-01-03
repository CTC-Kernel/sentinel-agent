import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from './Calendar';

interface DatePickerProps {
    label: string;
    value?: string | Date;
    onChange: (date: string | undefined) => void;
    error?: string;
    className?: string;
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
    label,
    value,
    onChange,
    error,
    className = '',
    required = false,
    placeholder = "Sélectionner une date...",
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (date: Date | undefined) => {
        setIsOpen(false);
        if (date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            onChange(`${year}-${month}-${day}`);
        } else {
            onChange(undefined);
        }
    };

    const displayValue = value ? new Date(value).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : '';

    const selectedDate = value ? new Date(value) : undefined;

    return (
        <div className={`relative ${className} ${disabled ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}`} ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={(e) => {
                    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }
                }}
                role="button"
                tabIndex={disabled ? -1 : 0}
                className={`
                    relative flex items-center w-full rounded-2xl border transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                    ${error
                        ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
                        : isOpen
                            ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white dark:bg-slate-800'
                            : 'border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 hover:border-gray-300 dark:hover:border-white/20'
                    }
                `}
            >
                <div className="w-full px-4 py-3.5 flex items-center justify-between">
                    <span className={`font-medium ${value ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                        {displayValue || (isOpen ? placeholder : (label ? '' : placeholder))}
                    </span>
                    <CalendarIcon className={`h-4 w-4 text-slate-500 transition-colors ${isOpen ? 'text-brand-500' : ''}`} />
                </div>

                <label
                    className={`
                        absolute left-4 transition-all duration-200 pointer-events-none
                        ${(isOpen || value)
                            ? '-top-2.5 text-[10px] font-bold uppercase tracking-widest bg-white dark:bg-slate-900 px-1 rounded text-brand-600'
                            : 'top-3.5 text-sm font-medium text-slate-600'
                        }
                        ${error ? '!text-red-500' : ''}
                    `}
                >
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-tooltip mt-2 p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-white/10 w-auto min-w-[300px] animate-fade-in">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleSelect}
                        initialFocus
                    />
                    {value && (
                        <div className="p-2 border-t border-gray-100 dark:border-white/5 mt-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); onChange(undefined); setIsOpen(false); }}
                                className="w-full py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            >
                                Effacer la date
                            </button>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    );
};
