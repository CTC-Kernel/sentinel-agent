import React, { useEffect } from 'react';
import { Controller, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { useFormPersistence } from '../../hooks/utils/useFormPersistence';
import { assetSchema, AssetFormData } from '../../schemas/assetSchema';
import { Asset, UserProfile, Supplier, Criticality } from '../../types';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { toast } from '@/lib/toast';
import { Button } from '../ui/button';
import { Sparkles, AlertTriangle, ShieldCheck } from '../ui/Icons';
import { aiService } from '../../services/aiService';
import { ErrorLogger } from '../../services/errorLogger';
import { DatePicker } from '../ui/DatePicker';
import { ASSET_TYPES, ASSET_LIFECYCLE_STATUSES, COMPLIANCE_SCOPES } from '../../data/assetConstants';
import { AIAssistantHeader, BaseTemplate } from '../ui/AIAssistantHeader';
import { AssetClassificationService } from '../../services/AssetClassificationService';
import { useStore } from '../../store';

type AssetTemplate = BaseTemplate & {
    type: string;
    confidentiality: string;
    integrity: string;
    availability: string;
};

const ASSET_TEMPLATES: AssetTemplate[] = [
    { name: 'Serveur de Base de Données', description: 'Serveur SQL critique stockant les données clients.', type: 'Matériel', confidentiality: 'Critique', integrity: 'Critique', availability: 'Élevée' },
    { name: 'Laptop Développeur', description: 'MacBook Pro pour le développement.', type: 'Matériel', confidentiality: 'Moyenne', integrity: 'Moyenne', availability: 'Moyenne' },
    { name: 'SaaS CRM Salesforce', description: 'Plateforme CRM cloud.', type: 'Service', confidentiality: 'Élevée', integrity: 'Élevée', availability: 'Élevée' },
    { name: 'Collaborateur Admin', description: 'Administrateur Système avec accès privilégiés.', type: 'Humain', confidentiality: 'Critique', integrity: 'Critique', availability: 'Moyenne' },
];

interface AssetFormProps {
    onSubmit: (data: AssetFormData) => Promise<void>;
    onCancel: () => void;
    initialData?: Asset | null;
    usersList: UserProfile[];
    suppliers: Supplier[];
    isEditing?: boolean;
    isLoading?: boolean;
    readOnly?: boolean;
    onDirtyChange?: (isDirty: boolean) => void;
}

export const AssetForm: React.FC<AssetFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    usersList,
    suppliers,
    isEditing = false,
    isLoading = false,
    readOnly = false,
    onDirtyChange
}) => {
    const defaultValues: Partial<AssetFormData> = {
        name: '',
        type: 'Matériel',
        owner: '',
        confidentiality: Criticality.LOW,
        integrity: Criticality.LOW,
        availability: Criticality.LOW,
        location: '',
        purchaseDate: '',
        purchasePrice: 0,
        warrantyEnd: '',
        lifecycleStatus: 'Neuf',
        scope: [],
        supplierId: '',
        ipAddress: '',
        version: '',
        licenseExpiry: '',
        email: '',
        role: '',
        department: '',
        // Service details
        serviceDetails: { providerUrl: '', sla: '', supportContact: '', hostingLocation: '' },
        // Data details
        dataDetails: {
            format: 'Numérique',
            retentionPeriod: '',
            hasWorm: false,
            isEncrypted: false,
            dataCategory: 'Financier'
        }
    };

    const { control, handleSubmit, reset, formState: { errors, isDirty }, setValue, watch, getValues, register } = useZodForm<typeof assetSchema>({
        schema: assetSchema,
        mode: 'onChange',
        shouldUnregister: true,
        defaultValues: defaultValues as any
    });

    const onInvalid = (errors: FieldErrors<AssetFormData>) => {
        const missingFields = Object.keys(errors).map(field => t(`common.fields.${field}`) || field).join(', ');
        toast.error(t('common.formInvalid'), t('common.checkFields', { fields: missingFields }));
    };
    const { addToast, t } = useStore();
    const [suggestingField, setSuggestingField] = React.useState<string | null>(null);

    useEffect(() => {
        if (initialData) {
            reset({
                name: initialData.name,
                type: initialData.type,
                owner: initialData.owner,
                confidentiality: initialData.confidentiality,
                integrity: initialData.integrity,
                availability: initialData.availability,
                location: initialData.location,
                purchaseDate: initialData.purchaseDate || '',
                purchasePrice: initialData.purchasePrice || 0,
                warrantyEnd: initialData.warrantyEnd || '',
                lifecycleStatus: initialData.lifecycleStatus || 'Neuf',
                scope: initialData.scope || [],
                supplierId: initialData.supplierId || '',
                ipAddress: initialData.ipAddress || '',
                version: initialData.version || '',
                licenseExpiry: initialData.licenseExpiry || '',
                email: initialData.email || '',
                role: initialData.role || '',
                department: initialData.department || '',
                serviceDetails: initialData.serviceDetails || { providerUrl: '', sla: '', supportContact: '', hostingLocation: '' },
                dataDetails: initialData.dataDetails || { format: 'Numérique', retentionPeriod: '', hasWorm: false, isEncrypted: false, dataCategory: 'Financier' }
            });
        }
    }, [initialData, reset]);

    // Use standardized persistence hook
    const { clearDraft } = useFormPersistence('sentinel_asset_draft_new', {
        watch,
        reset,
        getValues,
        setValue,
        register,
        control,
        errorMessage: '', // Mocking missing props for TS satisfaction if needed, though simpler is better
        handleSubmit: () => Promise.resolve(),
        formState: {} as any,
        setError: () => { },
        clearErrors: () => { },
        getFieldState: () => ({} as any),
        trigger: () => Promise.resolve(true),
        unregister: () => { },
    } as any, { // Casting to avoid complex mocking of UseFormReturn
        enabled: !isEditing && !initialData
    });

    const handleFormSubmit = async (data: AssetFormData) => {
        await onSubmit(data);
        // Clear draft on success
        clearDraft();
    };

    // Propagate dirty state
    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    // Accessibility: Handle Escape key to close modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) {
                onCancel();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isLoading, onCancel]);

    const [isGenerating, setIsGenerating] = React.useState(false);

    const handleSelectTemplate = (templateName: string) => {
        const t = ASSET_TEMPLATES.find(t => t.name === templateName);
        if (t) {
            setValue('name', t.name);
            setValue('type', t.type as AssetFormData['type']); // Cast for strict enum match if needed
            setValue('confidentiality', t.confidentiality as Criticality);
            setValue('integrity', t.integrity as Criticality);
            setValue('availability', t.availability as Criticality);
            // Could set other fields if added to template
        }
    };

    const handleAutoGenerate = async () => {
        const currentName = getValues('name');
        if (!currentName) return; // Simple check

        setIsGenerating(true);
        try {
            const prompt = `Suggère les détails pour un actif nommé "${currentName}".
            Format JSON attendu:
            {
                "type": "Matériel" | "Logiciel" | "Données" | "Service" | "Humain",
                "confidentiality": "Faible" | "Moyenne" | "Élevée" | "Critique",
                "integrity": "Faible" | "Moyenne" | "Élevée" | "Critique",
                "availability": "Faible" | "Moyenne" | "Élevée" | "Critique"
            }`;

            const resultText = await aiService.generateText(prompt);
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]) as Partial<AssetFormData>;
                if (data.type) setValue('type', data.type);
                if (data.confidentiality) setValue('confidentiality', data.confidentiality);
                if (data.integrity) setValue('integrity', data.integrity);
                if (data.availability) setValue('availability', data.availability);
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AssetForm.handleAutoGenerate', 'AI_ERROR');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSuggestField = async (field: keyof AssetFormData) => {
        const currentName = getValues('name');
        if (!currentName && field !== 'name') return;
        // ... existing handleSuggestField logic ...
        setSuggestingField(field);
        try {
            let prompt = '';
            if (field === 'name') {
                prompt = "Suggère un nom d'actif informatique réaliste et professionnel (ex: Serveur Dell PowerEdge, MacBook Pro 16, CRM Salesforce). Réponds uniquement avec le nom.";
            } else if (field === 'type') {
                prompt = `Quel est le type de l'actif "${currentName}" ? Choix possibles : Matériel, Logiciel, Données, Service, Humain. Réponds uniquement avec le type.`;
            } else if (field === 'confidentiality') {
                prompt = `Quelle est la confidentialité probable pour l'actif "${currentName}" ? Choix : Faible, Moyenne, Élevée, Critique. Réponds uniquement avec le niveau.`;
            }

            const suggestion = await aiService.generateText(prompt);
            if (suggestion) {
                const cleanSuggestion = suggestion.replace(/^["']|["']$/g, '').trim();
                // ... validation logic ...
                if (field === 'type' && !['Matériel', 'Logiciel', 'Données', 'Service', 'Humain'].includes(cleanSuggestion)) {
                    // Fallback
                } else if (field === 'confidentiality' && !Object.values(Criticality).includes(cleanSuggestion as Criticality)) {
                    // Fallback
                } else {
                    setValue(field, cleanSuggestion as AssetFormData[keyof AssetFormData], { shouldDirty: true });
                }
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AssetForm.handleSuggestField', 'FETCH_FAILED');
        } finally {
            setSuggestingField(null);
        }
    };

    const handleAutoClassify = () => {
        const currentValues = getValues();
        // Convert FormData to Partial<Asset> structure expected by service
        const partialAsset: Partial<Asset> = {
            ...currentValues,
            // Safe casts or conversions if needed
        };
        const suggestion = AssetClassificationService.suggestClassification(partialAsset);

        setValue('confidentiality', suggestion.confidentiality, { shouldDirty: true });
        setValue('integrity', suggestion.integrity, { shouldDirty: true });
        setValue('availability', suggestion.availability, { shouldDirty: true });

        addToast(`Classification appliquée: ${suggestion.reason}`, "success");
    };

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(handleFormSubmit, onInvalid)(e);
            }}
            className="space-y-8 p-4 sm:p-6"
        >
            {!isEditing && (
                <AIAssistantHeader
                    templates={ASSET_TEMPLATES}
                    onSelectTemplate={handleSelectTemplate}
                    onAutoGenerate={handleAutoGenerate}
                    isGenerating={isGenerating}
                    readOnly={readOnly}
                />
            )}
            <fieldset disabled={readOnly} className="space-y-8 group-disabled:opacity-80">
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">Informations Principales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-1 md:col-span-2">
                            <div className="relative">
                                <Controller
                                    name="name"
                                    control={control}
                                    render={({ field }) => (
                                        <FloatingLabelInput
                                            label="Nom de l'actif"
                                            id="name"
                                            autoComplete="off"
                                            {...field}
                                            error={errors.name?.message}
                                        />
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleSuggestField('name')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-brand-500 transition-colors"
                                    title="Suggérer un nom"
                                >
                                    <Sparkles className={`h-4 w-4 ${suggestingField === 'name' ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <Controller
                                name="type"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Type"
                                        options={ASSET_TYPES.map(t => ({ value: t, label: t }))}
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={errors.type?.message}
                                    />
                                )}
                            />
                            <button
                                type="button"
                                onClick={() => handleSuggestField('type')}
                                className="absolute right-8 top-1/2 -translate-y-1/2 mt-0 text-slate-500 hover:text-brand-500 transition-colors z-10"
                                title="Suggérer le type"
                            >
                                <Sparkles className={`h-4 w-4 ${suggestingField === 'type' ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div>
                            <Controller
                                name="owner"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Propriétaire"
                                        options={usersList.map(u => ({ value: u.displayName || u.email, label: u.displayName || u.email }))}
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={errors.owner?.message}
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <Controller
                                name="location"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Localisation"
                                        id="location"
                                        autoComplete="off"
                                        {...field}
                                        error={errors.location?.message}
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2">
                            <Controller
                                name="supplierId"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Fournisseur / Mainteneur"
                                        options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.category }))}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        placeholder="Sélectionner un fournisseur..."
                                        error={errors.supplierId?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>
                </div>

                {/* Specialized Fields based on Type */}
                {watch('type') === 'Matériel' && (
                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm animate-fade-in">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">Détails Matériel</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <Controller
                                name="ipAddress"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Adresse IP"
                                        id="ipAddress"
                                        autoComplete="off"
                                        {...field}
                                        error={errors.ipAddress?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>
                )}

                {watch('type') === 'Logiciel' && (
                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm animate-fade-in">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">Détails Logiciel</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <Controller
                                name="version"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Version"
                                        id="version"
                                        autoComplete="off"
                                        {...field}
                                        error={errors.version?.message}
                                    />
                                )}
                            />
                            <div>
                                <Controller
                                    control={control}
                                    name="licenseExpiry"
                                    render={({ field }) => (
                                        <DatePicker
                                            label="Expiration Licence"
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={errors.licenseExpiry?.message}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {watch('type') === 'Humain' && (
                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm animate-fade-in">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">Détails Collaborateur</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <Controller
                                name="email"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Email Professionnel"
                                        id="email"
                                        autoComplete="email"
                                        {...field}
                                        error={errors.email?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="role"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Fonction / Rôle"
                                        id="role"
                                        autoComplete="organization-title"
                                        {...field}
                                        error={errors.role?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="department"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Département"
                                        id="department"
                                        autoComplete="organization"
                                        {...field}
                                        error={errors.department?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>
                )}

                {watch('type') === 'Service' && (
                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm animate-fade-in">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">Détails Service / SaaS</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <Controller
                                name="serviceDetails.providerUrl"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="URL du Fournisseur"
                                        id="providerUrl"
                                        autoComplete="url"
                                        {...field}
                                        error={errors.serviceDetails?.providerUrl?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="serviceDetails.sla"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Niveau SLA (ex: 99.9%)"
                                        id="sla"
                                        autoComplete="off"
                                        {...field}
                                        error={errors.serviceDetails?.sla?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="serviceDetails.supportContact"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Contact Support"
                                        id="supportContact"
                                        autoComplete="tel"
                                        {...field}
                                        error={errors.serviceDetails?.supportContact?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="serviceDetails.hostingLocation"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Lieu d'hébergement"
                                        id="hostingLocation"
                                        autoComplete="off"
                                        {...field}
                                        error={errors.serviceDetails?.hostingLocation?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>
                )}

                {watch('type') === 'Données' && (
                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm animate-fade-in">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">Détails Données</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <Controller
                                name="dataDetails.format"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Format"
                                        options={['Numérique', 'Physique', 'Hybride'].map(f => ({ value: f, label: f }))}
                                        value={field.value || 'Numérique'}
                                        onChange={field.onChange}
                                        error={errors.dataDetails?.format?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="dataDetails.dataCategory"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Catégorie de Données"
                                        options={['Client', 'Employé', 'Financier', 'Propriété Intellectuelle', 'Autre'].map(c => ({ value: c, label: c }))}
                                        value={field.value || 'Autre'}
                                        onChange={field.onChange}
                                        error={errors.dataDetails?.dataCategory?.message}
                                    />
                                )}
                            />
                            <Controller
                                name="dataDetails.retentionPeriod"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Durée de rétention (ex: 5 ans)"
                                        id="retentionPeriod"
                                        autoComplete="off"
                                        {...field}
                                        error={errors.dataDetails?.retentionPeriod?.message}
                                    />
                                )}
                            />
                            <div className="flex flex-col gap-4 justify-center md:col-span-2">
                                <label htmlFor="isEncrypted" className="flex items-center space-x-3 cursor-pointer group">
                                    <input {...control.register('dataDetails.isEncrypted')}
                                        type="checkbox"
                                        id="isEncrypted"
                                        className="form-checkbox h-5 w-5 text-brand-600 rounded border-slate-300 focus-visible:ring-brand-500 transition-all duration-200"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Données Chiffrées (At rest / Transit)</span>
                                </label>
                                <label htmlFor="isEncrypted" className="flex items-center space-x-3 cursor-pointer group">
                                    <input {...register('dataDetails.isEncrypted')}
                                        type="checkbox"
                                        id="isEncrypted"
                                        className="form-checkbox h-5 w-5 text-brand-600 rounded border-slate-300 focus-visible:ring-brand-500 transition-all duration-200"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Données Chiffrées (At rest / Transit)</span>
                                </label>
                                <label htmlFor="hasWorm" className="flex items-center space-x-3 cursor-pointer group">
                                    <input {...register('dataDetails.hasWorm')}
                                        type="checkbox"
                                        id="hasWorm"
                                        className="form-checkbox h-5 w-5 text-brand-600 rounded border-slate-300 focus-visible:ring-brand-500 transition-all duration-200"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">Stockage Immuable (WORM)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600/80 mb-6 flex items-center justify-between">
                        <div className="flex items-center"><AlertTriangle className="h-4 w-4 mr-2" /> Classification DIC</div>
                        <button
                            type="button"
                            onClick={handleAutoClassify}
                            className="text-xs normal-case font-medium text-brand-500 hover:text-brand-600 flex items-center bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <Sparkles className="h-3 w-3 mr-1.5" /> Auto-Classifier (Règles)
                        </button>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {['confidentiality', 'integrity', 'availability'].map((field) => (
                            <div key={field}>
                                <Controller
                                    name={field as keyof AssetFormData}
                                    control={control}
                                    render={({ field: f }) => (
                                        <CustomSelect
                                            label={field.charAt(0).toUpperCase() + field.slice(1)}
                                            options={Object.values(Criticality).map(c => ({ value: c, label: c }))}
                                            value={f.value as string}
                                            onChange={f.onChange}
                                            error={errors[field as keyof AssetFormData]?.message}
                                        />
                                    )}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 flex items-center">
                        <ShieldCheck className="h-4 w-4 mr-2" /> Périmètre de Conformité (Scope)
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {COMPLIANCE_SCOPES.map((scope) => (
                            <label
                                key={scope}
                                htmlFor={`scope-${scope}`}
                                className={`cursor-pointer px-4 py-2 rounded-xl border transition-all ${(watch('scope') || []).includes(scope)
                                    ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-bold'
                                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'
                                    }`}
                            >
                                <input
                                    id={`scope-${scope}`}
                                    type="checkbox"
                                    name="scope"
                                    value={scope}
                                    className="sr-only peer"
                                    checked={(watch('scope') || []).includes(scope)}
                                    onChange={(e) => {
                                        const current = watch('scope') || [];
                                        if (e.target.checked) {
                                            setValue('scope', [...current, scope], { shouldDirty: true });
                                        } else {
                                            setValue('scope', current.filter((s: string) => s !== scope), { shouldDirty: true });
                                        }
                                    }}
                                />
                                {scope.replace('_', ' ')}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6">Cycle de Vie</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                            <Controller
                                name="lifecycleStatus"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Statut"
                                        options={ASSET_LIFECYCLE_STATUSES.map(s => ({ value: s, label: s }))}
                                        value={field.value || 'Neuf'}
                                        onChange={field.onChange}
                                        error={errors.lifecycleStatus?.message}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <Controller
                                control={control}
                                name="purchaseDate"
                                render={({ field }) => (
                                    <DatePicker
                                        label="Date d'achat"
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={errors.purchaseDate?.message}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <Controller
                                control={control}
                                name="warrantyEnd"
                                render={({ field }) => (
                                    <DatePicker
                                        label="Fin de garantie"
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={errors.warrantyEnd?.message}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <Controller
                                control={control}
                                name="purchasePrice"
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        type="number"
                                        id="purchasePrice"
                                        autoComplete="off"
                                        label="Prix d'achat (€)"
                                        value={field.value}
                                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                        error={errors.purchasePrice?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>
                </div>

            </fieldset>

            {!readOnly && (
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
                    <Button
                        type="button"
                        onClick={onCancel}
                        variant="ghost"
                        disabled={isLoading}
                        className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                        Annuler
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isLoading}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold hover:scale-105 transition-transform shadow-lg shadow-brand-500/20"
                    >
                        {isEditing ? 'Mettre à jour' : 'Créer l\'actif'}
                    </Button>
                </div>
            )}
        </form>
    );
};
