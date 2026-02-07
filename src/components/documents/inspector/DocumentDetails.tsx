import React from 'react';
import { Document, Control } from '../../../types';
import { ExternalLink, Link as LinkIcon, FileText as FileIcon } from '../../ui/Icons';
import { SafeHTML } from '../../ui/SafeHTML';
import { Button } from '../../ui/button';

interface DocumentDetailsProps {
 document: Document;
 controls: Control[];
 onSecureView: (doc: Document) => void;
}

export const DocumentDetails: React.FC<DocumentDetailsProps> = ({
 document: selectedDocument,
 controls: linkedControls,
 onSecureView
}) => {
 return (
 <div className="space-y-8 animate-fade-in">
 <div className="prose prose-slate dark:prose-invert max-w-none">
 <h3 className="text-sm font-bold bg-muted p-2 rounded-lg inline-block text-foreground mb-4">
  Description
 </h3>
 <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-white/50 dark:border-white/5">
  <SafeHTML content={selectedDocument.description || '<p className="text-muted-foreground italic">Aucune description disponible.</p>'} />
 </div>
 </div>

 {/* Linked Controls */}
 {linkedControls.length > 0 && (
 <div>
  <h3 className="text-sm font-bold bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 p-2 rounded-lg inline-block mb-4">
  Contrôles Associés ({linkedControls.length})
  </h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  {linkedControls.map(ctrl => (
  <div
  key={ctrl.id || 'unknown'}
  className="p-3 bg-white dark:bg-white/5 border border-border/40 rounded-3xl flex items-center justify-between group hover:border-primary/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
  role="button"
  tabIndex={0}
  >
  <div className="flex items-center gap-3">
   <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
   {ctrl.code}
   </div>
   <span className="text-sm font-medium text-foreground group-hover:text-primary truncate max-w-[200px]">
   {ctrl.name}
   </span>
  </div>
  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
  </div>
  ))}
  </div>
 </div>
 )}

 {/* External Links */}
 {selectedDocument.storageProvider !== 'firebase' && selectedDocument.externalUrl && (
 <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-3xl flex items-center gap-3">
  <LinkIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
  <div className="flex-1">
  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Lien Externe</p>
  <a
  href={selectedDocument.externalUrl}
  target="_blank"
  rel="noopener noreferrer"
  className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
  >
  {selectedDocument.externalUrl}
  </a>
  </div>
  <ExternalLink className="h-4 w-4 text-blue-500" />
 </div>
 )}

 {/* File Preview Link */}
 {selectedDocument.url && (
 <div>
  <h3 className="text-sm font-bold bg-muted p-2 rounded-lg inline-block text-foreground mb-4">Fichier</h3>
  <div className="flex items-center gap-4 p-4 border rounded-3xl bg-muted/50">
  <div className="h-12 w-12 bg-card rounded-lg flex items-center justify-center shadow-sm">
  <FileIcon className="h-6 w-6 text-primary" />
  </div>
  <div>
  <p className="font-medium text-foreground">{selectedDocument.title}</p>
  <Button
  variant="link"
  onClick={() => onSecureView(selectedDocument)}
  className="text-sm text-primary hover:underline px-1 h-auto py-0"
  >
  Ouvrir l'aperçu
  </Button>
  </div>
  </div>
 </div>
 )}
 </div>
 );
};
