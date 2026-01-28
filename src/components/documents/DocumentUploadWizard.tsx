import React, { useState, useEffect } from 'react';
import { useWatch, Controller, SubmitHandler } from 'react-hook-form'; // Added SubmitHandler
import type { FieldPath } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { documentSchema, DocumentFormData } from '../../schemas/documentSchema';
import { UserProfile, Control, Asset, DocumentFolder, Risk } from '../../types'; // Removed Audit
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { FileUploader } from '../ui/FileUploader';
import { RichTextEditor } from '../ui/RichTextEditor';
import { Trash2, FileText, CheckCircle2, ChevronRight, UploadCloud, Shield, Users, Link } from '../ui/Icons'; // Removed ChevronLeft
import { useStore } from '../../store';
import { motion } from 'framer-motion'; // Removed AnimatePresence
// If cn doesn't exist, I'll just use template literals. I'll assume it exists or use simple string concat.
// Checking imports in other files... they use className strings. I'll stick to that.

interface DocumentUploadWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: DocumentFormData & { fileUrl?: string; fileHash?: string; isSecure?: boolean }) => Promise<void>;
    users: UserProfile[];
    controls: Control[];
    assets: Asset[];
    risks: Risk[];
    folders: DocumentFolder[];
    isLoading?: boolean;
    initialFile?: File; // If dropped from parent
    isStorageFull?: boolean;
}

const STEPS = [
    { id: 'file', title: 'Fichier', icon: UploadCloud },
    { id: 'info', title: 'Informations', icon: FileText },
    { id: 'relations', title: 'Relations', icon: Link },
    { id: 'lifecycle', title: 'Cycle de vie', icon: Users },
    { id: 'review', title: 'Validation', icon: CheckCircle2 }
] as const;

