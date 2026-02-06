import React from 'react';
import { FileText, ExternalLink } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import type { Document } from '../../../types';
import { useLocale } from '../../../hooks/useLocale';

interface AssetInspectorDocumentsProps {
 linkedDocuments: Document[];
}

export const AssetInspectorDocuments: React.FC<AssetInspectorDocumentsProps> = ({
 linkedDocuments
}) => {
 const { t } = useLocale();
 return (
 <div className="space-y-6 sm:space-y-8">
 <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center">
 <FileText className="h-4 w-4 mr-2" /> {t('assets.inspector.linkedDocuments', { defaultValue: 'Documents Liés' })} ({linkedDocuments.length})
 </h3>
 {linkedDocuments.length === 0 ? (
 <EmptyState compact icon={FileText} title={t('assets.inspector.noDocument', { defaultValue: 'Aucun document' })} description={t('assets.inspector.noDocumentDesc', { defaultValue: 'Aucun document associé.' })} />
 ) : (
 <div className="grid gap-4">
  {linkedDocuments.map(doc => (
  <div key={doc.id || 'unknown'} className="p-5 glass-premium rounded-3xl border border-border/40 shadow-sm hover:shadow-md transition-all">
  <div className="flex justify-between items-start mb-2">
  <span className="text-sm font-bold text-foreground truncate pr-4">{doc.title}</span>
  <span className={`text-xs uppercase font-bold px-2.5 py-1 rounded-3xl ${doc.status === 'Publié' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-muted/500/10 text-muted-foreground ring-1 ring-slate-500/20'}`}>
   {doc.status}
  </span>
  </div>
  <div className="flex items-center justify-between mt-3">
  <span className="text-xs text-muted-foreground">{doc.type} • v{doc.version}</span>
  <CustomTooltip content={t('assets.inspector.openDocumentNewTab', { defaultValue: 'Ouvrir le document dans un nouvel onglet' })}>
   <a href={doc.url} target="_blank" rel="noreferrer" aria-label={t('assets.inspector.viewDocumentAriaLabel', { defaultValue: 'Voir le document {{title}}', title: doc.title })} className="text-xs font-bold text-primary hover:text-primary flex items-center">
   {t('assets.inspector.view', { defaultValue: 'Voir' })} <ExternalLink className="h-3 w-3 ml-1" />
   </a>
  </CustomTooltip>
  </div>
  </div>
  ))}
 </div>
 )}
 </div>
 );
};
