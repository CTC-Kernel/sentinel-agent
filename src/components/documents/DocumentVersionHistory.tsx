import React from 'react';
import { DocumentVersion } from '../../types';
import { Clock, Download } from '../ui/Icons';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';

interface DocumentVersionHistoryProps {
 versions: DocumentVersion[];
 currentVersionId?: string;
}

export const DocumentVersionHistory: React.FC<DocumentVersionHistoryProps> = ({ versions, currentVersionId }) => {
 const { t, dateFnsLocale } = useLocale();

 if (versions.length === 0) {
 return <div className="text-center py-8 text-muted-foreground text-sm">{t('documents.versionHistory.noPreviousVersions', { defaultValue: 'Aucune version antérieure disponible.' })}</div>;
 }

 return (
 <div className="space-y-4">
 <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
 <Clock className="h-4 w-4 text-primary" />
 {t('documents.versionHistory.title', { defaultValue: 'Historique des Versions' })}
 </h3>

 <div className="space-y-3">
 {versions.map((version) => (
  <div key={version.id || 'unknown'} className={`p-4 rounded-3xl border flex items-center justify-between group transition-all ${version.id === currentVersionId
  ? 'bg-primary/10 border-primary/30 dark:bg-primary dark:border-primary/90'
  : 'bg-white border-border/40 hover:border-primary/40 dark:hover:border-primary/80'
  }`}>
  <div className="flex items-center gap-4">
  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-mono font-bold text-sm">
  v{version.version}
  </div>
  <div>
  <div className="text-sm font-bold text-foreground">
   {version.changeLog || t('documents.versionHistory.standardUpdate', { defaultValue: 'Mise à jour standard' })}
  </div>
  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
   <span>{version.uploadedAt ? format(new Date(version.uploadedAt), 'PPP à p', { locale: dateFnsLocale }) : t('documents.versionHistory.unknownDate', { defaultValue: 'Date inconnue' })}</span>
   {version.id === currentVersionId && (
   <span className="bg-primary/15 text-primary px-1.5 py-0.5 rounded text-xs font-bold">{t('documents.versionHistory.current', { defaultValue: 'ACTUEL' })}</span>
   )}
  </div>
  </div>
  </div>

  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-70 transition-opacity">
  {version.url && (
  <a
   href={version.url}
   target="_blank"
   rel="noopener noreferrer"
   className="p-2.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-primary transition-colors"
   title={t('common.download', { defaultValue: 'Télécharger' })}
  >
   <Download className="h-4 w-4" />
  </a>
  )}
  </div>
  </div>
 ))}
 </div>
 </div>
 );
};
