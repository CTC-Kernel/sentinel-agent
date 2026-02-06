import React, { useEffect, useState, useCallback } from 'react';
import { useWatch, Controller, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { documentSchema, DocumentFormData } from '../../schemas/documentSchema';
import { UserProfile, Control, Asset, Audit, Document, DocumentFolder, Risk } from '../../types';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { FileUploader } from '../ui/FileUploader';
import { Trash2 } from '../ui/Icons';
import { externalStorageService } from '../../services/externalStorageService';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';
import { RichTextEditor } from '../ui/RichTextEditor';
import { toast } from '@/lib/toast';
import { useLocale } from '../../hooks/useLocale';
import { useFormPersistence } from '../../hooks/utils/useFormPersistence';

interface DocumentFormProps {
 onSubmit: (data: DocumentFormData & { fileUrl?: string; fileHash?: string; isSecure?: boolean }) => Promise<void>;
 onCancel: () => void;
 initialData?: Document | null;
 users: UserProfile[];
 controls: Control[];
 assets: Asset[];
 audits: Audit[];
 risks: Risk[];
 folders: DocumentFolder[];
 isLoading?: boolean;
 isStorageFull?: boolean;
 onUploadComplete?: (size: number) => void;
 onDirtyChange?: (isDirty: boolean) => void;
}

export const DocumentForm: React.FC<DocumentFormProps> = ({
 onSubmit,
 onCancel,
 initialData,
 users,
 controls,
 assets,
 audits,
 risks,
 folders,
 isLoading = false,
 isStorageFull = false,
 onUploadComplete,
 onDirtyChange
}) => {
 const { addToast } = useStore();
 const { t } = useLocale();
 const [uploadedFileUrl, setUploadedFileUrl] = useState<string>(initialData?.url || '');
 const [uploadedFileHash, setUploadedFileHash] = useState<string>(initialData?.hash || '');
 const [uploadedFileSecure, setUploadedFileSecure] = useState<boolean>(initialData?.isSecure || false);

 const { register, handleSubmit, control, setValue, watch, reset, formState: { errors, isDirty, isSubmitting } } = useZodForm<typeof documentSchema>({
 schema: documentSchema,
 mode: 'onChange',
 shouldUnregister: false,
 defaultValues: {
 title: initialData?.title || '',
 type: initialData?.type || 'Politique',
 version: initialData?.version || '1.0',
 status: initialData?.status || 'Brouillon',
 workflowStatus: initialData?.workflowStatus || 'Draft',
 owner: initialData?.owner || '',
 ownerId: initialData?.ownerId || '',
 nextReviewDate: initialData?.nextReviewDate || '',
 expirationDate: initialData?.expirationDate || '',
 readBy: initialData?.readBy || [],
 reviewers: initialData?.reviewers || [],
 approvers: initialData?.approvers || [],
 relatedControlIds: initialData?.relatedControlIds || [],
 relatedAssetIds: initialData?.relatedAssetIds || [],

 relatedAuditIds: initialData?.relatedAuditIds || [],
 relatedRiskIds: initialData?.relatedRiskIds || [],
 storageProvider: initialData?.storageProvider || 'firebase',
 externalUrl: initialData?.externalUrl || '',
 folderId: initialData?.folderId || ''
 }
 });

 useEffect(() => {
 onDirtyChange?.(isDirty);
 }, [isDirty, onDirtyChange]);

 // Persistence Hook
 const { clearDraft } = useFormPersistence<DocumentFormData>('sentinel_document_draft_new', {
 watch,
 reset
 }, {
 enabled: !initialData
 });

 const onInvalid = (errors: FieldErrors<DocumentFormData>) => {
 const missingFields = Object.keys(errors).join(', ');
 toast.error(t('documents.form.invalid', { defaultValue: 'Formulaire invalide' }) + `. ${t('documents.form.fieldsInError', { defaultValue: 'Champs en erreur' })} : ${missingFields}`);
 };

 const folderId = useWatch({ control, name: 'folderId' });
 const docType = useWatch({ control, name: 'type' });
 const status = useWatch({ control, name: 'status' });

 const ownerId = useWatch({ control, name: 'ownerId' });
 const storageProvider = useWatch({ control, name: 'storageProvider' });

 useEffect(() => {
 if (!ownerId) {
 setValue('owner', '', { shouldDirty: true, shouldValidate: true });
 return;
 }
 const matchedOwner = users.find(u => u.uid === ownerId);
 setValue('owner', matchedOwner ? (matchedOwner.displayName || matchedOwner.email || '') : '', {
 shouldDirty: true,
 shouldValidate: true
 });
 }, [ownerId, users, setValue]);

 const handleFileUploadComplete = async (url: string, fileName: string, hash?: string, isSecure?: boolean, size?: number) => {
 setUploadedFileUrl(url);
 setUploadedFileHash(hash || '');
 setUploadedFileSecure(isSecure || false);
 addToast(t('documents.form.fileUploadSuccess', { defaultValue: `Fichier ${fileName} téléversé avec succès`, fileName }), 'success');
 if (size && onUploadComplete) {
 onUploadComplete(size);
 }
 };

 const handleConnectProvider = useCallback(async (provider: 'google_drive' | 'onedrive' | 'sharepoint') => {
 try {
 if (provider === 'google_drive') {
 await externalStorageService.connectGoogleDrive();
 } else if (provider === 'onedrive' || provider === 'sharepoint') {
 await externalStorageService.connectOneDrive();
 }
 addToast(t('documents.toast.connectionSuccess', { defaultValue: "Connexion réussie (Simulation)" }), 'success');
 } catch (e) {
 addToast(t('documents.toast.oauthError', { defaultValue: "Configuration OAuth manquante ou annulée" }), 'error');
 ErrorLogger.error(e, "DocumentForm.handleConnectProvider");
 }
 }, [addToast, t]);

 const handleBrowseProvider = useCallback(() => {
 if (storageProvider === 'google_drive' || storageProvider === 'onedrive' || storageProvider === 'sharepoint') {
 void handleConnectProvider(storageProvider);
 }
 }, [storageProvider, handleConnectProvider]);

 const onFormSubmit = async (data: DocumentFormData) => {
 await onSubmit({
 ...data,
 fileUrl: uploadedFileUrl,
 fileHash: uploadedFileHash,
 isSecure: uploadedFileSecure
 });
 clearDraft();
 };

 return (
 <form onSubmit={handleSubmit(onFormSubmit, onInvalid)} className="space-y-6">
 <input type="hidden" {...register('owner', { required: true })} />
 <div className="space-y-6">
 <FloatingLabelInput
  label={t('documents.form.title', { defaultValue: 'Titre' })}
  {...register('title')}
  error={errors.title?.message}
  placeholder={t('documents.form.titlePlaceholder', { defaultValue: 'Ex: PSSI' })}
 />

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <CustomSelect
  label={t('documents.form.folder', { defaultValue: 'Dossier' })}
  options={[{ value: '', label: 'Racine' }, ...folders.map(f => ({ value: f.id, label: f.name }))]}
  value={folderId || ''}
  onChange={(val) => setValue('folderId', typeof val === 'string' ? val : '')}
  error={errors.folderId?.message}
  />
  <CustomSelect
  label={t('documents.form.type', { defaultValue: 'Type' })}
  options={[
  { value: 'Politique', label: t('documents.form.types.policy', { defaultValue: 'Politique' }) },
  { value: 'Procédure', label: t('documents.form.types.procedure', { defaultValue: 'Procédure' }) },
  { value: 'Preuve', label: t('documents.form.types.evidence', { defaultValue: 'Preuve' }) },
  { value: 'Rapport', label: t('documents.form.types.report', { defaultValue: 'Rapport' }) },
  { value: 'Autre', label: t('documents.form.types.other', { defaultValue: 'Autre' }) },
  ]}
  value={docType || 'Politique'}
  onChange={(val) => setValue('type', (typeof val === 'string' ? val : 'Politique') as DocumentFormData['type'])}
  error={errors.type?.message}
  />
  <FloatingLabelInput
  label={t('documents.form.version', { defaultValue: 'Version' })}
  {...register('version')}
  error={errors.version?.message}
  />
 </div>

 <div className="space-y-2">
  <Controller
  control={control}
  name="content"
  render={({ field }) => (
  <RichTextEditor
  label={t('documents.form.content', { defaultValue: 'Contenu (Éditeur Riche)' })}
  value={field.value || ''}
  onChange={field.onChange}
  error={errors.content?.message}
  />
  )}
  />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <CustomSelect
  label={t('documents.form.status', { defaultValue: 'Statut' })}
  options={['Brouillon', 'En revue', 'Approuvé', 'Rejeté', 'Publié', 'Obsolète', 'Archivé'].map(s => ({ value: s, label: s }))}
  value={status || 'Brouillon'}
  onChange={(val) => setValue('status', (typeof val === 'string' ? val : 'Brouillon') as DocumentFormData['status'])}
  error={errors.status?.message}
  />
  <CustomSelect
  label={t('documents.form.owner', { defaultValue: 'Propriétaire' })}
  options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
  value={ownerId || ''}
  onChange={(val) => setValue('ownerId', typeof val === 'string' ? val : '', { shouldDirty: true, shouldValidate: true })}
  error={errors.ownerId?.message}
  />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <Controller
  control={control}
  name="reviewers"
  render={({ field }) => (
  <CustomSelect
  label={t('documents.form.reviewers', { defaultValue: 'Reviewers' })}
  options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
  value={field.value || []}
  onChange={field.onChange}
  multiple
  error={errors.reviewers?.message}
  />
  )}
  />
  <Controller
  control={control}
  name="approvers"
  render={({ field }) => (
  <CustomSelect
  label={t('documents.form.approvers', { defaultValue: 'Approbateurs' })}
  options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
  value={field.value || []}
  onChange={field.onChange}
  multiple
  error={errors.approvers?.message}
  />
  )}
  />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <FloatingLabelInput
  label={t('documents.form.nextReviewDate', { defaultValue: 'Prochaine révision' })}
  type="date"
  {...register('nextReviewDate')}
  error={errors.nextReviewDate?.message}
  />
  <FloatingLabelInput
  label={t('documents.form.expirationDate', { defaultValue: 'Date d\'expiration' })}
  type="date"
  {...register('expirationDate')}
  error={errors.expirationDate?.message}
  />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <Controller
  control={control}
  name="relatedControlIds"
  render={({ field }) => (
  <CustomSelect
  label={t('documents.form.controls', { defaultValue: 'Contrôles' })}
  options={controls.map(c => ({ value: c.id, label: `${c.code} ${c.name.substring(0, 20)}...` }))}
  value={field.value || []}
  onChange={field.onChange}
  multiple
  error={errors.relatedControlIds?.message}
  />
  )}
  />
  <Controller
  control={control}
  name="relatedAssetIds"
  render={({ field }) => (
  <CustomSelect
  label={t('documents.form.assets', { defaultValue: 'Actifs' })}
  options={assets.map(a => ({ value: a.id, label: a.name }))}
  value={field.value || []}
  onChange={field.onChange}
  multiple
  error={errors.relatedAssetIds?.message}
  />
  )}
  />
  <Controller
  control={control}
  name="relatedAuditIds"
  render={({ field }) => (
  <CustomSelect
  label={t('documents.form.audits', { defaultValue: 'Audits' })}
  options={audits.map(a => ({ value: a.id, label: a.name }))}
  value={field.value || []}
  onChange={field.onChange}
  multiple
  error={errors.relatedAuditIds?.message}
  />
  )}
  />
  <Controller
  control={control}
  name="relatedRiskIds"
  render={({ field }) => (
  <CustomSelect
  label={t('documents.form.risks', { defaultValue: 'Risques' })}
  options={risks.map(r => ({ value: r.id, label: r.threat }))}
  value={field.value || []}
  onChange={field.onChange}
  multiple
  error={errors.relatedRiskIds?.message}
  />
  )}
  />
 </div>

 <div className="pt-4 border-t border-border">
  <div className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">{t('documents.form.storageSection', { defaultValue: 'Stockage du Document' })}</div>
  <div className="mb-6">
  <CustomSelect
  label={t('documents.form.storageProvider', { defaultValue: 'Fournisseur de stockage' })}
  options={[
  { value: 'firebase', label: t('documents.form.storageInternal', { defaultValue: 'Interne (Upload)' }) },
  { value: 'google_drive', label: 'Google Drive' },
  { value: 'onedrive', label: 'OneDrive' },
  { value: 'sharepoint', label: 'SharePoint' }
  ]}
  value={storageProvider || 'firebase'}
  onChange={(val) => {
  if (typeof val !== 'string') return;
  if (val === 'firebase' || val === 'google_drive' || val === 'onedrive' || val === 'sharepoint') {
   setValue('storageProvider', val);
  }
  }}
  error={errors.storageProvider?.message}
  />
  </div>

  {storageProvider === 'firebase' ? (
  <div>
  <FileUploader
  onUploadComplete={handleFileUploadComplete}
  category="documents"
  maxSizeMB={10}
  allowedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*']}
  disabled={isStorageFull}
  disabledMessage="Espace de stockage plein (1GB max)"
  />
  {uploadedFileUrl && (
  <div className="mt-2 flex items-center justify-between p-2 bg-success/10 rounded-lg">
   <span className="text-xs text-success font-medium truncate flex-1">{uploadedFileUrl.split('/').pop()}</span>
   <div className="flex items-center gap-2">
   <label className="flex items-center gap-1 cursor-pointer">
   <input checked={uploadedFileSecure} onChange={e => setUploadedFileSecure(e.target.checked)}
   type="checkbox"
   className="rounded text-primary focus-visible:ring-primary"
   />
   <span className="text-xs font-bold text-muted-foreground">{t('documents.form.secure', { defaultValue: 'Sécurisé' })}</span>
   </label>
   <button type="button" onClick={() => { setUploadedFileUrl(''); setUploadedFileHash(''); }} className="text-destructive hover:text-destructive/80"><Trash2 className="h-4 w-4" /></button>
   </div>
  </div>
  )}
  </div>
  ) : (
  <div className="space-y-3">
  <div className="flex gap-2">
  <FloatingLabelInput
   label={t('documents.form.externalUrl', { defaultValue: 'URL Externe' })}
   {...register('externalUrl')}
   placeholder={storageProvider === 'google_drive' ? t('documents.form.googleDrivePlaceholder', { defaultValue: 'Lien Google Drive...' }) : t('documents.form.sharePointPlaceholder', { defaultValue: 'Lien SharePoint/OneDrive...' })}
   className="flex-1"
   error={errors.externalUrl?.message}
  />
  <Button
   type="button"
   variant="secondary"
   onClick={handleBrowseProvider}
  >
   {t('documents.form.browse', { defaultValue: 'Parcourir' })}
  </Button>
  </div>
  <p className="text-xs text-muted-foreground">
  {storageProvider === 'google_drive' ? t('documents.form.hostedOnGoogleDrive', { defaultValue: 'Le document restera hébergé sur Google Drive.' }) : t('documents.form.hostedOnMicrosoft', { defaultValue: 'Le document restera hébergé sur Microsoft 365.' })}
  </p>
  </div>
  )}
 </div>
 </div>

 <div className="flex justify-end space-x-4 pt-6 border-t border-border">
 <Button type="button" variant="ghost" onClick={onCancel}>
  {t('common.cancel', { defaultValue: 'Annuler' })}
 </Button>
 <Button
  type="submit"
  isLoading={isLoading || isSubmitting}
  disabled={isLoading || isSubmitting}
  className="px-8 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-3xl hover:scale-105 transition-transform shadow-lg shadow-primary/20 font-bold"
 >
  {initialData ? t('common.save', { defaultValue: 'Enregistrer' }) : t('common.create', { defaultValue: 'Créer' })}
 </Button>
 </div>
 </form>
 );
};
