import React, { useState, useMemo } from 'react';

import { useTimelineData } from '../../hooks/timeline/useTimelineData';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { motion, AnimatePresence } from 'framer-motion';
import {
 History,
 User,
 Calendar,
 Eye,
 Clock,
 Trash2,
 Edit,
 Plus
} from '../ui/Icons';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';

interface AuditLog {
 id: string;
 action: 'create' | 'update' | 'delete';
 entityType: string;
 entityId: string;
 userId: string;
 userName: string;
 timestamp: Date;
 before?: Record<string, unknown>;
 after?: Record<string, unknown>;
 changes?: string[];
 details?: string;
}

interface TimelineViewProps {
 resourceId: string;
 resourceType?: string;
 className?: string;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ resourceId, className }) => {
 const { dateFnsLocale } = useLocale();

 // Wait, if I remove 'user', useStore might return other things I'm not using?
 // The original line was: const { user } = useStore();
 // If I just remove 'user', it becomes const {} = useStore(); which is useless.
 // I should check if useStore is used elsewhere.
 // Line 40: const { user } = useStore();
 // UseStore is imported in line 2.
 // UseStore is NOT used anywhere else in the file based on the read in Step 23.
 // So I can remove the entire line.
 const { systemLogs, loading } = useTimelineData();
 const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

 // Filter and transform logs for this specific resource
 const logs = useMemo(() => {
 if (!resourceId) return [];

 return systemLogs
 .filter(log => log.resourceId === resourceId)
 .map(log => {
 // Reconstruct before/after from changes for diff viewer
 // SystemLog has changes: { field, oldValue, newValue }[]
 let before: Record<string, unknown> | undefined;
 let after: Record<string, unknown> | undefined;
 const changeDescriptions: string[] = [];

 if (log.changes && Array.isArray(log.changes)) {
  before = {};
  after = {};
  log.changes.forEach(change => {
  if (before) before[change.field] = change.oldValue;
  if (after) after[change.field] = change.newValue;

  // Create readable description
  // Handle simple values for cleaner display
  const fmtVal = (val: unknown) => {
  if (val === null || val === undefined) return 'vide';
  if (typeof val === 'object') return '...';
  return String(val);
  };
  changeDescriptions.push(`${change.field}: ${fmtVal(change.oldValue)} → ${fmtVal(change.newValue)}`);
  });
 } else if (log.metadata) {
  // Fallback to metadata if old format or different structure
  if ('before' in log.metadata && typeof log.metadata.before === 'object') {
  before = log.metadata.before as Record<string, unknown>;
  }
  if ('after' in log.metadata && typeof log.metadata.after === 'object') {
  after = log.metadata.after as Record<string, unknown>;
  }
 }

 // Parse date safely
 let dateObj = new Date();
 try {
  dateObj = new Date(log.timestamp);
 } catch {
  // Keep default date if timestamp parsing fails
 }

 return {
  id: log.id,
  action: (log.action as 'create' | 'update' | 'delete') || 'update',
  entityType: log.resource || '',
  entityId: log.resourceId || '',
  userId: log.userId || '',
  userName: log.userDisplayName || log.userEmail || 'Utilisateur inconnu',
  timestamp: dateObj,
  before: before,
  after: after,
  changes: changeDescriptions.length > 0 ? changeDescriptions : undefined,
  details: log.details
 };
 })
 .slice(0, 100); // Limit to 100
 }, [systemLogs, resourceId]);

 const getActionIcon = (action: string) => {
 switch (action) {
 case 'create': return <Plus className="h-4 w-4" />;
 case 'update': return <Edit className="h-4 w-4" />;
 case 'delete': return <Trash2 className="h-4 w-4" />;
 default: return <Clock className="h-4 w-4" />;
 }
 };

 const getActionColor = (action: string) => {
 switch (action) {
 case 'create': return 'bg-success-bg text-success-text border-success-border/50';
 case 'update': return 'bg-info-bg text-info-text border-info-border/50';
 case 'delete': return 'bg-error-bg text-error-text border-error-border/50';
 default: return 'bg-muted text-foreground border-border/40';
 }
 };

 if (loading) {
 return (
 <div className="flex justify-center items-center p-8 text-muted-foreground">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
 </div>
 );
 }

 if (logs.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border-2 border-dashed border-border/40 rounded-3xl">
 <History className="h-10 w-10 mb-3 opacity-60" />
 <p className="text-sm font-medium">Aucun historique disponible</p>
 </div>
 );
 }

 return (
 <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
 {/* Timeline List */}
 <div className="space-y-6">
 <div className="flex items-center justify-between mb-4">
  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
  <History className="h-4 w-4 text-primary" />
  Timeline ({logs.length})
  </h3>
 </div>

 <div className="relative border-l-2 border-border/40 ml-3 space-y-6 pb-4">
  {logs.map((log) => (
  <button
  key={log.id || 'unknown'}
  type="button"
  className={`relative pl-6 group transition-all focus-visible:outline-none w-full text-left`}
  onClick={() => setSelectedLog(log)}
  aria-label={`Détails de l'événement ${log.action} par ${log.userName}`}
  >
  {/* Dot */}
  <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 shadow-sm transition-all
  ${selectedLog?.id === log.id
   ? 'bg-primary border-primary/40 scale-110'
   : 'bg-card border-border/40 group-hover:border-primary/60'
  }`}
  />

  {/* Card */}
  <div className={`p-4 rounded-3xl border transition-all
  ${selectedLog?.id === log.id
   ? 'bg-primary/10 border-primary/30 dark:border-primary/90 shadow-md ring-1 ring-primary/60'
   : 'bg-card border-border/40 hover:border-primary/30 dark:hover:border-primary/90 hover:shadow-sm'}
  group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 dark:group-focus-visible:ring-offset-slate-900 rounded-3xl
  `}>

  <div className="flex items-center justify-between mb-2">
   <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getActionColor(log.action)}`}>
   {getActionIcon(log.action)}
   {log.action}
   </span>
   <span className="text-xs text-muted-foreground font-mono">
   {format(log.timestamp, "HH:mm", { locale: dateFnsLocale })}
   </span>
  </div>

  <div className="flex items-center gap-2 text-sm text-foreground mb-2">
   <User className="h-3 w-3 text-muted-foreground" />
   <span className="font-medium">{log.userName}</span>
  </div>

  <div className="text-xs text-muted-foreground mb-3">
   {format(log.timestamp, "d MMMM yyyy", { locale: dateFnsLocale })}
  </div>

  {log.changes && log.changes.length > 0 && (
   <div className="space-y-1 pt-2 border-t border-border/40 dark:border-white/5">
   {log.changes.slice(0, 3).map((change, idx) => (
   <div key={`${idx || 'unknown'}-${change}`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
   <div className="w-1 h-1 rounded-full bg-muted-foreground"></div>
   <span className="truncate">{change}</span>
   </div>
   ))}
   {log.changes.length > 3 && (
   <div className="text-xs text-primary pl-2.5 font-medium">
   +{log.changes.length - 3} autres modifications...
   </div>
   )}
   </div>
  )}
  </div>
  </button>
  ))}
 </div>
 </div>

 {/* Diff Viewer / Details Panel */}
 <div className="relative">
 <div className="sticky top-4">
  <AnimatePresence mode="popLayout">
  {selectedLog ? (
  <motion.div
  key={selectedLog.id || 'unknown'}
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  className="bg-card border border-border/40 rounded-2xl p-6 shadow-xl"
  >
  <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
   <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
   <Eye className="h-5 w-5 text-primary" />
   Détails de l'événement
   </h3>
   <button
   onClick={() => setSelectedLog(null)}
   className="text-muted-foreground hover:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1"
   >
   Fermer
   </button>
  </div>

  <div className="space-y-6">
   <div className="grid grid-cols-2 gap-4">
   <div className="p-3 rounded-lg bg-muted/50">
   <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block mb-1">Auteur</span>
   <div className="flex items-center gap-2">
   <div className="h-6 w-6 rounded-full bg-primary/15 dark:bg-primary flex items-center justify-center text-primary text-xs font-bold">
    {selectedLog.userName.charAt(0)}
   </div>
   <span className="text-sm font-medium text-foreground">{selectedLog.userName}</span>
   </div>
   </div>
   <div className="p-3 rounded-lg bg-muted/50">
   <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block mb-1">Date</span>
   <div className="flex items-center gap-2">
   <Calendar className="h-4 w-4 text-muted-foreground" />
   <span className="text-sm font-medium text-foreground">
    {format(selectedLog.timestamp, "d MMM yyyy, HH:mm", { locale: dateFnsLocale })}
   </span>
   </div>
   </div>
   </div>

   {selectedLog.before && selectedLog.after ? (
   <div className="mt-4">
   <h4 className="text-sm font-bold text-foreground mb-3">
   Visualisation des changements
   </h4>
   <div className="rounded-3xl overflow-hidden border border-border/40 text-xs shadow-inner bg-muted/50 dark:bg-black/20">
   <ReactDiffViewer
    oldValue={JSON.stringify(selectedLog.before, null, 2)}
    newValue={JSON.stringify(selectedLog.after, null, 2)}
    splitView={false}
    showDiffOnly={true}
    useDarkTheme={document.documentElement.classList.contains('dark')}
    styles={{
    variables: {
    light: {
    diffViewerBackground: 'transparent',
    addedBackground: 'hsl(var(--success-bg))',
    addedColor: 'hsl(var(--success-text))',
    removedBackground: 'hsl(var(--error-bg))',
    removedColor: 'hsl(var(--error-text))',
    wordAddedBackground: 'hsl(var(--success) / 0.3)',
    wordRemovedBackground: 'hsl(var(--error) / 0.3)',
    },
    dark: {
    diffViewerBackground: 'transparent',
    addedBackground: 'hsl(var(--success) / 0.2)',
    addedColor: 'hsl(var(--success-text))',
    removedBackground: 'hsl(var(--error) / 0.2)',
    removedColor: 'hsl(var(--error-text))',
    wordAddedBackground: 'hsl(var(--success) / 0.4)',
    wordRemovedBackground: 'hsl(var(--error) / 0.4)',
    }
    }
    }}
   />
   </div>
   </div>
   ) : (
   <div className="p-8 text-center border-2 border-dashed border-border/40 rounded-3xl">
   <p className="text-muted-foreground text-sm">
   Aucun détail technique disponible pour cette action (probablement une création initiale ou une suppression simple).
   </p>
   </div>
   )}
  </div>
  </motion.div>
  ) : (
  <motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  className="hidden lg:flex flex-col items-center justify-center h-[400px] border-2 border-dashed border-border/40 rounded-2xl bg-muted/50 dark:bg-white/5 text-muted-foreground"
  >
  <Eye className="h-12 w-12 mb-3 opacity-60" />
  <p className="font-medium">Sélectionnez un événement</p>
  <p className="text-sm mt-1 opacity-70">pour voir les détails et différences</p>
  </motion.div>
  )}
  </AnimatePresence>
 </div>
 </div>
 </div>
 );
};
