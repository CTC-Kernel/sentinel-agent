import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Download, ExternalLink } from './Icons';
import { CalendarService } from '../../services/calendarService';

export interface CalendarEventDetails {
    title: string;
    description?: string;
    start: Date;
    end: Date;
    location?: string;
}

interface AddToCalendarProps {
    event: CalendarEventDetails;
    className?: string;
}

export const AddToCalendar: React.FC<AddToCalendarProps> = ({ event, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center px-3 py-2 bg-white dark:bg-white/5 border border-border/40 dark:border-border/40 rounded-3xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                <Calendar className="h-4 w-4 mr-2" data-testid="calendar-icon" />
                Ajouter au calendrier
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-border/40 dark:border-white/5 z-tooltip overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1">
                        <a
                            href={CalendarService.google(event)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => setIsOpen(false)}
                        >
                            <ExternalLink className="h-4 w-4 mr-2 text-brand-500" />
                            Google Calendar
                        </a>
                        <a
                            href={CalendarService.outlook(event)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => setIsOpen(false)}
                        >
                            <ExternalLink className="h-4 w-4 mr-2 text-info-400" />
                            Outlook
                        </a>
                        <button
                            onClick={() => {
                                CalendarService.downloadIcs(event);
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <Download className="h-4 w-4 mr-2 text-success-500" />
                            Fichier ICS
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
