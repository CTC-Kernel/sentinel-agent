import React from 'react';
import { Audit } from '../../types';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { ChevronLeft, ChevronRight } from '../ui/Icons';
import { useLocale } from '@/hooks/useLocale';
import { Skeleton } from '../ui/Skeleton';

interface AuditCalendarProps {
 audits: Audit[];
 onAuditClick: (audit: Audit) => void;
 loading?: boolean;
}

export const AuditCalendar: React.FC<AuditCalendarProps> = ({ audits, onAuditClick, loading }) => {
 const { t, config } = useLocale();
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
  <h2 className="text-2xl font-bold text-foreground capitalize">
  {currentDate.toLocaleString(config.intlLocale, { month: 'long', year: 'numeric' })}
  </h2>
  <div className="flex gap-1 bg-muted rounded-lg p-1">
  <button onClick={prevMonth} aria-label={t('audits.calendarLabels.prevMonth')} className="p-1 hover:bg-white dark:hover:bg-muted rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
  <button onClick={today} className="px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-white dark:hover:bg-muted rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t('audits.calendarLabels.today')}</button>
  <button onClick={nextMonth} aria-label={t('audits.calendarLabels.nextMonth')} className="p-1 hover:bg-white dark:hover:bg-muted rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
  </div>
 </div>
 <div className="flex items-center gap-4 text-sm text-muted-foreground">
  <div className="flex items-center gap-2">
  <span className="w-3 h-3 rounded-full bg-info-text"></span> {t('audits.status.planned')}
  </div>
  <div className="flex items-center gap-2">
  <span className="w-3 h-3 rounded-full bg-warning"></span> {t('audits.status.inProgress')}
  </div>
  <div className="flex items-center gap-2">
  <span className="w-3 h-3 rounded-full bg-success"></span> {t('audits.status.completed')}
  </div>
 </div>
 </div>

 {/* Grid */}
 <div className="flex-1 grid grid-cols-7 auto-rows-fr gap-px bg-muted dark:bg-white/10 border border-border/40 rounded-3xl overflow-hidden">
 {/* Weekdays */}
 {[0, 1, 2, 3, 4, 5, 6].map(d => (
  <div key={d || 'unknown'} className="bg-muted/50 p-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
  {new Date(2024, 0, d).toLocaleString(config.intlLocale, { weekday: 'short' })}
  </div>
 ))}

 {/* Loading State */}
 {loading && Array.from({ length: 35 }).map((_, i) => (
  <div key={`skeleton-${i || 'unknown'}`} className="bg-card/30 p-2 min-h-[120px]">
  <Skeleton className="h-6 w-6 rounded-full mb-2" />
  <div className="space-y-2">
  <Skeleton className="h-4 w-full rounded" />
  <Skeleton className="h-4 w-2/3 rounded" />
  </div>
  </div>
 ))}

 {/* Empty Cells */}
 {!loading && Array.from({ length: firstDay }).map((_, i) => (
  <div key={`empty-${i || 'unknown'}`} className="bg-card/30 min-h-[120px]" />
 ))}

 {/* Days */}
 {!loading && days.map(day => {
  const dayAudits = getAuditsForDay(day);
  const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();

  return (
  <div key={day || 'unknown'} className={`bg-card/30 p-2 min-h-[120px] relative group hover:bg-muted/50 dark:hover:bg-muted/50 transition-colors ${isToday ? 'bg-info-bg' : ''}`}>
  <span className={`absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${isToday ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'text-muted-foreground'}`}>
  {day}
  </span>
  <div className="mt-8 space-y-1.5">
  {dayAudits.map(audit => (
   <button
   key={audit.id || 'unknown'}
   onClick={() => onAuditClick(audit)}
   className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold truncate transition-all hover:scale-[1.02] active:scale-95 shadow-sm border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${audit.status === 'Terminé' ? 'bg-success-bg text-success-text border-success-border' :
   audit.status === 'En cours' ? 'bg-warning-bg text-warning-text border-warning-border' :
   'bg-info-bg text-info-text border-info-border'
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
