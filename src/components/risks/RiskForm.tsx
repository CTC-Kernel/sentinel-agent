
import React, { useEffect, useState } from 'react';
import { useForm, Controller, useWatch, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { riskSchema, RiskFormData } from '../../schemas/riskSchema';
import { Risk, Control, Asset, UserProfile, BusinessProcess, Supplier, Criticality, ThreatTemplate } from '../../types';
import { BookOpen, Shield, Search, LayoutGrid, FileText, Activity, Layers, AlertTriangle, Sparkles, History } from '../ui/Icons';
import { ResourceHistory } from '../shared/ResourceHistory';
import { ErrorLogger } from '../../services/errorLogger';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { RiskMatrixSelector } from './RiskMatrixSelector';
import { AIAssistButton } from '../ai/AIAssistButton';
import { RiskTreatmentPlan } from './RiskTreatmentPlan';
import { Button } from '../ui/button';

import { RichTextEditor } from '../ui/RichTextEditor';
import { STANDARD_THREATS } from '../../data/riskConstants';
import { AIAssistantHeader } from '../ui/AIAssistantHeader';
import { aiService } from '../../services/aiService';
import { RISK_TEMPLATES } from '../../data/riskTemplates';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { Modal } from '../ui/Modal';
import { FRAMEWORK_OPTIONS } from '../../data/frameworks';
import { RiskRemediationService } from '../../services/RiskRemediationService';

interface RiskFormProps {
    onSubmit: (data: RiskFormData) => Promise<void>;
    onCancel: () => void;
    existingRisk?: Risk | null;
    assets: Asset[];
    usersList: UserProfile[];
    processes: BusinessProcess[];
    suppliers: Supplier[];
    controls: Control[];
    initialData?: Partial<RiskFormData>;
    isEditing?: boolean;
    isLoading?: boolean;
    readOnly?: boolean;
}

const TABS = [
    { id: 'context', label: 'Contexte & Actifs', icon: LayoutGrid },
    { id: 'identification', label: 'Identification', icon: FileText },
    { id: 'assessment', label: 'Évaluation', icon: Activity },
    { id: 'treatment', label: 'Traitement & Contrôles', icon: Layers },
    { id: 'history', label: 'Historique', icon: History },
];

export const RiskForm: React.FC<RiskFormProps> = ({
    onSubmit,
    onCancel,
    existingRisk,
    assets,
    usersList,
    processes,
    suppliers,
    controls,
    initialData,
    isEditing = false,
    isLoading = false,
    readOnly = false
}) => {
    const [activeTab, setActiveTab] = useState('context');
    const { control, handleSubmit, reset, formState: { errors }, setValue, getValues } = useForm<RiskFormData>({
        resolver: zodResolver(riskSchema),
        shouldUnregister: true,
        defaultValues: {
            assetId: '',
            threat: '',
            scenario: '',
            framework: 'ISO27005',
            vulnerability: '',
            probability: 3,
            impact: 3,
            residualProbability: 3,
            residualImpact: 3,
            strategy: 'Atténuer',
            status: 'Ouvert',
            ownerId: '',
            mitigationControlIds: [],
            affectedProcessIds: [],
            relatedSupplierIds: [],
            ...initialData
        }
    });

    const onInvalid = (errors: FieldErrors<RiskFormData>) => {
        console.error("Form Validation Errors:", errors);
        const missingFields = Object.keys(errors);

        // Map fields to their respective tabs
        const fieldTabMapping: Record<string, string> = {
            assetId: 'context',
            framework: 'context',
            ownerId: 'context',
            affectedProcessIds: 'context',
            relatedSupplierIds: 'context',
            threat: 'identification',
            vulnerability: 'identification',
            scenario: 'identification',
            probability: 'assessment',
            impact: 'assessment',
            residualProbability: 'assessment',
            residualImpact: 'assessment',
            strategy: 'treatment',
            status: 'treatment',
            mitigationControlIds: 'treatment',
            justification: 'treatment',
            treatment: 'treatment'
        };

        // Find the first error and switch to that tab
        const firstErrorField = missingFields[0];
        if (firstErrorField && fieldTabMapping[firstErrorField]) {
            setActiveTab(fieldTabMapping[firstErrorField]);
        }

        const translatedFields = missingFields.map(field => {
            switch (field) {
                case 'assetId': return 'Actif Principal';
                case 'threat': return 'Menace';
                case 'vulnerability': return 'Vulnérabilité';
                case 'justification': return 'Justification';
                default: return field;
            }
        });

        toast.error(`Formulaire incomplet. Veuillez vérifier : ${translatedFields.join(', ')}`);
    };

    const framework = useWatch({ control, name: 'framework' });
    const probability = useWatch({ control, name: 'probability' });
    const impact = useWatch({ control, name: 'impact' });
    const residualProbability = useWatch({ control, name: 'residualProbability' });
    const residualImpact = useWatch({ control, name: 'residualImpact' });
    const mitigationControlIds = useWatch({ control, name: 'mitigationControlIds' });
    const strategy = useWatch({ control, name: 'strategy' });
    // const status = useWatch({ control, name: 'status' }); // Removed unused status watch
    const assetId = useWatch({ control, name: 'assetId' });

    // Watch for SLA fields
    // const treatmentDeadline = watch('treatmentDeadline');
    // const treatmentOwnerId = watch('treatmentOwnerId');


    const mapCriticalityToImpact = (crit: Criticality): number => {
        switch (crit) {
            case Criticality.CRITICAL: return 5;
            case Criticality.HIGH: return 4;
            case Criticality.MEDIUM: return 3;
            case Criticality.LOW:
            default: return 2;
        }
    };

    const [isGenerating, setIsGenerating] = React.useState(false);
    const [showLibraryModal, setShowLibraryModal] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [suggestedControlIds, setSuggestedControlIds] = React.useState<string[]>([]);

    // Fetch threat library templates
    const { data: libraryThreats } = useFirestoreCollection<ThreatTemplate>(
        'threat_library',
        [],
        { enabled: showLibraryModal }
    );

    useEffect(() => {
        const threat = getValues('threat');
        if (threat && activeTab === 'treatment') {
            // Cast to generic object to avoid strict Risk type matching issues with form data
            const formData = getValues() as unknown as Partial<Risk>;
            const suggestions = RiskRemediationService.suggestMitigationControls(formData, controls);
            setSuggestedControlIds(suggestions);
        }
    }, [activeTab, getValues, controls]);

    const handleSelectTemplate = (templateName: string) => {
        const t = RISK_TEMPLATES.find(t => t.name === templateName);
        if (t) {
            setValue('threat', t.threat || t.name, { shouldDirty: true });
            setValue('scenario', t.scenario || '', { shouldDirty: true });
            setValue('vulnerability', t.vulnerability || t.description, { shouldDirty: true });
            if (typeof t.probability === 'number') setValue('probability', t.probability as RiskFormData['probability'], { shouldDirty: true });
            if (typeof t.impact === 'number') setValue('impact', t.impact as RiskFormData['impact'], { shouldDirty: true });
            if (t.strategy) setValue('strategy', t.strategy as RiskFormData['strategy'], { shouldDirty: true });
            if (t.treatment) {
                setValue('treatment', {
                    ...t.treatment,
                    dueDate: t.treatment.dueDate || undefined
                } as RiskFormData['treatment'], { shouldDirty: true });
            }
        }
    };

    const handleSelectThreatFromLibrary = (t: ThreatTemplate) => {
        setValue('threat', t.name, { shouldDirty: true });
        setValue('scenario', t.scenario || '', { shouldDirty: true });
        setValue('vulnerability', t.vulnerability || '', { shouldDirty: true });
        if (t.framework) setValue('framework', t.framework as RiskFormData['framework'], { shouldDirty: true });
        if (t.probability) setValue('probability', t.probability as RiskFormData['probability'], { shouldDirty: true });
        if (t.impact) setValue('impact', t.impact as RiskFormData['impact'], { shouldDirty: true });
        if (t.strategy) setValue('strategy', t.strategy as RiskFormData['strategy'], { shouldDirty: true });
        if (t.field) setValue('scenario', `${t.scenario}\n\nDomaine: ${t.field}`, { shouldDirty: true });
        setShowLibraryModal(false);
    };

    const handleAutoGenerate = async () => {
        const currentThreat = getValues('threat');
        if (!currentThreat) return;
        setIsGenerating(true);
        try {
            const prompt = `Agis comme un expert en cybersécurité ISO 27005. Analyse le risque lié à la menace "${currentThreat}".
            Format JSON attendu avec des suggestions courtes:
            {
                "description": "Scénario de risque détaillé (cause, événement, conséquences)",
                "vulnerability": "Vulnérabilité technique ou organisationnelle exploitée",
                "consequences": "Impacts principaux sur la confidentialité, l'intégrité ou la disponibilité"
            }`;
            const resultText = await aiService.generateText(prompt);
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                if (data.description) setValue('vulnerability', data.description, { shouldDirty: true });
                if (data.vulnerability) setValue('vulnerability', data.vulnerability, { shouldDirty: true });
            }
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RiskForm.handleAutoGenerate', 'AI_ERROR');
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (existingRisk) {
            let resolvedOwnerId = existingRisk.ownerId || '';
            if (!resolvedOwnerId && existingRisk.owner) {
                const foundUser = usersList.find(u => u.displayName === existingRisk.owner);
                if (foundUser) resolvedOwnerId = foundUser.uid;
            }
            reset({
                ...existingRisk,
                ownerId: resolvedOwnerId,
                scenario: existingRisk.scenario || '',
                framework: existingRisk.framework || 'ISO27005',
                mitigationControlIds: existingRisk.mitigationControlIds || [],
                affectedProcessIds: existingRisk.affectedProcessIds || [],
                relatedSupplierIds: existingRisk.relatedSupplierIds || [],
                isSecureStorage: existingRisk.isSecureStorage || false
            });
        }
    }, [existingRisk, reset, usersList]);

    // Accessibility: Handle Escape key to close modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) {
                // If the library modal is open, close it first
                if (showLibraryModal) {
                    setShowLibraryModal(false);
                } else {
                    // Otherwise close the main form
                    onCancel();
                }
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isLoading, onCancel, showLibraryModal]);

    useEffect(() => {
        if (!assetId) return;
        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;

        const cia = [asset.confidentiality, asset.integrity, asset.availability];
        const recommendedImpact = Math.max(...cia.map(mapCriticalityToImpact));

        if (!isEditing) {
            const currentImpact = getValues('impact');
            const currentResidualImpact = getValues('residualImpact');
            if (currentImpact === 3 && currentResidualImpact === 3) {
                setValue('impact', recommendedImpact as Risk['impact'], { shouldDirty: true });
                setValue('residualImpact', recommendedImpact as Risk['impact'], { shouldDirty: true });
            }
        }
    }, [assetId, assets, getValues, isEditing, setValue]);

    const filteredLibraryThreats = (libraryThreats || []).filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.threat.toLowerCase().includes(searchTerm.toLowerCase())
    );



    const toggleControlSelection = (controlId: string) => {
        const currentIds = getValues('mitigationControlIds') || [];
        if (currentIds.includes(controlId)) {
            setValue('mitigationControlIds', currentIds.filter(id => id !== controlId), { shouldDirty: true });
        } else {
            setValue('mitigationControlIds', [...currentIds, controlId], { shouldDirty: true });
        }
    };



    return (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col h-full bg-transparent">
            {/* Header Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-6 pt-4">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${isActive
                                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                                : 'border-transparent text-slate-600 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {!isEditing && activeTab === 'context' && (
                    <AIAssistantHeader
                        templates={RISK_TEMPLATES.filter(t => !t.framework || t.framework === (framework || 'ISO27005'))}
                        onSelectTemplate={handleSelectTemplate}
                        onAutoGenerate={handleAutoGenerate}
                        isGenerating={isGenerating}
                        title={`Modèles de Risques (${framework || 'ISO27005'})`}
                        description="Sélectionnez un modèle standard ajusté au référentiel choisi."
                        readOnly={readOnly}
                    />
                )}

                <fieldset disabled={readOnly} className={`space-y-6 group-disabled:opacity-90 ${readOnly ? 'pointer-events-none' : ''}`}>

                    {/* TAB: CONTEXT */}
                    {activeTab === 'context' && (
                        <div className="space-y-6 glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <LayoutGrid className="h-5 w-5 text-brand-500" /> Le Contexte du Risque
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Controller
                                    name="framework"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label="Référentiel / Standard"
                                            value={field.value || ''}
                                            onChange={(val) => {
                                                field.onChange(val);
                                                setValue('threat', '');
                                                setValue('vulnerability', '');
                                            }}
                                            options={FRAMEWORK_OPTIONS}
                                            placeholder="Sélectionner un référentiel..."
                                            required
                                        />
                                    )}
                                />
                                <Controller
                                    name="assetId"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label="Actif Principal Concerné"
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            options={assets.map(a => ({ value: a.id, label: a.name, subLabel: a.type }))}
                                            required
                                            error={errors.assetId?.message}
                                        />
                                    )}
                                />
                                <Controller
                                    name="ownerId"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label="Propriétaire du Risque"
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                        />
                                    )}
                                />
                                <Controller
                                    name="affectedProcessIds"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label="Processus Métier Impactés"
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            options={processes.map(p => ({ value: p.id, label: p.name, subLabel: `RTO: ${p.rto}` }))}
                                            multiple
                                        />
                                    )}
                                />
                                <Controller
                                    name="relatedSupplierIds"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label="Fournisseurs / Tiers Concernés"
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.category }))}
                                            multiple
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB: IDENTIFICATION */}
                    {activeTab === 'identification' && (
                        <div className="space-y-6 glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText className="h-5 w-5 text-brand-500" /> Identification de la Menace
                            </h3>
                            <div className="relative">
                                <FloatingLabelInput
                                    label="Menace (Cause Potentielle)"
                                    {...control.register('threat')}
                                    list="threatsList"
                                    required
                                    error={errors.threat?.message}
                                    placeholder="Ex: Attaque par ingénierie sociale..."
                                    icon={Search}
                                />
                                <div className="absolute right-2 top-2 z-10 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowLibraryModal(true)}
                                        className="p-1 px-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg text-xs font-bold transition-colors flex items-center border border-purple-200"
                                    >
                                        <BookOpen className="h-3 w-3 mr-1" /> Biblio
                                    </button>
                                    <AIAssistButton
                                        context={{ asset: assets.find(a => a.id === getValues('assetId')), existingThreats: STANDARD_THREATS }}
                                        fieldName="Menace"
                                        prompt="Suggère une menace de sécurité pertinente pour cet actif. Réponds uniquement par le titre."
                                        onSuggest={(val: string) => setValue('threat', val, { shouldDirty: true })}
                                    />
                                </div>
                                <datalist id="threatsList">
                                    {STANDARD_THREATS.map((t) => <option key={t} value={t} />)}
                                </datalist>
                            </div>

                            <div className="relative">
                                <Controller
                                    control={control}
                                    name="vulnerability"
                                    render={({ field }) => (
                                        <RichTextEditor
                                            label="Vulnérabilité (Faiblesse)"
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={errors.vulnerability?.message}
                                        />
                                    )}
                                />
                                <div className="absolute right-2 top-2 z-10">
                                    <AIAssistButton
                                        context={{ asset: assets.find(a => a.id === getValues('assetId')), threat: getValues('threat') }}
                                        fieldName="Vulnérabilité"
                                        prompt="Décris une vulnérabilité qui permettrait cette menace. Sois concis."
                                        onSuggest={(val: string) => setValue('vulnerability', val, { shouldDirty: true })}
                                    />
                                </div>
                            </div>

                            <FloatingLabelInput
                                label="Scénario de Risque & Conséquences"
                                {...control.register('scenario')}
                                textarea
                                rows={4}
                            />
                        </div>

                    )}

                    {/* TAB: ASSESSMENT */}
                    {activeTab === 'assessment' && (
                        <div className="space-y-8 glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Activity className="h-5 w-5 text-brand-500" /> Évaluation par Matrices
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <RiskMatrixSelector
                                    label="Évaluation du Risque Brut (Inhérent)"
                                    probability={probability}
                                    impact={impact}
                                    onChange={(p, i) => {
                                        setValue('probability', p, { shouldDirty: true });
                                        setValue('impact', i, { shouldDirty: true });
                                    }}
                                />
                                <RiskMatrixSelector
                                    label="Objectif / Risque Résiduel (Cible)"
                                    probability={residualProbability || probability}
                                    impact={residualImpact || impact}
                                    onChange={(p, i) => {
                                        setValue('residualProbability', p, { shouldDirty: true });
                                        setValue('residualImpact', i, { shouldDirty: true });
                                    }}
                                />
                            </div>

                            {/* Validation Warning */}
                            {(residualProbability && residualImpact && probability && impact) &&
                                (residualProbability * residualImpact > probability * impact) && (
                                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900/50 text-sm font-bold flex items-center animate-pulse">
                                        <AlertTriangle className="h-5 w-5 mr-2" />
                                        Attention: Le risque résiduel ({residualProbability * residualImpact}) ne peut pas être supérieur au risque brut ({probability * impact}).
                                    </div>
                                )}
                        </div>
                    )}

                    {/* TAB: TREATMENT */}
                    {activeTab === 'treatment' && (
                        <div className="space-y-8 glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Layers className="h-5 w-5 text-brand-500" /> Décision & Plan de Traitement
                            </h3>

                            {/* 1. Main Treatment Plan (Source of Truth) */}
                            <RiskTreatmentPlan
                                risk={{ ...existingRisk, ...getValues() } as Risk}
                                users={usersList}
                                onUpdate={(treatment) => {
                                    // Sync Form State
                                    setValue('treatment', treatment, { shouldDirty: true });
                                    if (treatment.strategy) setValue('strategy', treatment.strategy, { shouldDirty: true });
                                    if (treatment.status) {
                                        const statusMap: Record<string, string> = {
                                            'Terminé': 'Fermé',
                                            'En cours': 'En cours',
                                            'Planifié': 'Ouvert',
                                            'Retard': 'En cours'
                                        };
                                        const mappedStatus = statusMap[treatment.status] || 'Ouvert';
                                        setValue('status', mappedStatus as Risk['status'], { shouldDirty: true });
                                    }
                                }}
                            />

                            {/* 2. Justification (Conditional) */}
                            {strategy === 'Accepter' && (probability * impact) >= 12 && (
                                <div className="space-y-2 animate-fade-in p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl">
                                    <label className="flex items-center gap-2 text-sm font-bold text-orange-800 dark:text-orange-200">
                                        <AlertTriangle className="h-4 w-4" />
                                        Justification d'Acceptation du Risque (Obligatoire)
                                    </label>
                                    <p className="text-xs text-orange-700 dark:text-orange-300">
                                        Vous vous apprêtez à accepter un risque critique (Score: {probability * impact}). Veuillez justifier cette décision pour le registre.
                                    </p>
                                    <FloatingLabelInput
                                        label="Justification d'Acceptation"
                                        {...control.register('justification')}
                                        textarea
                                        rows={3}
                                        placeholder="Expliquez pourquoi ce risque est accepté (ex: coût de traitement disproportionné, risque transitoire...)"
                                        error={errors.justification?.message}
                                    />
                                    {errors.justification && (
                                        <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-1">
                                            {errors.justification.message}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="border-t border-slate-200 dark:border-white/10 pt-6"></div>

                            {/* 3. Existing Controls Link */}
                            <div className="space-y-3">
                                <label className="flex items-center text-sm font-bold text-slate-900 dark:text-white">
                                    <Shield className="h-4 w-4 mr-2 text-brand-500" />
                                    Mesures de Sécurité Existantes (Contrôles)
                                </label>
                                <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-[250px] overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/50">
                                    {controls.length > 0 ? (
                                        controls
                                            .sort((a, b) => {
                                                const aLinked = mitigationControlIds?.includes(a.id) ? 1 : 0;
                                                const bLinked = mitigationControlIds?.includes(b.id) ? 1 : 0;
                                                if (aLinked !== bLinked) return bLinked - aLinked;

                                                const aSugg = suggestedControlIds.includes(a.id) ? 1 : 0;
                                                const bSugg = suggestedControlIds.includes(b.id) ? 1 : 0;
                                                return bSugg - aSugg;
                                            })
                                            .map(ctrl => {
                                                const isSuggested = suggestedControlIds.includes(ctrl.id);
                                                return (
                                                    <label key={ctrl.id} className={`flex items-start space-x-3 p-2 rounded-lg cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors ${mitigationControlIds?.includes(ctrl.id) ? 'bg-white dark:bg-slate-800 shadow-sm' : ''} ${isSuggested ? 'bg-purple-50/50 dark:bg-purple-900/10' : ' '}`}>
                                                        <input checked={mitigationControlIds?.includes(ctrl.id) || false} onChange={() => toggleControlSelection(ctrl.id)}
                                                            type="checkbox"
                                                            className="mt-1 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                                    {ctrl.code}
                                                                    {isSuggested && <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-1.5 rounded-full flex items-center"><Sparkles className="w-3 h-3 mr-1" /> IA</span>}
                                                                </span>
                                                                {ctrl.status === 'Implémenté' && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full">Implémenté</span>}
                                                            </div>
                                                            <span className="text-xs text-slate-600 dark:text-slate-400">{ctrl.name}</span>
                                                        </div>
                                                    </label>
                                                )
                                            })
                                    ) : (
                                        <div className="p-4 text-center text-xs text-slate-500">Aucun contrôle disponible.</div>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-500">Sélectionnez les contrôles déjà en place réduisant le risque.</p>
                            </div>
                        </div>
                    )}

                    {/* TAB: HISTORY */}
                    {activeTab === 'history' && existingRisk?.id && (
                        <div className="space-y-6 glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm">
                            <ResourceHistory resourceId={existingRisk.id} resourceType="Risk" />
                        </div>
                    )}
                </fieldset>
                {activeTab === 'history' && !existingRisk?.id && (
                    <div className="p-8 text-center text-slate-500">
                        Veuillez enregistrer le risque pour voir l'historique.
                    </div>
                )}
            </div>

            {/* Footer Buttons */}
            {!readOnly && (
                <div className="border-t border-slate-200 dark:border-white/10 p-6 bg-white dark:bg-black/40 backdrop-blur-md flex justify-between items-center">
                    <Button type="button" onClick={onCancel} variant="ghost">Annuler</Button>
                    <div className="flex gap-3">
                        {/* Navigation Buttons */}
                        {activeTab !== 'context' && (
                            <Button type="button" variant="secondary" onClick={() => {
                                const idx = TABS.findIndex(t => t.id === activeTab);
                                if (idx > 0) setActiveTab(TABS[idx - 1].id);
                            }}>Précédent</Button>
                        )}
                        {activeTab !== 'treatment' ? (
                            <Button type="button" onClick={() => {
                                const idx = TABS.findIndex(t => t.id === activeTab);
                                if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
                            }}>Suivant</Button>
                        ) : (
                            <div className="flex gap-2">

                                <Button
                                    type="submit"
                                    isLoading={isLoading}
                                    disabled={isLoading}
                                    className="px-8 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl hover:scale-105 transition-transform shadow-lg shadow-brand-500/20 font-bold text-sm"
                                >
                                    {isEditing ? 'Sauvegarder' : 'Créer le Risque'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Threat Library Modal */}
            <Modal
                isOpen={showLibraryModal}
                onClose={() => setShowLibraryModal(false)}
                title="Bibliothèque de Menaces"
                maxWidth="max-w-4xl"
            >
                <div className="p-4">
                    <div className="relative mb-4">
                        <FloatingLabelInput
                            label="Rechercher une menace..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            icon={Search}
                        />
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredLibraryThreats.map((t) => (
                            <div
                                key={t.id}
                                onClick={() => handleSelectThreatFromLibrary(t)}
                                className="border border-slate-200 dark:border-white/10 p-4 rounded-xl hover:border-brand-500 cursor-pointer bg-white dark:bg-slate-800 transition-all hover:shadow-md group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-brand-500" />
                                        <span className="font-bold text-slate-900 dark:text-white line-clamp-1">{t.name}</span>
                                    </div>
                                    <span className="text-[10px] uppercase font-bold text-slate-500 border px-1.5 py-0.5 rounded">{t.framework}</span>
                                </div>
                                <p className="text-xs text-slate-600 line-clamp-2 mb-2">{t.description}</p>
                                <div className="flex gap-2 text-[10px] text-slate-500">
                                    <span className="bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded">Score Ref: {t.probability * t.impact}</span>
                                    <span className="bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded truncate flex-1">{t.strategy}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </form >
    );
};

