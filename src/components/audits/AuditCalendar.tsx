import React from 'react';
import { Audit } from '../../types';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { ChevronLeft, ChevronRight } from '../ui/Icons';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '../ui/Skeleton';

interface AuditCalendarProps {
    audits: Audit[];
    onAuditClick: (audit: Audit) => void;
    loading?: boolean;
}

export const AuditCalendar: React.FC<AuditCalendarProps> = ({ audits, onAuditClick, loading }) => {
    const { t, i18n } = useTranslation();
    const [currentDate, setCurrentDate] = React.useState(new Date());

    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const days = Array.from({ length: daysInMonth(currentDate) }, (_, i) => i + 1);
    const firstDay = firstDayOfMonth(currentDate); // 0 = Sunday

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const today = () => setCurrentDate(new Date());

    const getAuditsForDay = (day: number) => {
        return audits.filter(a => {
            if (!a.dateScheduled) return false;
            const d = new Date(a.dateScheduled);
            return d.getDate() === day && d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
        });
    };

    return (
        <motion.div variants={slideUpVariants} className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40 shadow-xl backdrop-blur-xl overflow-hidden min-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white capitalize">
                        {currentDate.toLocaleString(i18n.language, { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex gap-1 bg-slate-100 dark:bg-white/5 rounded-lg p-1">
                        <button onClick={prevMonth} aria-label={t('audits.calendarLabels.prevMonth')} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
                        <button onClick={today} className="px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{t('audits.calendarLabels.today')}</button>
                        <button onClick={nextMonth} aria-label={t('audits.calendarLabels.nextMonth')} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span> {t('audits.status.planned')}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span> {t('audits.status.inProgress')}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span> {t('audits.status.completed')}
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr gap-px bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                {/* Weekdays */}
                {[0, 1, 2, 3, 4, 5, 6].map(d => (
                    <div key={d} className="bg-slate-50 dark:bg-slate-900/50 p-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                        {new Date(2024, 0, d).toLocaleString(i18n.language, { weekday: 'short' })}
                    </div>
                ))}

                {/* Loading State */}
                {loading && Array.from({ length: 35 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="bg-white dark:bg-slate-900/30 p-2 min-h-[120px]">
                        <Skeleton className="h-6 w-6 rounded-full mb-2" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full rounded" />
                            <Skeleton className="h-4 w-2/3 rounded" />
                        </div>
                    </div>
                ))}

                {/* Empty Cells */}
                {!loading && Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-white dark:bg-slate-900/30 min-h-[120px]" />
                ))}

                {/* Days */}
                {!loading && days.map(day => {
                    const dayAudits = getAuditsForDay(day);
                    const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();

                    return (
                        <div key={day} className={`bg-white dark:bg-slate-900/30 p-2 min-h-[120px] relative group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${isToday ? 'bg-blue-500 dark:bg-blue-900/30 dark:bg-blue-900' : ''}`}>
                            <span className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400'}`}>
                                {day}
                            </span>
                            <div className="mt-8 space-y-1.5">
                                {dayAudits.map(audit => (
                                    <button
                                        key={audit.id}
                                        onClick={() => onAuditClick(audit)}
                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold truncate transition-all hover:scale-[1.02] active:scale-95 shadow-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${audit.status === 'Terminé' ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' :
                                            audit.status === 'En cours' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' :
                                                'bg-blue-100 text-blue-800 border-blue-200 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                                            }`}
                                    >
                                        {audit.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
};