export const DocumentUploadWizard: React.FC<DocumentUploadWizardProps> = ({
    isOpen,
    onClose,
    onSubmit,
    users,
    controls,
    assets,
    risks,
    folders,
    isLoading = false,
    initialFile,
    isStorageFull = false
}) => {
    const { addToast } = useStore();
    const [currentStep, setCurrentStep] = useState(0);
    const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
    const [uploadedFileHash, setUploadedFileHash] = useState<string>('');
    const [uploadedFileSecure, setUploadedFileSecure] = useState<boolean>(false);
    const [fileName, setFileName] = useState<string>('');

    const { register, handleSubmit, control, setValue, getValues, trigger, formState: { errors } } = useZodForm({
        schema: documentSchema,
        mode: 'onChange',
        defaultValues: {
            title: '',
            type: 'Politique',
            version: '1.0',
            status: 'Brouillon',
            workflowStatus: 'Draft',
            owner: '',
            ownerId: '',
            nextReviewDate: '',
            readBy: [],
            reviewers: [],
            approvers: [],
            relatedControlIds: [],
            relatedAssetIds: [],
            relatedAuditIds: [],
            relatedRiskIds: [],
            storageProvider: 'firebase',
            externalUrl: '',
            folderId: ''
        }
    });

    const storageProvider = useWatch({ control, name: 'storageProvider' });
    const ownerId = useWatch({ control, name: 'ownerId' });
    const folderId = useWatch({ control, name: 'folderId' });
    const docType = useWatch({ control, name: 'type' });
    const status = useWatch({ control, name: 'status' });

    // Handle initial file drop
    useEffect(() => {
        if (initialFile && isOpen) {
            // We simulate the upload completion if we had a real uploader that accepted a File object directly and returned immediate URL/Hash
            // But FileUploader component handles the upload process.
            // For now, we might need to pass this file to the FileUploader if it supports it, 
            // OR we just use it to pre-fill the name and switch to 'file' step to let user confirm/upload.
            // Since FileUploader usually takes a drop, we might need to refactor it to accept a file prop to start uploading immediately.
            // For this implementation, I will assume the user has to drop it in the uploader OR I'll modify FileUploader later.
            // Let's assume for now we start at step 0.
            if (initialFile.name) {
                // Clean file name
                setValue('title', initialFile.name.split('.').slice(0, -1).join('.'));
            }
        }
    }, [initialFile, isOpen, setValue]);

    // Auto-set owner name
    useEffect(() => {
        if (!ownerId) {
            setValue('owner', '', { shouldDirty: true, shouldValidate: true });
            return;
        }
        const u = users.find(u => u.uid === ownerId);
        setValue('owner', u ? (u.displayName || u.email || '') : '', { shouldDirty: true, shouldValidate: true });
    }, [ownerId, users, setValue]);

    const handleFileUploadComplete = (url: string, fName: string, hash?: string, isSecure?: boolean) => {
        setUploadedFileUrl(url);
        setFileName(fName);
        setUploadedFileHash(hash || '');
        setUploadedFileSecure(isSecure || false);
        if (!getValues('title')) {
            setValue('title', fName.split('.').slice(0, -1).join('.'));
        }
    };

    const nextStep = async () => {
        let valid = false;
        if (currentStep === 0) {
            // Validate file step
            if (storageProvider === 'firebase') {
                if (uploadedFileUrl) valid = true;
                else if (initialFile && !uploadedFileUrl) {
                    // This creates a UX edge case where file is selected but not uploaded yet.
                    // User must wait for upload. FileUploader handles upload automatically on select/drop?
                    // Yes, FileUploader starts upload on selection.
                    addToast("Veuillez attendre la fin du téléversement", "info");
                    valid = false;
                }
                else addToast("Veuillez téléverser un fichier", "error");
            } else {
                if (await trigger('externalUrl')) valid = true;
            }
        } else if (currentStep === 1) {
            // Validate info
            const fields: FieldPath<DocumentFormData>[] = ['title', 'type', 'version', 'status', 'folderId'];
            if (await trigger(fields)) valid = true;
        } else if (currentStep === 2) {
            valid = true; // Relations are optional
        } else if (currentStep === 3) {
            // Validate lifecycle
            const fields: FieldPath<DocumentFormData>[] = ['ownerId', 'nextReviewDate'];
            if (await trigger(fields)) valid = true;
        }

        if (valid) setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    // Fix SubmitHandler type
    const handleFinalSubmit: SubmitHandler<DocumentFormData> = async (data) => {
        await onSubmit({
            ...data,
            fileUrl: uploadedFileUrl,
            fileHash: uploadedFileHash,
            isSecure: uploadedFileSecure
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                role="button"
                tabIndex={0}
                aria-label="Fermer"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        onClose();
                    }
                }}
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-4xl glass-premium rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border/40"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                {/* Header */}
                <div className="px-8 py-6 border-b border-border/40 glass-premium backdrop-blur-md relative z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Nouveau Document</h2>
                        <p className="text-sm text-slate-500 dark:text-muted-foreground mt-1">Assistant d'importation et de classification</p>
                    </div>
                    {/* Progress Steps */}
                    <div className="hidden md:flex items-center gap-2">
                        {STEPS.map((step, idx) => (
                            <div key={step.id} className="flex items-center">
                                <div className={`
                                    flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
                                    ${idx === currentStep ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20 scale-110' :
                                        idx < currentStep ? 'bg-success-500 text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}
                                `}>
                                    {idx < currentStep ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className={`w-8 h-0.5 mx-2 rounded-full transition-colors ${idx < currentStep ? 'bg-success-500' : 'bg-slate-100 dark:bg-white/10'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
                    <form id="wizard-form" onSubmit={handleSubmit(handleFinalSubmit)}>
                        <input type="hidden" {...register('owner', { required: true })} />

                        {/* Step 1: File */}
                        {currentStep === 0 && (
                            <div className="space-y-6 animate-fade-in-right">
                                <div className="text-center mb-8">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Téléchargement du fichier</h3>
                                    <p className="text-sm text-slate-500">Choisissez la source de votre document</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <button
                                        type="button"
                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all w-full text-left ${storageProvider === 'firebase' ? 'border-brand-500 bg-brand-50 dark:bg-brand-800' : 'border-slate-200 dark:border-white/10 hover:border-brand-200'}`}
                                        onClick={() => setValue('storageProvider', 'firebase')}
                                    >
                                        <UploadCloud className={`w-6 h-6 mb-2 ${storageProvider === 'firebase' ? 'text-brand-600' : 'text-slate-400'}`} />
                                        <div className="font-bold text-sm">Upload Direct</div>
                                    </button>
                                    <button
                                        type="button"
                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all w-full text-left ${storageProvider !== 'firebase' ? 'border-brand-500 bg-brand-50 dark:bg-brand-800' : 'border-slate-200 dark:border-white/10 hover:border-brand-200'}`}
                                        onClick={() => setValue('storageProvider', 'google_drive')} // Defaulting to one external
                                    >
                                        <Link className={`w-6 h-6 mb-2 ${storageProvider !== 'firebase' ? 'text-brand-600' : 'text-slate-400'}`} />
                                        <div className="font-bold text-sm">Lien Externe</div>
                                    </button>
                                </div>

                                {storageProvider === 'firebase' ? (
                                    <div>
                                        <FileUploader
                                            onUploadComplete={handleFileUploadComplete}
                                            category="documents"
                                            maxSizeMB={25}
                                            allowedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']}
                                            disabled={isStorageFull}
                                            initialFile={initialFile}
                                        />
                                        {uploadedFileUrl && (
                                            <div className="mt-4 flex items-center justify-between p-3 bg-success-50 dark:bg-success-900/20 rounded-xl border border-success-100 dark:border-success-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-success-100 dark:bg-success-900/40 rounded-lg text-success-600">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-success-900 dark:text-success-100">{fileName || 'Fichier téléversé'}</p>
                                                        <p className="text-xs text-success-600 dark:text-success-400 break-all">{uploadedFileUrl.split('/').pop()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                                        <input checked={uploadedFileSecure} onChange={e => setUploadedFileSecure(e.target.checked)}
                                                            type="checkbox"
                                                            className="rounded text-brand-600 focus-visible:ring-brand-500"
                                                        />
                                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                            <Shield className="w-3 h-3" /> Sécurisé
                                                        </span>
                                                    </label>
                                                    <button type="button" onClick={() => { setUploadedFileUrl(''); setFileName(''); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500 rounded-lg transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <CustomSelect
                                            label="Fournisseur"
                                            options={[
                                                { value: 'google_drive', label: 'Google Drive' },
                                                { value: 'onedrive', label: 'OneDrive / SharePoint' },
                                                { value: 'sharepoint', label: 'SharePoint' }
                                            ]}
                                            value={storageProvider}
                                            onChange={(val) => {
                                                if (typeof val !== 'string') return;
                                                if (val === 'firebase' || val === 'google_drive' || val === 'onedrive' || val === 'sharepoint') {
                                                    setValue('storageProvider', val);
                                                }
                                            }}
                                        />
                                        <FloatingLabelInput
                                            label="URL du document"
                                            {...register('externalUrl')}
                                            placeholder="https://..."
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 2: Info */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-fade-in-right">
                                <div className="text-center mb-8">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Informations Générales</h3>
                                    <p className="text-sm text-slate-500">Détails et classification</p>
                                </div>
                                <FloatingLabelInput
                                    label="Titre du document"
                                    {...register('title')}
                                    error={errors.title?.message}
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    <CustomSelect
                                        label="Dossier"
                                        options={[{ value: '', label: 'Racine' }, ...folders.map(f => ({ value: f.id, label: f.name }))]}
                                        value={folderId || ''}
                                        onChange={(val) => setValue('folderId', typeof val === 'string' ? val : '')}
                                        error={errors.folderId?.message}
                                    />
                                    <CustomSelect
                                        label="Type"
                                        options={['Politique', 'Procédure', 'Preuve', 'Rapport', 'Contrat', 'Autre'].map(t => ({ value: t, label: t }))}
                                        value={docType || 'Politique'}
                                        onChange={(val) => setValue('type', (typeof val === 'string' ? val : 'Politique') as DocumentFormData['type'])}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    <FloatingLabelInput
                                        label="Version"
                                        {...register('version')}
                                        error={errors.version?.message}
                                    />
                                    <div className="space-y-1">
                                        <label htmlFor="status" className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 ml-1">Statut</label>
                                        <div className="flex p-1 bg-slate-100 dark:bg-black/20 rounded-xl" role="radiogroup" aria-labelledby="status">
                                            {['Brouillon', 'Publié'].map((s) => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    id={`status-${s}`}
                                                    onClick={() => setValue('status', s as DocumentFormData['status'])}
                                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${status === s ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600' : 'text-muted-foreground hover:text-foreground'}`}
                                                    role="radio"
                                                    aria-checked={status === s}
                                                    aria-label={`Statut: ${s}`}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="description" className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300 ml-1">Description / Résumé</label>
                                    <Controller
                                        control={control}
                                        name="content"
                                        render={({ field }) => (
                                            <RichTextEditor
                                                label=""
                                                value={field.value || ''}
                                                onChange={field.onChange}
                                                className="min-h-[150px]"
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 3: Relations */}
                        {currentStep === 2 && (
                            <div className="space-y-6 animate-fade-in-right">
                                <div className="text-center mb-8">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Relations & Contexte</h3>
                                    <p className="text-sm text-slate-500">Liez ce document aux éléments du GRC</p>
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    <Controller
                                        control={control}
                                        name="relatedControlIds"
                                        render={({ field }) => (
                                            <CustomSelect
                                                label="Contrôles ISO 27001 Associés"
                                                options={controls.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
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
                                                label="Actifs concernés"
                                                options={assets.map(a => ({ value: a.id, label: a.name }))}
                                                value={field.value || []}
                                                onChange={field.onChange}
                                                multiple
                                            />
                                        )}
                                    />
                                    <Controller
                                        control={control}
                                        name="relatedRiskIds"
                                        render={({ field }) => (
                                            <CustomSelect
                                                label="Risques traités"
                                                options={risks.map(r => ({ value: r.id, label: `${r.threat.substring(0, 50)}...` }))}
                                                value={field.value || []}
                                                onChange={field.onChange}
                                                multiple
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 4: Lifecycle */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-fade-in-right">
                                <div className="text-center mb-8">
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    <Controller
                                        control={control}
                                        name="reviewers"
                                        render={({ field }) => (
                                            <CustomSelect
                                                label="Relecteurs (Reviewers)"
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
                                                label="Approbateurs Finaux"
                                                options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                                value={field.value || []}
                                                onChange={field.onChange}
                                                multiple
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 5: Review */}
                        {currentStep === 4 && (
                            <div className="space-y-8 animate-fade-in-right">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-success-600">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Prêt à valider ?</h3>
                                    <p className="text-sm text-slate-500">Vérifiez les informations ci-dessous</p>
                                </div>

                                <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-slate-100 dark:border-white/5 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{getValues('title')}</p>
                                            <p className="text-xs text-slate-500">{docType} - v{getValues('version')}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[11px] font-bold uppercase ${status === 'Publié' ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'}`}>
                                            {status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="text-slate-500 block">Dossier</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
                                                {folders.find(f => f.id === folderId)?.name || 'Racine'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block">Propriétaire</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
                                                {users.find(u => u.uid === ownerId)?.displayName || getValues('owner')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block">Fichier</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate block max-w-[150px]">
                                                {fileName || (uploadedFileUrl ? 'Fichier présent' : 'Aucun fichier')}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block">Sécurité</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
                                                {uploadedFileSecure ? 'Chiffré / Sécurisé' : 'Standard'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer Buttons */}
                <div className="px-8 py-6 border-t border-border/40 glass-premium backdrop-blur-md relative z-10 flex justify-between items-center">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={currentStep === 0 ? onClose : prevStep}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        {currentStep === 0 ? 'Annuler' : 'Précédent'}
                    </Button>

                    <div className="flex gap-3">
                        {currentStep < STEPS.length - 1 ? (
                            <Button onClick={nextStep} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90">
                                Suivant <ChevronRight className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={handleSubmit(handleFinalSubmit)} isLoading={isLoading} className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20">
                                Terminer & Créer <CheckCircle2 className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                    </div>
                </div>

            </motion.div>
        </div>
    );
};
