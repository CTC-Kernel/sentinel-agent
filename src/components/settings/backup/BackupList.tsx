import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Database, Download, Trash2, CheckCircle2, RefreshCw, AlertTriangle } from '../../ui/Icons';
import { Button } from '../../ui/button';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { BackupMetadata } from '../../../services/backupService';

interface BackupListProps {
 backups: BackupMetadata[];
 selectedBackup: BackupMetadata | null;
 onSelect: (backup: BackupMetadata) => void;
 onDownload: (id: string) => void;
 onDelete: (id: string) => void;
}

export const BackupList: React.FC<BackupListProps> = ({
 backups,
 selectedBackup,
 onSelect,
 onDownload,
 onDelete
}) => {
 const { dateFnsLocale } = useLocale();
 const getStatusColor = (status: string): string => {
 switch (status) {
 case 'completed': return 'text-success-text bg-success-bg';
 case 'creating': return 'text-info-text bg-info-bg';
 case 'failed': return 'text-error-text bg-error-bg';
 default: return 'text-muted-foreground bg-muted';
 }
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'completed': return <CheckCircle2 className="h-4 w-4" />;
 case 'creating': return <RefreshCw className="h-4 w-4 animate-spin" />;
 case 'failed': return <AlertTriangle className="h-4 w-4" />;
 default: return <Clock className="h-4 w-4" />;
 }
 };

 const formatBackupDate = (dateString: string): Date => {
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // Return a valid fallback date (current date) for invalid dates
        return new Date();
      }
      return date;
    } catch {
      // Return a valid fallback date (current date) for any errors
      return new Date();
    }
  };

  return (
    <div className="glass-premium p-4 sm:p-6 rounded-3xl border border-border/40/50 h-full max-h-[800px] flex flex-col">
      <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" /> Historique
      </h2>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Database className="h-10 w-10 opacity-20 mb-3" />
            <p className="font-medium">Aucune sauvegarde</p>
          </div>
        ) : (
          backups.map((backup) => {
            const backupDate = formatBackupDate(backup.createdAt);
            return (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={backup.id || 'unknown'}
                onClick={() => onSelect(backup)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer group relative ${selectedBackup?.id === backup.id ? 'bg-primary/10 border-primary/30 dark:bg-primary dark:border-primary/40 ring-1 ring-primary/60' : 'bg-white/50 dark:bg-white/5 border-border/40 dark:border-white/5 hover:bg-white dark:hover:bg-muted hover:shadow-md'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{backup.id.slice(0, 6)}...</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getStatusColor(backup.status).replace('bg-', 'border-').replace('/20', '/30')}`}>
                      {getStatusIcon(backup.status)}
                      <span className="ml-1.5">{backup.status}</span>
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {backup.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Télécharger le backup"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDownload(backup.id); }}
                        className="p-1.5 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:hover:bg-blue-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-70 focus:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title="Télécharger"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer le backup"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onDelete(backup.id); // Just propagate ID, parent handles confirmation
                      }}
                      className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-70 focus:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 glass-premium rounded-lg shadow-sm">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {format(backupDate, "d MMM yyyy", { locale: dateFnsLocale })}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium">
                      {format(backupDate, "HH:mm", { locale: dateFnsLocale })} • {backup.collections.length} collections
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {backup.collections.slice(0, 3).map(c => (
                    <span key={c || 'unknown'} className="text-[11px] font-medium px-1.5 py-0.5 bg-muted rounded text-muted-foreground capitalize">{c}</span>
                  ))}
                  {backup.collections.length > 3 && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 bg-muted rounded text-muted-foreground">+{backup.collections.length - 3}</span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
