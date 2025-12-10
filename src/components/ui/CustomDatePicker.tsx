import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
    label: string;
    value: string;
    onChange: (date: string) => void;
    error?: string;
    className?: string;
    required?: boolean;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    label,
    value,
    onChange,
    error,
    className = '',
    required = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date()); // For navigation
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize calendar view based on value
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setCurrentDate(date);
            }
        }
    }, [value]);

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

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Adjust for Monday start (0=Mon, 6=Sun)
    };

    const handleDateClick = (day: number) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        // Adjust for timezone offset to ensure YYYY-MM-DD matches local selection
        const offset = date.getTimezoneOffset();
        const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
        onChange(adjustedDate.toISOString().split('T')[0]);
        setIsOpen(false);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const totalDays = daysInMonth(year, month);
        const startDay = startDayOfMonth(year, month);
        const calendarDays = [];

        // Empty cells for previous month
        for (let i = 0; i < startDay; i++) {
            calendarDays.push(<div key={`empty-${i}`} className="h-8 w-8" />);
        }

        // Days of current month
        for (let day = 1; day <= totalDays; day++) {
            // Fix comparison by creating local date string manually to avoid timezone issues
            const checkDate = new Date(year, month, day);
            const offset = checkDate.getTimezoneOffset();
            const localDateStr = new Date(checkDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

            const isSelected = value === localDateStr;
            const isToday = localDateStr === new Date().toISOString().split('T')[0];

            calendarDays.push(
                <button
                    key={day}
                    onClick={(e) => { e.preventDefault(); handleDateClick(day); }}
                    className={`
                        h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium transition-all
                        ${isSelected
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30'
                            : isToday
                                ? 'bg-brand-50 text-brand-600 border border-brand-200'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                        }
                    `}
                >
                    {day}
                </button>
            );
        }

        return calendarDays;
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    relative flex items-center w-full rounded-2xl border transition-all duration-200 cursor-pointer
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
                        {value ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sélectionner une date...'}
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

            {isOpen && (
                <div className="absolute z-50 mt-2 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-white/10 w-[300px] animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={(e) => { e.preventDefault(); prevMonth(); }} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                            <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </button>
                        <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </span>
                        <button onClick={(e) => { e.preventDefault(); nextMonth(); }} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                            <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {days.map(d => (
                            <div key={d} className="h-8 w-8 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {renderCalendar()}
                    </div>

                    {value && (
                        <button
                            onClick={(e) => { e.preventDefault(); onChange(''); setIsOpen(false); }}
                            className="mt-3 w-full py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                            Effacer la date
                        </button>
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
