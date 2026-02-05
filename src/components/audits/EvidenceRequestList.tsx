import React, { useState, useCallback } from 'react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { EvidenceRequest, UserProfile, Document, Control } from '../../types';
import { where, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useForm, SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useStore } from '../../store';
import { Plus, FileText, X } from '../ui/Icons';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { EmptyState } from '../ui/EmptyState';
import { ErrorLogger } from '../../services/errorLogger';
import { ConfirmModal } from '../ui/ConfirmModal';
import { sanitizeData } from '../../utils/dataSanitizer';
import { EvidenceRequestItem } from './EvidenceRequestItem';
import { exportEvidenceRequestsZip, checkEvidenceExportLimits } from '../../utils/EvidenceExportUtils';
import { usePlanLimits } from '../../hooks/usePlanLimits';

interface EvidenceRequestListProps {
 auditId: string;
 organizationId: string;
 users: UserProfile[];
 controls: Control[];
 canEdit: boolean;
}

export const EvidenceRequestList: React.FC<EvidenceRequestListProps> = ({ auditId, organizationId, users, controls, canEdit }) => {
 const { user, addToast, t } = useStore();
 const { hasFeature, planId } = usePlanLimits();
 const [isCreating, setIsCreating] = useState(false);
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

 const { data: requests, refresh, loading, add: addRequest, update: updateRequest, remove: removeRequest } = useFirestoreCollection<EvidenceRequest>(
 'evidence_requests',
 [where('organizationId', '==', organizationId), where('auditId', '==', auditId)],
 { logError: true, realtime: true }
 );

 const { data: documents, add: addDocument } = useFirestoreCollection<Document>(
 'documents',
 [where('organizationId', '==', organizationId)],
 { logError: true, realtime: true }
 );

 // Hook for updating controls without fetching
 const { update: updateControl } = useFirestoreCollection('controls', [], { enabled: false });

 const requestSchema = z.object({
 title: z.string().min(1, 'Title is required').max(100),
 description: z.string().min(1, 'Description is required'),
 assignedTo: z.string().optional(),
 dueDate: z.string().optional(),
 relatedControlId: z.string().optional()
 });

 type RequestFormData = z.infer<typeof requestSchema>;

 const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<RequestFormData>({
 resolver: zodResolver(requestSchema),
 defaultValues: {
 title: '',
 description: '',
 assignedTo: '',
 dueDate: '',
 relatedControlId: ''
 }
 });

 const onSubmit: SubmitHandler<RequestFormData> = async (data) => {
 if (!user) return;
 try {
 await addRequest(sanitizeData({
 auditId,
 organizationId,
 title: data.title,
 description: data.description,
 status: 'Pending',
 requestedBy: user.uid,
 assignedTo: data.assignedTo || null,
 dueDate: data.dueDate || null,
 relatedControlId: data.relatedControlId || null,
 documentIds: [],
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp()
 }));
 addToast(t('audits.evidence.requestCreated') || "Demande de preuve créée", "success");
 setIsCreating(false);
 reset();
 refresh();
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleCreate', 'CREATE_FAILED');
 }
 };

 const handleFileUpload = useCallback(async (req: EvidenceRequest, url: string, fileName: string) => {
 if (!user) return;
 try {
 // Create Document
 const docId = await addDocument(sanitizeData({
 title: `Preuve - ${fileName}`,
 type: 'Preuve',
 version: '1.0',
 status: 'Publié',
 url: url,
 organizationId,
 owner: user.displayName || user.email,
 ownerId: user.uid,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 relatedAuditIds: [auditId],
 relatedControlIds: req.relatedControlId ? [req.relatedControlId] : []
 }));

 // Link to Request
 const currentDocs = req.documentIds || [];

 await updateRequest(req.id, sanitizeData({
 documentIds: [...currentDocs, docId],
 status: 'Provided', // Auto-update status
 updatedAt: serverTimestamp()
 }));

 // Link to Control (if applicable)
 if (req.relatedControlId) {
 await updateControl(req.relatedControlId, {
  evidenceIds: arrayUnion(docId)
 });
 }

 refresh();
 addToast(t('audits.evidence.proofAdded', { defaultValue: "Preuve ajoutée et liée" }), "success");
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleFileUpload', 'FILE_UPLOAD_FAILED');
 }
 }, [user, organizationId, auditId, refresh, addToast, addDocument, updateRequest, updateControl, t]);

 const handleStatusChange = useCallback(async (req: EvidenceRequest, status: EvidenceRequest['status']) => {
 try {
 await updateRequest(req.id, sanitizeData({
 status,
 updatedAt: serverTimestamp()
 }));
 refresh();
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleStatusChange', 'UPDATE_FAILED');
 }
 }, [refresh, updateRequest]);

 const handleDeleteClick = useCallback((id: string) => {
 setConfirmDelete({ isOpen: true, id });
 }, []);

 const handleConfirmDelete = async () => {
 if (!confirmDelete.id) return;
 try {
 await removeRequest(confirmDelete.id);
 refresh();
 addToast(t('audits.evidence.requestDeleted', { defaultValue: "Demande supprimée" }), "info");
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleDelete', 'DELETE_FAILED');
 } finally {
 setConfirmDelete({ isOpen: false, id: null });
 }
 };

 const handleExpand = useCallback((id: string | null) => {
 setExpandedId(prev => prev === id ? null : id);
 }, []);

 const [assignedTo, relatedControlId] = useWatch({
 control,
 name: ['assignedTo', 'relatedControlId']
 });
 // Combine into an object if needed for cleaner code below, or just use variables
 const values = { assignedTo, relatedControlId };

 const handleExport = useCallback(() => {
 // Vérifier les limites du plan
 const limitCheck = checkEvidenceExportLimits(hasFeature, planId);
 
 // Afficher un message si le plan nécessite un upgrade
 if (limitCheck.willHaveWatermark) {
 addToast(limitCheck.message, 'info');
 }

 // Procéder à l'export avec les informations de plan
 exportEvidenceRequestsZip({
 auditId,
 requests,
 users,
 controls,
 documents,
 addWatermark: limitCheck.willHaveWatermark,
 planId,
 onSuccess: () => {
 const successMessage = limitCheck.willHaveWatermark
  ? t('audits.evidence.exportWithWatermark', { defaultValue: "Export ZIP téléchargé (avec filigrane Discovery)" })
  : t('audits.evidence.exportSuccess', { defaultValue: "Export ZIP téléchargé" });
 addToast(successMessage, 'success');
 },
 onError: (err) => {
 ErrorLogger.handleErrorWithToast(err, 'EvidenceRequestList.handleExport', 'UNKNOWN_ERROR');
 addToast(t('audits.evidence.exportError', { defaultValue: "Erreur lors de l'export" }), 'error');
 }
 });
 }, [auditId, requests, users, controls, documents, addToast, hasFeature, planId, t]);

 return (
 <div>
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
  <FileText className="h-5 w-5 text-primary" />
  {t('audits.evidence.title', { defaultValue: 'Demandes de preuves' })}
  <span className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
  {requests.length}
  </span>
 </h3>
 <div className="flex items-center gap-2">
  {requests.length > 0 && (
  <button
  onClick={handleExport}
  className="p-2 rounded-3xl bg-muted text-muted-foreground hover:bg-muted transition-colors"
  aria-label={t('audits.evidence.exportAriaLabel', { defaultValue: 'Exporter les preuves (ZIP)' })}
  title={t('audits.evidence.exportTitle', { defaultValue: 'Exporter les preuves (ZIP)' })}
  >
  <FileText className="h-5 w-5" />
  </button>
  )}
  {canEdit && (
  <button
  onClick={() => setIsCreating(!isCreating)}
  className={`p-2 rounded-3xl transition-colors ${isCreating
  ? 'bg-red-50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
  : 'bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary dark:text-primary/70'
  }`}
  aria-label={isCreating ? t('audits.evidence.cancelCreation', { defaultValue: 'Annuler la création' }) : t('audits.evidence.newRequest', { defaultValue: 'Nouvelle demande' })}
  >
  {isCreating ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
  </button>
  )}
 </div>
 </div>

 {
 isCreating && (
  <form onSubmit={handleSubmit(onSubmit)} className="bg-muted/50 dark:bg-white/5 p-6 rounded-2xl border border-border/40 space-y-4 animate-fade-in mb-6">
  <FloatingLabelInput
  label={t('audits.evidence.requestTitleLabel', { defaultValue: 'Titre de la demande' })}
  {...register('title')}
  error={errors.title?.message}
  />
  <FloatingLabelTextarea
  label={t('audits.evidence.descriptionLabel', { defaultValue: 'Description détaillée' })}
  {...register('description')}
  error={errors.description?.message}
  rows={3}
  />
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <CustomSelect
  label={t('audits.evidence.assignedTo', { defaultValue: 'Assigné à' })}
  value={values.assignedTo || ''}
  onChange={val => setValue('assignedTo', val as string)}
  options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
  placeholder={t('audits.evidence.selectResponsible', { defaultValue: 'Sélectionner un responsable...' })}
  />
  <FloatingLabelInput
  label={t('audits.evidence.dueDate', { defaultValue: "Date d'échéance" })}
  type="date"
  {...register('dueDate')}
  />
  </div>
  <CustomSelect
  label={t('audits.evidence.linkControl', { defaultValue: 'Lier à un contrôle (Optionnel)' })}
  value={values.relatedControlId || ''}
  onChange={val => setValue('relatedControlId', val as string)}
  options={controls.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
  placeholder={t('audits.evidence.selectControl', { defaultValue: 'Sélectionner un contrôle...' })}
  />
  <div className="flex justify-end pt-2">
  <button
  type="submit"
  disabled={isSubmitting}
  aria-label={t('audits.evidence.submitRequest', { defaultValue: 'Soumettre la demande' })}
  className="px-6 py-2 bg-primary text-primary-foreground rounded-3xl font-bold hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-slate-600"
  >
  {isSubmitting ? t('audits.evidence.creating', { defaultValue: 'Création...' }) : t('audits.evidence.createRequest', { defaultValue: 'Créer la demande' })}
  </button>
  </div>
  </form>
 )
 }

 <div className="space-y-4">
 {requests.length === 0 && !isCreating && !loading && (
  <EmptyState
  icon={FileText}
  title={t('audits.evidence.emptyTitle', { defaultValue: 'Aucune demande de preuve' })}
  description={t('audits.evidence.emptyDescription', { defaultValue: "Créez des demandes de preuves pour collecter les documents nécessaires à l'audit." })}
  actionLabel={canEdit ? t('audits.evidence.createRequestAction', { defaultValue: 'Créer une demande' }) : undefined}
  onAction={canEdit ? () => setIsCreating(true) : undefined}
  />
 )}
 {loading ? (
  // Skeletons
  [1, 2, 3].map(i => (
  <div key={`skeleton-${i || 'unknown'}`} className="h-24 bg-muted rounded-2xl animate-pulse" />
  ))
 ) : (
  requests.map(req => (
  <EvidenceRequestItem
  key={req.id || 'unknown'}
  req={req}
  user={user}
  users={users}
  documents={documents}
  isExpanded={expandedId === req.id}
  canEdit={canEdit}
  onExpand={handleExpand}
  onStatusChange={handleStatusChange}
  onDelete={handleDeleteClick}
  onUpload={handleFileUpload}
  />
  ))
 )}
 </div>

 <ConfirmModal
 isOpen={confirmDelete.isOpen}
 onClose={() => setConfirmDelete({ isOpen: false, id: null })}
 onConfirm={handleConfirmDelete}
 title={t('audits.evidence.deleteTitle', { defaultValue: 'Supprimer la demande' })}
 message={t('audits.evidence.deleteMessage', { defaultValue: 'Êtes-vous sûr de vouloir supprimer cette demande de preuve ? Cette action est irréversible.' })}
 confirmText={t('common.delete', { defaultValue: 'Supprimer' })}
 type="danger"
 />
 </div >
 );
};
