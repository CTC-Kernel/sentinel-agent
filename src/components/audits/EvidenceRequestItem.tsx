import React from 'react';
import { EvidenceRequest, UserProfile, Document } from '../../types';
import { Clock, User, ChevronDown, FileText, X, Trash2, ShieldCheck } from '../ui/Icons';
import { format } from 'date-fns';
import { useLocale } from '@/hooks/useLocale';
import { FileUploader } from '../ui/FileUploader';

interface EvidenceRequestItemProps {
 req: EvidenceRequest;
 user: UserProfile | null;
 users: UserProfile[];
 documents: Document[];
 isExpanded: boolean;
 canEdit: boolean;
 onExpand: (id: string | null) => void;
 onStatusChange: (req: EvidenceRequest, status: EvidenceRequest['status']) => void;
 onDelete: (id: string) => void;
 onUpload: (req: EvidenceRequest, url: string, name: string) => void;
}

export const EvidenceRequestItem: React.FC<EvidenceRequestItemProps> = React.memo(({
 req,
 users,
 documents,
 isExpanded,
 canEdit,
 onExpand,
 onStatusChange,
 onDelete,
 onUpload
}) => {
 const { dateFnsLocale } = useLocale();
 const [processingAction, setProcessingAction] = React.useState<string | null>(null);

 const handleAction = async (actionName: string, actionFn: () => void | Promise<void>) => {
 if (processingAction) return;
 setProcessingAction(actionName);
 try {
 await actionFn();
 } finally {
 if (actionName !== 'delete') { // If delete, component might unmount, but harmless to set
 setProcessingAction(null);
 }
 }
 };

 const handleUpload = async (url: string, name: string) => {
 await handleAction('upload', async () => onUpload(req, url, name));
 };

 return (
 <div key={req.id || 'unknown'} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-primary/30 group">
 <div
 className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-muted/50 dark:hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-3xl"
 onClick={() => onExpand(isExpanded ? null : req.id)}
 role="button"
 tabIndex={0}
 onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onExpand(isExpanded ? null : req.id)}
 >
 <div className="flex items-center gap-4 min-w-0">
  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${req.status === 'Accepted' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20' : 'bg-muted text-muted-foreground'}`}>
  <FileText className="w-5 h-5" />
  </div>
  <div className="min-w-0">
  <h4 className="font-bold text-sm text-foreground truncate pr-4">{req.title}</h4>
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-0.5">
  <span className={`inline-flex items-center gap-1 font-semibold ${req.status === 'Accepted' ? 'text-emerald-600' : req.status === 'Provided' ? 'text-blue-600' : 'text-amber-600'}`}>
  <span className={`w-1.5 h-1.5 rounded-full ${req.status === 'Accepted' ? 'bg-emerald-500' : req.status === 'Provided' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
  {req.status}
  </span>
  {req.dueDate && (
  <span className="flex items-center gap-1">
   <Clock className="w-3 h-3" />
   {format(new Date(req.dueDate), 'dd MMM', { locale: dateFnsLocale })}
  </span>
  )}
  {req.assignedTo && (
  <span className="flex items-center gap-1 truncate max-w-[120px]">
   <User className="w-3 h-3" />
   {users.find(u => u.uid === req.assignedTo)?.displayName?.split(' ')[0] || 'Inconnu'}
  </span>
  )}
  </div>
  </div>
 </div>
 <div className="flex items-center gap-2 pl-4">
  <div className={`p-1.5 rounded-full transition-transform duration-200 ${isExpanded ? 'bg-muted rotate-180' : ''}`}>
  <ChevronDown className="w-4 h-4 text-muted-foreground" />
  </div>
 </div>
 </div>

 {isExpanded && (
 <div className="p-6 border-t border-border bg-muted/50">
  <div className="mb-6">
  <h5 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Description</h5>
  <p className="text-sm text-muted-foreground bg-card p-4 rounded-3xl border border-border">
  {req.description}
  </p>
  </div>

  {/* Documents List */}
  <div className="space-y-3 mb-6">
  <h5 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Preuves fournies</h5>
  {req.documentIds && req.documentIds.length > 0 ? (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  {req.documentIds.map(docId => {
   const docObj = documents.find(d => d.id === docId);
   if (!docObj) return null;
   return (
   <div key={docId || 'unknown'} className="flex items-center justify-between p-3 bg-card rounded-3xl border border-border/40 text-sm hover:border-primary/40 transition-colors group">
   <div className="flex items-center overflow-hidden">
   <FileText className="w-4 h-4 text-primary mr-2 flex-shrink-0" />
   <span className="truncate font-medium text-foreground">{docObj.title}</span>
   </div>
   <a href={docObj.url} target="_blank" rel="noreferrer" className="text-primary hover:text-primary text-xs font-bold px-3 py-1 bg-primary/10 dark:bg-primary rounded-lg opacity-0 group-hover:opacity-70 transition-opacity focus:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
   Voir
   </a>
   </div>
   );
  })}
  </div>
  ) : (
  <div className="text-center py-6 bg-card rounded-3xl border border-dashed border-border/40">
  <p className="text-xs text-muted-foreground italic">Aucun document fourni pour le moment.</p>
  </div>
  )}
  </div>

  {/* Actions */}
  <div className="flex flex-col md:flex-row gap-6 pt-6 border-t border-border/40">
  <div className="flex-1">
  <h5 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Ajouter une preuve</h5>
  <FileUploader
  onUploadComplete={handleUpload}
  category="evidence"
  disabled={!!processingAction}
  />
  </div>

  {canEdit && (
  <div className="flex flex-col gap-2 min-w-[150px]">
  <h5 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-2">Actions</h5>
  {req.status !== 'Accepted' && (
   <button
   type="button"
   onClick={() => handleAction('accept', () => onStatusChange(req, 'Accepted'))}
   disabled={!!processingAction}
   aria-label="Accepter la demande"
   className="w-full px-3 py-2 bg-emerald-500 dark:bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 dark:hover:bg-emerald-700 transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-border"
   >
   {processingAction === 'accept' ? <span className="animate-spin mr-2">⌛</span> : <ShieldCheck className="w-4 h-4 mr-2" />}
   Accepter
   </button>
  )}
  {req.status !== 'Rejected' && (
   <button
   type="button"
   onClick={() => handleAction('reject', () => onStatusChange(req, 'Rejected'))}
   disabled={!!processingAction}
   aria-label="Rejeter la demande"
   className="w-full px-3 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-600 dark:hover:bg-red-700 transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-border"
   >
   {processingAction === 'reject' ? <span className="animate-spin mr-2">⌛</span> : <X className="w-4 h-4 mr-2" />}
   Rejeter
   </button>
  )}
  <button
   type="button"
   onClick={() => handleAction('delete', () => onDelete(req.id))}
   disabled={!!processingAction}
   aria-label="Supprimer la demande"
   className="w-full px-3 py-2 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors flex items-center justify-center mt-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-border"
  >
   {processingAction === 'delete' ? <span className="animate-spin mr-2">⌛</span> : <Trash2 className="w-4 h-4 mr-2" />}
   Supprimer
  </button>
  </div>
  )}
  </div>
 </div>
 )}
 </div>
 );
});

EvidenceRequestItem.displayName = 'EvidenceRequestItem';
