import React from 'react';
import { useTranslation } from 'react-i18next';
import { useResourceLogs } from '../../hooks/useResourceLogs';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { History, User } from '../ui/Icons';
import { Loader2 } from '../ui/Icons';

interface ResourceHistoryProps {
 resourceId: string;
 resourceType: string;
 className?: string;
}

export const ResourceHistory: React.FC<ResourceHistoryProps> = ({ resourceId, resourceType, className }) => {
 const { t } = useTranslation();
 const { dateFnsLocale } = useLocale();
 const { logs, loading, hasMore, loadMore } = useResourceLogs(resourceType, resourceId);

 if (loading && logs.length === 0) {
 return (
 <div className="flex justify-center items-center py-8 text-muted-foreground">
 <Loader2 className="h-6 w-6 animate-spin mr-2" /> {t('history.loading', { defaultValue: 'Chargement de l\'historique...' })}
 </div>
 );
 }

 if (!loading && logs.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed border-border/40 rounded-3xl">
 <History className="h-8 w-8 mb-2 opacity-60" />
 <p className="text-sm">{t('history.noHistory', { defaultValue: 'Aucun historique disponible pour cet élément.' })}</p>
 </div>
 );
 }

 return (
 <div className={`space-y-6 ${className}`}>
 <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
 <History className="h-5 w-5 text-primary" /> {t('history.title', { defaultValue: 'Historique des modifications' })}
 </h3>

 <div className="relative border-l-2 border-border/40 ml-3 space-y-8 pb-4">
 {logs.map((log) => {
  let date: Date;
  try {
  const timestamp = log.timestamp as { seconds: number } | number | string | Date;
  if (timestamp instanceof Date) {
  date = timestamp;
  } else if (typeof timestamp === 'object' && timestamp !== null && 'seconds' in timestamp) {
  date = new Date(timestamp.seconds * 1000);
  } else if (timestamp) {
  date = new Date(timestamp);
  } else {
  date = new Date(); // Fallback to now or handle invalid
  }
  } catch {
  date = new Date(); // Fallback
  }

  const isValidDate = (d: Date) => d instanceof Date && !isNaN(d.getTime());

  return (
  <div key={log.id || 'unknown'} className="relative pl-6">
  {/* Timeline Dot */}
  <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white ${log.action === 'create' ? 'bg-green-500' :
  log.action === 'delete' ? 'bg-red-500' :
   'bg-blue-500'
  }`} />

  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
  <div className="space-y-1">
   <p className="text-sm font-medium text-foreground">
   {isValidDate(date) ? format(date, "d MMMM yyyy à HH:mm", { locale: dateFnsLocale }) : '-'}
   </p>
   <p className="text-sm text-muted-foreground">
   <span className={`font-bold uppercase text-xs mr-2 px-1.5 py-0.5 rounded ${log.action === 'CREATE' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
   log.action === 'DELETE' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
   'bg-info-bg text-info-text'
   }`}>{log.action}</span>
   {log.details}
   </p>

   {/* Granular Changes if available */}
   {log.changes && log.changes.length > 0 && (
   <div className="mt-2 text-xs bg-muted/50 p-2 rounded-lg border border-border/40 dark:border-white/5">
   {log.changes.map((change, idx) => (
   <div key={`${idx || 'unknown'}-${change.field}`} className="flex gap-2 font-mono">
    <span className="text-muted-foreground">{change.field}:</span>
    <span className="text-red-400 line-through">{String(change.oldValue)}</span>
    <span className="text-muted-foreground">→</span>
    <span className="text-green-600 dark:text-green-400">{String(change.newValue)}</span>
   </div>
   ))}
   </div>
   )}
  </div>

  <div className="flex items-center text-xs text-muted-foreground gap-1 mt-1 sm:mt-0">
   <User className="h-3 w-3" />
   {log.userDisplayName || log.userEmail || t('history.system', { defaultValue: 'Système' })}
  </div>
  </div>
  </div>
  );
 })}
 </div>

 {hasMore && (
 <button
  onClick={loadMore}
  disabled={loading}
  className="w-full py-2 text-sm text-primary hover:text-primary font-medium text-center border-t border-border/40 dark:border-white/5 pt-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
  {loading ? t('common.loading', { defaultValue: 'Chargement...' }) : t('history.viewMore', { defaultValue: 'Voir plus d\'historique' })}
 </button>
 )}
 </div>
 );
};
