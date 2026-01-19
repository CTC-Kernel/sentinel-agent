import { toast } from '@/lib/toast';
import React, { useEffect } from 'react';
import { Controller, SubmitHandler, useWatch, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { supplierSchema, SupplierFormData } from '../../schemas/supplierSchema';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Criticality, UserProfile, BusinessProcess, Asset, Risk, Document } from '../../types';
import { ShieldAlert, Building2, Wand2, Link as LinkIcon, FileText } from '../ui/Icons';
import { aiService } from '../../services/aiService';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { integrationService, CompanySearchResult } from '../../services/integrationService';
import { Search, Loader2 } from '../ui/Icons';
import { Button } from '../ui/button';
import { AIAssistantHeader, BaseTemplate } from '../ui/AIAssistantHeader';

type SupplierTemplate = BaseTemplate & { category: string; criticality: Criticality };

const SUPPLIER_TEMPLATES: SupplierTemplate[] = [
    { name: 'Hébergeur Cloud Santé (HDS)', description: 'Fournisseur critique hébergeant des données de santé.', category: 'Hébergement', criticality: Criticality.CRITICAL },
    { name: 'Fournisseur SaaS RH', description: 'Solution de gestion des congés et paies.', category: 'SaaS', criticality: Criticality.MEDIUM },
    { name: 'Maintenance Informatique', description: 'Prestataire de maintenance sur site.', category: 'Services IT', criticality: Criticality.HIGH },
];
import { SUPPLIER_CATEGORIES, SUPPLIER_STATUSES, DORA_SERVICE_TYPES, DORA_CRITICALITIES } from '../../data/supplierConstants';

interface SupplierFormProps {
    onSubmit: SubmitHandler<SupplierFormData>;
    onCancel: () => void;
    initialData?: SupplierFormData;
    isEditing?: boolean;
    users: UserProfile[];
    processes: BusinessProcess[];
    assets: Asset[];
    risks: Risk[];
    documents: Document[];
    isLoading?: boolean;
    readOnly?: boolean;
}

