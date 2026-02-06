import React, { useState } from 'react';
import { Control, Document } from '../../../types';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { Skeleton } from '../../ui/Skeleton';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { Upload, X, ShieldCheck, FileText, Check, ExternalLink, Loader2 } from '../../ui/Icons';
import { formatDate } from '@/utils/date';
import { useLocale } from '@/hooks/useLocale';

interface ComplianceEvidenceProps {
 control: Control;
 canEdit: boolean;
 documents: Document[];
 handlers: {
 updating: boolean;
 handleLinkDocument: (c: Control, did: string) => Promise<void>;
 handleUnlinkDocument: (c: Control, did: string) => Promise<void>;
 onUploadEvidence: (c: Control) => void;
 onValidateEvidence?: (did: string, action: 'approuver' | 'rejeter') => Promise<boolean>;
 };
}

export const ComplianceEvidence: React.FC<ComplianceEvidenceProps> = ({
 control,
 canEdit,
 documents,
 handlers
}) => {
 const { t } = useLocale();
 const { updating, handleLinkDocument, handleUnlinkDocument, onUploadEvidence, onValidateEvidence } = handlers;
 const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);
 const [validatingDocId, setValidatingDocId] = useState<string | null>(null);
 const [activeAction, setActiveAction] = useState<'approuver' | 'rejeter' | null>(null);

 // Safe array access
 const safeDocuments = documents ?? [];
 const isDocumentsLoading = !documents;
 const availableDocs = safeDocuments.filter(d => !control.evidenceIds?.includes(d.id));

 const handleConfirmUnlink = async () => {
 if (unlinkTarget) {
 await handleUnlinkDocument(control, unlinkTarget);
 setUnlinkTarget(null);
 }
 };

 const handleLinkWithLoading = async (docId: string) => {
 try {
 await handleLinkDocument(control, docId);
 } finally {
 // State removed
 }
 };

 const handleValidate = async (docId: string, action: 'approuver' | 'rejeter' = 'approuver') => {
 if (onValidateEvidence) {
 setValidatingDocId(docId);
 setActiveAction(action);
 try {
 await onValidateEvidence(docId, action);
 } finally {
 setValidatingDocId(null);
 setActiveAction(null);
 }
 }
 };

 if (isDocumentsLoading) {
 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
  <Skeleton className="h-6 w-48 mb-6" />
  <div className="space-y-3">
  <Skeleton className="h-16 rounded-3xl" />
  <Skeleton className="h-16 rounded-3xl" />
  </div>
 </div>
 </div>
 );
 }

 return (
 <div className="max-w-3xl mx-auto space-y-6">
 <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 shadow-sm">
 <div className="flex items-center justify-between mb-6">
  <h3 className="font-bold text-foreground">{t('compliance.documentaryEvidence', { defaultValue: 'Preuves documentaires' })}</h3>
  {canEdit && (
  <Button
  onClick={() => onUploadEvidence(control)}
  size="sm"
  className="text-xs font-bold shadow-sm"
  >
  <Upload className="h-3 w-3 mr-1.5" />
  {t('compliance.addEvidence', { defaultValue: 'Ajouter une preuve' })}
  </Button>
  )}
 </div>
 <div className="space-y-3">
  {control.evidenceIds?.map(docId => {
  const doc = safeDocuments.find(d => d.id === docId);
  if (!doc) return null;
  const isValidated = doc.status === 'Approuvé';
  const isRejected = doc.status === 'Rejeté';
  const isValidating = validatingDocId === docId;

  return (
  <div key={docId || 'unknown'} className="flex items-center p-3 bg-card border border-border/40 rounded-3xl hover:shadow-md transition-all">
  <div className={`p-2 rounded-lg mr-3 ${isValidated ? 'bg-success-bg text-success-text' : isRejected ? 'bg-error-bg text-error-text' : 'bg-info-bg text-info-text'}`}>
   {isValidated ? <ShieldCheck className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
  </div>
  <div className="flex-1 min-w-0">
   <div className="flex items-center gap-2">
   <h4 className="text-sm font-bold text-foreground truncate">{doc.title}</h4>
   {isValidated && (
   <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success-text border border-success-border/30">
   <Check className="h-3 w-3 mr-1" />
   {t('compliance.validated', { defaultValue: 'Validé' })}
   </span>
   )}
   {isRejected && (
   <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-error-bg text-error-text border border-error-border/30">
   <X className="h-3 w-3 mr-1" />
   {t('compliance.rejected', { defaultValue: 'Rejeté' })}
   </span>
   )}
   </div>
   <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)} • {doc.owner}</p>
  </div>
  <div className="flex gap-2 items-center">
   {!isValidated && !isRejected && onValidateEvidence && (
   <div className="flex items-center gap-1">
   <Button
   variant="ghost"
   size="sm"
   onClick={() => handleValidate(docId, 'approuver')}
   disabled={isValidating || updating}
   className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
   >
   {isValidating && activeAction === 'approuver' ? <Loader2 className="h-3 w-3 animate-spin" /> : t('compliance.validate', { defaultValue: 'Valider' })}
   </Button>
   <Button
   variant="ghost"
   size="sm"
   onClick={() => handleValidate(docId, 'rejeter')}
   disabled={isValidating || updating}
   className="text-xs font-bold text-error-text hover:text-error-text hover:bg-error-bg"
   >
   {isValidating && activeAction === 'rejeter' ? <Loader2 className="h-3 w-3 animate-spin" /> : t('compliance.reject', { defaultValue: 'Rejeter' })}
   </Button>
   </div>
   )}
   <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors">
   <ExternalLink className="h-4 w-4" />
   </a>
   {canEdit && (
   <Button variant="ghost" size="icon" aria-label={t('compliance.unlinkDocument', { defaultValue: 'Délier le document' })} onClick={() => setUnlinkTarget(docId)} disabled={updating} className="h-8 w-8 text-muted-foreground hover:text-error-text hover:bg-error-bg rounded-lg transition-colors">
   {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
   </Button>
   )}
  </div>
  </div>
  );
  })}
  {(!control.evidenceIds || control.evidenceIds.length === 0) && (
  <div className="flex flex-col items-center justify-center p-12 bg-muted/50 dark:bg-black/10 rounded-4xl border-2 border-dashed border-border/40">
  <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center shadow-sm mb-4">
  <FileText className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-sm font-bold text-foreground mb-1">{t('compliance.noEvidence', { defaultValue: 'Aucune preuve' })}</h3>
  <p className="text-xs text-muted-foreground text-center max-w-[200px] mb-6">
  {t('compliance.linkDocumentsForCompliance', { defaultValue: 'Liez des documents pour prouver la conformité.' })}
  </p>
  {canEdit && (
  <Button
   onClick={() => onUploadEvidence(control)}
   size="sm"
   variant="outline"
   className="text-xs font-bold"
  >
   <Upload className="h-3 w-3 mr-1.5" />
   {t('compliance.addEvidence', { defaultValue: 'Ajouter une preuve' })}
  </Button>
  )}
  </div>
  )}
 </div>

 {canEdit && (
  <div className="mt-6 pt-6 border-t border-border/40 dark:border-white/5">
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
  <FileText className="h-4 w-4 text-muted-foreground" />
  <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-widest">{t('compliance.addExistingEvidence', { defaultValue: 'Ajouter une preuve existante' })}</h4>
  </div>
  </div>

  <div className="pt-2">
  <CustomSelect
  label=""
  value=""
  onChange={(val) => handleLinkWithLoading(val as string)}
  options={availableDocs.map(d => ({ value: d.id, label: d.title }))}
  placeholder={t('compliance.selectDocument', { defaultValue: 'Sélectionner un document...' })}
  disabled={updating || availableDocs.length === 0}
  />
  </div>
  </div>
 )}
 </div>

 {/* Unlink Confirmation Dialog */}
 <ConfirmModal
 isOpen={!!unlinkTarget}
 onClose={() => setUnlinkTarget(null)}
 onConfirm={handleConfirmUnlink}
 title={t('compliance.unlinkEvidenceTitle', { defaultValue: 'Délier la preuve' })}
 message={t('compliance.unlinkEvidenceMessage', { defaultValue: 'Êtes-vous sûr de vouloir délier ce document ? Le document ne sera pas supprimé.' })}
 confirmText={t('compliance.unlinkConfirm', { defaultValue: 'Délier' })}
 cancelText={t('common.cancel', { defaultValue: 'Annuler' })}
 type="warning"
 />
 </div>
 );
};
