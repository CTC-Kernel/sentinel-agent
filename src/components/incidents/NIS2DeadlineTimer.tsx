import React, { useEffect, useState } from 'react';
import { Incident } from '../../types';
import { getIncidentDeadlines, DeadlineStatus } from '../../utils/nis2Utils';
import { Clock, AlertTriangle, CheckCircle, AlertCircle } from '../ui/Icons';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';

interface Props {
 incident: Incident;
 compact?: boolean;
}

export const NIS2DeadlineTimer: React.FC<Props> = ({ incident, compact = false }) => {
 const { dateFnsLocale, t } = useLocale();
 const [deadlines, setDeadlines] = useState(getIncidentDeadlines(incident));

 useEffect(() => {
 const interval = setInterval(() => {
 setDeadlines(getIncidentDeadlines(incident));
 }, 60000); // Update every minute
 return () => clearInterval(interval);
 }, [incident]);

 if (!incident.isSignificant) return null;

 if (compact) {
 // Find most urgent pending deadline
 const urgent = deadlines.find(d => !d.isCompleted && d.status !== DeadlineStatus.OK) || deadlines.find(d => !d.isCompleted);

 if (!urgent) return (
 <div className="flex items-center gap-1.5 text-[10px] font-black text-success uppercase tracking-wider bg-success/10 px-2 py-1 rounded-xl border border-success/20">
 <CheckCircle className="w-3 h-3" />
 <span>NIS2 OK</span>
 </div>
 );

 const colorClass = urgent.status === DeadlineStatus.OVERDUE ? 'text-destructive bg-destructive/10 border-destructive/20' :
 urgent.status === DeadlineStatus.WARNING ? 'text-warning bg-warning/10 border-warning/20' :
 'text-primary bg-primary/10 border-primary/20';

 return (
 <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-xl border ${colorClass}`} title={urgent.label}>
 <Clock className="w-3 h-3" />
 <span>{urgent.remainingHours > 0 ? `${urgent.remainingHours}h` : t('incidents.nis2.late', { defaultValue: 'Retard' })}</span>
 </div>
 );
 }

 return (
 <div className="space-y-2">
 {deadlines.map((d, i) => (
 <div key={i || 'unknown'} className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-normal ease-apple ${d.isCompleted ? 'bg-muted/5 border-border/20 text-muted-foreground' :
  d.status === DeadlineStatus.OVERDUE ? 'bg-destructive/10 border-destructive/20 text-destructive shadow-sm' :
  d.status === DeadlineStatus.WARNING ? 'bg-warning/10 border-warning/20 text-warning shadow-sm' :
  'bg-primary/10 border-primary/20 text-primary shadow-sm'
  }`}>
  <div className="flex items-center gap-3">
  {d.isCompleted ? <CheckCircle className="w-5 h-5" /> :
  d.status === DeadlineStatus.OVERDUE ? <AlertCircle className="w-5 h-5" /> :
  d.status === DeadlineStatus.WARNING ? <AlertTriangle className="w-5 h-5" /> :
   <Clock className="w-5 h-5" />}

  <div>
  <p className="text-sm font-semibold">{d.label}</p>
  <p className="text-xs opacity-80">
  {d.isCompleted ? t('incidents.nis2.notified', { defaultValue: 'Notifié' }) : `${t('incidents.nis2.deadline', { defaultValue: 'Échéance' })} : ${format(d.deadlineDate, 'dd/MM HH:mm', { locale: dateFnsLocale })}`}
  </p>
  </div>
  </div>

  {!d.isCompleted && (
  <div className="text-right">
  <span className="text-lg font-bold">
  {d.remainingHours > 0 ? `${d.remainingHours}h` : t('incidents.nis2.expired', { defaultValue: 'EXPIRÉ' })}
  </span>
  {d.remainingHours > 0 && <p className="text-[11px] uppercase">{t('incidents.nis2.remaining', { defaultValue: 'Restant' })}</p>}
  </div>
  )}
 </div>
 ))}
 </div>
 );
};