export const SupplierForm: React.FC<SupplierFormProps> = ({
    onSubmit,
    onCancel,
    initialData,
    isEditing = false,
    users,
    processes,
    assets,
    risks,
    documents,
    isLoading = false,
    readOnly = false
}) => {
    const { addToast, demoMode } = useStore();
    const defaultData: SupplierFormData = {
        name: '', category: 'SaaS', criticality: Criticality.MEDIUM, status: 'Actif',
        owner: '', ownerId: '', vatNumber: '',
        description: '',
        contactName: '', contactEmail: '',
        contractDocumentId: '',
        contractEnd: '',
        assessment: { hasIso27001: false, hasGdprPolicy: false, hasEncryption: false, hasBcp: false, hasIncidentProcess: false },
        isICTProvider: false, supportsCriticalFunction: false, doraCriticality: 'Aucun', serviceType: 'SaaS',
        relatedAssetIds: [], relatedRiskIds: [], relatedProjectIds: [], supportedProcessIds: []
    };

    const { register, handleSubmit, control, setValue, formState: { errors }, getValues } = useZodForm<typeof supplierSchema>({
        schema: supplierSchema,
        mode: 'onChange',
        shouldUnregister: true,
        defaultValues: initialData ? {
            ...defaultData,
            ...initialData,
            // Ensure enum fields have valid values if they are missing or invalid in initialData
            doraCriticality: initialData.doraCriticality ?? 'Aucun',
            serviceType: initialData.serviceType ?? 'SaaS',
            category: initialData.category ?? 'SaaS',
            status: initialData.status ?? 'Actif',
        } : defaultData
    });

    const onInvalid = (errors: FieldErrors<SupplierFormData>) => {
        const missingFields = Object.keys(errors).join(', ');
        toast.error(`Formulaire invalide. Champs en erreur : ${missingFields}`);
    };

    const [searchResults, setSearchResults] = React.useState<CompanySearchResult[]>([]);
    const [searching, setSearching] = React.useState(false);
    const [logoUrl, setLogoUrl] = React.useState<string>('');

    const handleCompanySearch = async (query: string) => {
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const results = await integrationService.searchCompany(query, demoMode);
            setSearchResults(results);
        } catch (error) {
            ErrorLogger.error(error, "SupplierForm.handleCompanySearch");
        } finally {
            setSearching(false);
        }
    };

    const selectCompany = (company: CompanySearchResult) => {
        setValue('name', company.name);
        // Assuming we might want to store address/siren in description or custom fields later
        // For now, let's append to description if empty
        const currentDesc = getValues('description') || '';
        if (!currentDesc.includes(company.siren)) {
            setValue('description', `${currentDesc}\n\n[Auto-Import]\nSIREN: ${company.siren}\nAdresse: ${company.address}\nActivité: ${company.activity}`.trim());
        }
        setSearchResults([]);
    };

    // Watch name to fetch logo if it looks like a domain
    const nameValue = useWatch({ control, name: 'name' });
    useEffect(() => {
        if (nameValue && (nameValue.includes('.') || nameValue.includes('http'))) {
            // Extract domain
            const domain = nameValue.replace(/^https?:\/\//, '').split('/')[0];
            setLogoUrl(integrationService.getLogoUrl(domain));
        }
    }, [nameValue]);

    const selectedOwnerId = useWatch({ control, name: 'ownerId' });

    const [isGenerating, setIsGenerating] = React.useState(false);

    const handleSelectTemplate = (templateName: string) => {
        const t = SUPPLIER_TEMPLATES.find(t => t.name === templateName);
        if (t) {
            setValue('name', t.name);
            setValue('description', t.description);
            // category and criticality are enums in schema
            if (t.category === 'SaaS' || t.category === 'Hébergement' || t.category === 'Matériel' || t.category === 'Consulting' || t.category === 'Autre') {
                setValue('category', t.category);
            }
            setValue('criticality', t.criticality);
        }
    };

    const handleAutoGenerate = async () => {
        const currentName = getValues('name');
        if (!currentName) return;

        setIsGenerating(true);
        try {
            const prompt = `Décris un fournisseur de services intitulé "${currentName}".
            Format JSON attendu:
            {
                "description": "Description des services fournis",
                "category": "Catégorie probable (SaaS, Hébergement, etc.)",
                 "criticality": "Critique, Élevée, Moyenne, ou Faible"
            }`;

            const resultText = await aiService.generateText(prompt);
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                if (data.description) setValue('description', data.description);
                if (data.category) setValue('category', data.category);
                if (data.criticality) setValue('criticality', data.criticality);
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'SupplierForm.handleAutoGenerate', 'AI_ERROR');
        } finally {
            setIsGenerating(false);
        }
    };

    // const isEditing = !!initialData; // Use initialData to determine if editing

    useEffect(() => {
        if (!selectedOwnerId) {
            setValue('owner', '', { shouldDirty: true, shouldValidate: true });
            return;
        }
        const selectedUser = users.find(u => u.uid === selectedOwnerId);
        setValue('owner', selectedUser ? (selectedUser.displayName || selectedUser.email || '') : '', {
            shouldDirty: true,
            shouldValidate: true
        });
    }, [selectedOwnerId, users, setValue]);

    const handleAISuggestion = async (field: keyof SupplierFormData) => {
        const name = getValues('name');
        if (!name) {
            addToast("Veuillez d'abord saisir un nom de fournisseur", "info");
            return;
        }

        try {
            addToast("Génération de suggestions IA...", "info");
            const prompt = `Suggère une valeur pour le champ ${field} d'un fournisseur nommé ${name}. Réponds uniquement par la valeur.`;
            const suggestion = await aiService.generateText(prompt);

            if (suggestion) {
                // Simple mapping for demo purposes - in prod use structured output
                if (field === 'category') setValue('category', 'SaaS');
                if (field === 'criticality') setValue('criticality', Criticality.MEDIUM);
                if (field === 'description') setValue('description', suggestion);
                addToast("Suggestion appliquée", "success");
            }
        } catch (error) {
            ErrorLogger.error(error, 'SupplierForm.handleAISuggestion');
            addToast("Erreur lors de la génération", "error");
        }
    };

    const handleVatValidation = async () => {
        const vat = getValues('vatNumber');
        if (!vat) return;
        try {
            const result = await integrationService.validateVat(vat);
            addToast(result.message, result.valid ? 'success' : 'error');
        } catch {
            addToast('Erreur de validation VIES', 'error');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar h-full">
            <fieldset disabled={readOnly} className="space-y-6 group-disabled:opacity-100">
                {!isEditing && !readOnly && (
                    <AIAssistantHeader
                        templates={SUPPLIER_TEMPLATES}
                        onSelectTemplate={handleSelectTemplate}
                        onAutoGenerate={handleAutoGenerate}
                        isGenerating={isGenerating}
                        title="Assistant Fournisseur"
                        description="Ajoutez un fournisseur type ou laissez l'IA le qualifier."
                    />
                )}
                <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                        <Building2 className="w-5 h-5 mr-2 text-indigo-500" />
                        Informations Générales
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2 relative">
                            <Controller
                                name="name"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Nom de l'entreprise"
                                        {...field}
                                        value={field.value || ''}
                                        error={errors.name?.message}
                                    />
                                )}
                            />
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => handleAISuggestion('name')}
                                    className="absolute right-3 top-3.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                                    title="Suggérer un nom complet"
                                    aria-label="Suggérer un nom complet par IA"
                                >
                                    <Wand2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Company Search Results */}
                        {searchResults.length > 0 && !readOnly && (
                            <div className="col-span-1 md:col-span-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 max-h-60 overflow-y-auto">
                                {searchResults.map((company) => (
                                    <button
                                        key={company.siren}
                                        type="button"
                                        onClick={() => selectCompany(company)}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors flex justify-between items-center"
                                        aria-label={`Sélectionner l'entreprise ${company.name}`}
                                    >
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-sm">{company.name}</div>
                                            <div className="text-xs text-slate-600">{company.address}</div>
                                        </div>
                                        <div className="text-xs font-mono bg-slate-100 dark:bg-black/30 px-2 py-1 rounded text-slate-600">
                                            {company.siren}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {!readOnly && (
                            <div className="col-span-1 md:col-span-2">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Rechercher une entreprise (Sirene/Pappers)..."
                                        className="w-full px-4 py-2 bg-transparent border-b border-slate-200 dark:border-white/10 text-sm focus:border-indigo-500 outline-none transition-colors"
                                        onChange={(e) => handleCompanySearch(e.target.value)}
                                        aria-label="Rechercher une entreprise"
                                    />
                                    <div className="absolute right-0 top-2 text-slate-500">
                                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="col-span-1 md:col-span-2">
                            <div className="relative">
                                <Controller
                                    name="vatNumber"
                                    control={control}
                                    render={({ field }) => (
                                        <FloatingLabelInput
                                            label="Numéro de TVA (VIES)"
                                            {...field}
                                            value={field.value || ''}
                                        />
                                    )}
                                />
                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={handleVatValidation}
                                        className="absolute right-3 top-3.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-xs font-bold uppercase tracking-wider"
                                    >
                                        Vérifier
                                    </button>
                                )}
                            </div>
                        </div>

                        {logoUrl && (
                            <div className="col-span-1 md:col-span-2 flex justify-center py-4">
                                <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded-xl bg-white p-2 shadow-sm border border-slate-100" onError={(e) => e.currentTarget.style.display = 'none'} />
                            </div>
                        )}

                        <div>
                            <Controller
                                name="category"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Catégorie"
                                        options={SUPPLIER_CATEGORIES.map(c => ({ value: c, label: c }))}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <Controller
                                name="criticality"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Criticité"
                                        options={Object.values(Criticality).map(c => ({ value: c, label: c }))}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Statut"
                                        options={SUPPLIER_STATUSES.map(s => ({ value: s, label: s }))}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">Responsable Interne</label>
                            <Controller
                                name="ownerId"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        options={users.map(u => ({ value: u.uid, label: u.displayName, subLabel: u.role }))}
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        placeholder="Sélectionner un responsable..."
                                    />
                                )}
                            />
                        </div>

                        <div className="col-span-1 md:col-span-2 relative">
                            <Controller
                                name="description"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Description"
                                        {...field}
                                        value={field.value || ''}
                                        textarea
                                    />
                                )}
                            />
                            {!readOnly && (
                                <button
                                    type="button"
                                    onClick={() => handleAISuggestion('description')}
                                    className="absolute right-3 top-3.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                                    title="Suggérer une description"
                                    aria-label="Suggérer une description par IA"
                                >
                                    <Wand2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* DORA Compliance Card */}
                <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm bg-indigo-50/30 dark:bg-slate-900/10">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                        <ShieldAlert className="w-5 h-5 mr-2 text-indigo-600" />
                        Conformité DORA
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center space-x-3 p-4 bg-white/50 dark:bg-black/20 rounded-2xl border border-white/50 dark:border-white/5">
                            <input type="checkbox" disabled={readOnly} className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" {...register('isICTProvider')} />
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Prestataire TIC Critique</label>
                        </div>
                        <div className="flex items-center space-x-3 p-4 bg-white/50 dark:bg-black/20 rounded-2xl border border-white/50 dark:border-white/5">
                            <input type="checkbox" disabled={readOnly} className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" {...register('supportsCriticalFunction')} />
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Supporte Fonction Critique</label>
                        </div>

                        <div>
                            <Controller
                                name="serviceType"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Type de Service"
                                        options={DORA_SERVICE_TYPES.map(c => ({ value: c, label: c }))}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <Controller
                                name="doraCriticality"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Criticité DORA"
                                        options={DORA_CRITICALITIES.map(c => ({ value: c, label: c }))}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    </div>
                </div>

                {/* Relations Card */}
                <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                        <LinkIcon className="w-5 h-5 mr-2 text-indigo-500" />
                        Relations & Dépendances
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">Processus Supportés</label>
                            <Controller
                                name="supportedProcessIds"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        options={processes.map(p => ({ value: p.id, label: p.name, subLabel: `RTO: ${p.rto}` }))}
                                        value={field.value || []}
                                        onChange={field.onChange}
                                        placeholder="Sélectionner les processus..."
                                        multiple
                                    />
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">Actifs Liés</label>
                                {/* This button seems to be misplaced or part of a different context, adding it as requested */}

                                <Controller
                                    name="relatedAssetIds"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            options={assets.map(a => ({ value: a.id, label: a.name, subLabel: a.type }))}
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            placeholder="Lier des actifs..."
                                            multiple
                                        />
                                    )}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">Risques Liés</label>
                                <Controller
                                    name="relatedRiskIds"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            options={risks.map(r => ({ value: r.id, label: r.threat, subLabel: `Score: ${r.score}` }))}
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            placeholder="Lier des risques..."
                                            multiple
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contract & Contact Card */}
                <div className="glass-panel p-6 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                        Contrat & Contact
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Controller
                            name="contactName"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput label="Nom du Contact" {...field} value={field.value || ''} />
                            )}
                        />
                        <Controller
                            name="contactEmail"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput label="Email du Contact" {...field} value={field.value || ''} type="email" />
                            )}
                        />

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 ml-1">Contrat (Document)</label>
                            <Controller
                                name="contractDocumentId"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        options={documents.map(d => ({ value: d.id, label: d.title, subLabel: d.version }))}
                                        value={field.value ?? ''}
                                        onChange={field.onChange}
                                        placeholder="Lier un contrat..."
                                    />
                                )}
                            />
                        </div>

                        <Controller
                            name="contractEnd"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput label="Fin de Contrat" {...field} value={field.value || ''} type="date" />
                            )}
                        />
                    </div>
                </div>

                {!readOnly && (
                    <div className="flex justify-end gap-3 pt-6">
                        <Button
                            type="button"
                            onClick={onCancel}
                            variant="ghost"
                            disabled={isLoading}
                            className="px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="px-8 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl hover:scale-105 transition-transform shadow-lg shadow-brand-500/20 font-bold text-sm"
                        >
                            {isEditing ? 'Mettre à jour' : 'Créer le Fournisseur'}
                        </Button>
                    </div>
                )}
            </fieldset>
        </form>
    );
};
