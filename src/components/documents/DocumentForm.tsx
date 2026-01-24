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
    onUploadComplete
}) => {
    const { addToast } = useStore();
    const [uploadedFileUrl, setUploadedFileUrl] = useState<string>(initialData?.url || '');
    const [uploadedFileHash, setUploadedFileHash] = useState<string>(initialData?.hash || '');
    const [uploadedFileSecure, setUploadedFileSecure] = useState<boolean>(initialData?.isSecure || false);

    const { register, handleSubmit, control, setValue, formState: { errors } } = useZodForm<typeof documentSchema>({
        schema: documentSchema,
        mode: 'onChange',
        shouldUnregister: true,
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

    const onInvalid = (errors: FieldErrors<DocumentFormData>) => {
        const missingFields = Object.keys(errors).join(', ');
        toast.error(`Formulaire invalide. Champs en erreur : ${missingFields}`);
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
        addToast(`Fichier ${fileName} téléversé avec succès`, 'success');
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
            addToast("Connexion réussie (Simulation)", 'success');
        } catch (e) {
            addToast("Configuration OAuth manquante ou annulée", 'error');
            ErrorLogger.error(e, "DocumentForm.handleConnectProvider");
        }
    }, [addToast]);

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
    };

    return (
        <form onSubmit={handleSubmit(onFormSubmit, onInvalid)} className="space-y-6">
            <input type="hidden" {...register('owner', { required: true })} />
            <div className="space-y-6">
                <FloatingLabelInput
                    label="Titre"
                    {...register('title')}
                    error={errors.title?.message}
                    placeholder="Ex: PSSI"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <CustomSelect
                        label="Dossier"
                        options={[{ value: '', label: 'Racine' }, ...folders.map(f => ({ value: f.id, label: f.name }))]}
                        value={folderId || ''}
                        onChange={(val) => setValue('folderId', typeof val === 'string' ? val : '')}
                        error={errors.folderId?.message}
                    />
                    <CustomSelect
                        label="Type"
                        options={['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre'].map(t => ({ value: t, label: t }))}
                        value={docType || 'Politique'}
                        onChange={(val) => setValue('type', (typeof val === 'string' ? val : 'Politique') as DocumentFormData['type'])}
                        error={errors.type?.message}
                    />
                    <FloatingLabelInput
                        label="Version"
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
                                label="Contenu (Éditeur Riche)"
                                value={field.value || ''}
                                onChange={field.onChange}
                                error={errors.content?.message}
                            />
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CustomSelect
                        label="Statut"
                        options={['Brouillon', 'En revue', 'Approuvé', 'Rejeté', 'Publié', 'Obsolète', 'Archivé'].map(s => ({ value: s, label: s }))}
                        value={status || 'Brouillon'}
                        onChange={(val) => setValue('status', (typeof val === 'string' ? val : 'Brouillon') as DocumentFormData['status'])}
                        error={errors.status?.message}
                    />
                    <CustomSelect
                        label="Propriétaire"
                        options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                        value={ownerId || ''}
                        onChange={(val) => setValue('ownerId', typeof val === 'string' ? val : '', { shouldDirty: true, shouldValidate: true })}
                        error={errors.ownerId?.message}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Controller
                        control={control}
                        name="reviewers"
                        render={({ field }) => (
                            <CustomSelect
                                label="Reviewers"
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
                                label="Approbateurs"
                                options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                multiple
                                error={errors.approvers?.message}
                            />
                        )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FloatingLabelInput
                        label="Prochaine révision"
                        type="date"
                        {...register('nextReviewDate')}
                        error={errors.nextReviewDate?.message}
                    />
                    <FloatingLabelInput
                        label="Date d'expiration"
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
                                label="Contrôles"
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
                                label="Actifs"
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
                                label="Audits"
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
                                label="Risques"
                                options={risks.map(r => ({ value: r.id, label: r.threat }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                multiple
                                error={errors.relatedRiskIds?.message}
                            />
                        )}
                    />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-4">Stockage du Document</label>
                    <div className="mb-6">
                        <CustomSelect
                            label="Fournisseur de stockage"
                            options={[
                                { value: 'firebase', label: 'Interne (Upload)' },
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
                                <div className="mt-2 flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <span className="text-xs text-green-700 dark:text-green-400 font-medium truncate flex-1">{uploadedFileUrl.split('/').pop()}</span>
                                    <div className="flex items-center gap-2">
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input checked={uploadedFileSecure} onChange={e => setUploadedFileSecure(e.target.checked)}
                                                type="checkbox"
                                                className="rounded text-blue-600 focus-visible:ring-brand-500"
                                            />
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-muted-foreground">Sécurisé</span>
                                        </label>
                                        <button type="button" onClick={() => { setUploadedFileUrl(''); setUploadedFileHash(''); }} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <FloatingLabelInput
                                    label="URL Externe"
                                    {...register('externalUrl')}
                                    placeholder={storageProvider === 'google_drive' ? "Lien Google Drive..." : "Lien SharePoint/OneDrive..."}
                                    className="flex-1"
                                    error={errors.externalUrl?.message}
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleBrowseProvider}
                                >
                                    Parcourir
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                {storageProvider === 'google_drive' ? 'Le document restera hébergé sur Google Drive.' : 'Le document restera hébergé sur Microsoft 365.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-slate-100 dark:border-white/5">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Annuler
                </Button>
                <Button
                    type="submit"
                    isLoading={isLoading}
                    className="px-8 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl hover:scale-105 transition-transform shadow-lg shadow-brand-500/20 font-bold"
                >
                    {initialData ? 'Enregistrer' : 'Créer'}
                </Button>
            </div>
        </form>
    );
};
