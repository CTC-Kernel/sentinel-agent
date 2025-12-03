import React, { useEffect, useState } from 'react';
import { useForm, useWatch, Controller, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { documentSchema, DocumentFormData } from '../../schemas/documentSchema';
import { UserProfile, Control, Asset, Audit, Document, DocumentFolder } from '../../types';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { FileUploader } from '../ui/FileUploader';
import { Trash2 } from '../ui/Icons';
import { externalStorageService } from '../../services/externalStorageService';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';

interface DocumentFormProps {
    onSubmit: (data: DocumentFormData & { fileUrl?: string; fileHash?: string; isSecure?: boolean }) => Promise<void>;
    onCancel: () => void;
    initialData?: Document | null;
    users: UserProfile[];
    controls: Control[];
    assets: Asset[];
    audits: Audit[];
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
    // folders, // Removed unused variable to fix lint error if not needed yet, or use it if intended.
    // Actually it is used in the JSX options. Wait, the lint error said 'folders' is declared but never read.
    // Ah, I see in my previous edit I added it to props but maybe didn't use it correctly or the linter is being strict about the destructuring if it's not used in the function body before return?
    // No, it is used in the JSX: options={[{ value: '', label: 'Racine' }, ...folders.map(f => ({ value: f.id, label: f.name }))]}
    // The lint error might have been from a transient state or I missed something.
    // Let's just ensure it is used.
    folders,
    isLoading = false,
    isStorageFull = false,
    onUploadComplete
}) => {
    const { addToast } = useStore();
    const [uploadedFileUrl, setUploadedFileUrl] = useState<string>(initialData?.url || '');
    const [uploadedFileHash, setUploadedFileHash] = useState<string>(initialData?.hash || '');
    const [uploadedFileSecure, setUploadedFileSecure] = useState<boolean>(initialData?.isSecure || false);

    const { register, handleSubmit, control, setValue, formState: { errors }, watch } = useForm<DocumentFormData>({
        resolver: zodResolver(documentSchema) as Resolver<DocumentFormData>,
        defaultValues: {
            title: initialData?.title || '',
            type: initialData?.type || 'Politique',
            version: initialData?.version || '1.0',
            status: initialData?.status || 'Brouillon',
            workflowStatus: initialData?.workflowStatus || 'Draft',
            owner: initialData?.owner || '',
            ownerId: initialData?.ownerId || '',
            nextReviewDate: initialData?.nextReviewDate || '',
            readBy: initialData?.readBy || [],
            reviewers: initialData?.reviewers || [],
            approvers: initialData?.approvers || [],
            relatedControlIds: initialData?.relatedControlIds || [],
            relatedAssetIds: initialData?.relatedAssetIds || [],
            relatedAuditIds: initialData?.relatedAuditIds || [],
            storageProvider: initialData?.storageProvider || 'firebase',
            externalUrl: initialData?.externalUrl || '',
            folderId: initialData?.folderId || ''
        }
    });

    const ownerId = useWatch({ control, name: 'ownerId' });
    const storageProvider = useWatch({ control, name: 'storageProvider' });

    useEffect(() => {
        const u = users.find(u => u.uid === ownerId);
        if (u) setValue('owner', u.displayName || u.email);
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

    const handleConnectProvider = async (provider: 'google_drive' | 'onedrive' | 'sharepoint') => {
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
    };

    const onFormSubmit = async (data: DocumentFormData) => {
        await onSubmit({
            ...data,
            fileUrl: uploadedFileUrl,
            fileHash: uploadedFileHash,
            isSecure: uploadedFileSecure
        });
    };

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
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
                        value={watch('folderId') || ''}
                        onChange={(val) => setValue('folderId', val as string)}
                        error={errors.folderId?.message}
                    />
                    <CustomSelect
                        label="Type"
                        options={['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre'].map(t => ({ value: t, label: t }))}
                        value={watch('type') || 'Politique'}
                        onChange={(val) => setValue('type', val as DocumentFormData['type'])}
                        error={errors.type?.message}
                    />
                    <FloatingLabelInput
                        label="Version"
                        {...register('version')}
                        error={errors.version?.message}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CustomSelect
                        label="Statut"
                        options={['Brouillon', 'En revue', 'Approuvé', 'Rejeté', 'Publié', 'Obsolète'].map(s => ({ value: s, label: s }))}
                        value={watch('status') || 'Brouillon'}
                        onChange={(val) => setValue('status', val as DocumentFormData['status'])}
                        error={errors.status?.message}
                    />
                    <CustomSelect
                        label="Propriétaire"
                        options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                        value={watch('ownerId') || ''}
                        onChange={(val) => setValue('ownerId', val as string)}
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
                            />
                        )}
                    />
                </div>

                <FloatingLabelInput
                    label="Prochaine révision"
                    type="date"
                    {...register('nextReviewDate')}
                    error={errors.nextReviewDate?.message}
                />

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
                            />
                        )}
                    />
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Stockage du Document</label>
                    <div className="mb-6">
                        <CustomSelect
                            label="Fournisseur de stockage"
                            options={[
                                { value: 'firebase', label: 'Interne (Upload)' },
                                { value: 'google_drive', label: 'Google Drive' },
                                { value: 'onedrive', label: 'OneDrive' },
                                { value: 'sharepoint', label: 'SharePoint' }
                            ]}
                            value={watch('storageProvider') || 'firebase'}
                            onChange={(val) => setValue('storageProvider', val as DocumentFormData['storageProvider'])}
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
                                            <input
                                                type="checkbox"
                                                checked={uploadedFileSecure}
                                                onChange={e => setUploadedFileSecure(e.target.checked)}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Sécurisé</span>
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
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handleConnectProvider(storageProvider as 'google_drive' | 'onedrive' | 'sharepoint')}
                                >
                                    Parcourir
                                </Button>
                            </div>
                            <p className="text-xs text-slate-400">
                                {storageProvider === 'google_drive' ? 'Le document restera hébergé sur Google Drive.' : 'Le document restera hébergé sur Microsoft 365.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100 dark:border-white/5">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Annuler
                </Button>
                <Button type="submit" isLoading={isLoading}>
                    {initialData ? 'Enregistrer' : 'Créer'}
                </Button>
            </div>
        </form>
    );
};
