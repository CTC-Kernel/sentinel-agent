
import React, { useEffect, useState } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { riskSchema, RiskFormData } from '../../schemas/riskSchema';
import { Risk, Control, Asset, UserProfile, BusinessProcess, Supplier, Criticality, ThreatTemplate } from '../../types';
import { BookOpen, Shield, Search, LayoutGrid, FileText, Activity, Layers, AlertTriangle, Sparkles } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { RiskMatrixSelector } from './RiskMatrixSelector';
import { AIAssistButton } from '../ai/AIAssistButton';
import { RiskTreatmentPlan } from './RiskTreatmentPlan';
import { Button } from '../ui/button';
import { RichTextEditor } from '../ui/RichTextEditor';
import { STANDARD_THREATS, RISK_STRATEGIES, RISK_STATUSES } from '../../data/riskConstants';
import { AIAssistantHeader } from '../ui/AIAssistantHeader';
import { aiService } from '../../services/aiService';
import { RISK_TEMPLATES } from '../../data/riskTemplates';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
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
}

const TABS = [
    { id: 'context', label: 'Contexte & Actifs', icon: LayoutGrid },
    { id: 'identification', label: 'Identification', icon: FileText },
    { id: 'assessment', label: 'Évaluation', icon: Activity },
    { id: 'treatment', label: 'Traitement & Contrôles', icon: Layers },
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
    isLoading = false
}) => {
    const [activeTab, setActiveTab] = useState('context');
    const { control, handleSubmit, reset, formState: { errors }, setValue, getValues } = useForm<RiskFormData>({
        resolver: zodResolver(riskSchema),
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

    const framework = useWatch({ control, name: 'framework' });
    const probability = useWatch({ control, name: 'probability' });
    const impact = useWatch({ control, name: 'impact' });
    const residualProbability = useWatch({ control, name: 'residualProbability' });
    const residualImpact = useWatch({ control, name: 'residualImpact' });
    const mitigationControlIds = useWatch({ control, name: 'mitigationControlIds' });
    const strategy = useWatch({ control, name: 'strategy' });
    const status = useWatch({ control, name: 'status' });
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
    const [libraryThreats, setLibraryThreats] = React.useState<ThreatTemplate[]>([]);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [suggestedControlIds, setSuggestedControlIds] = React.useState<string[]>([]);

    useEffect(() => {
        const threat = getValues('threat');
        if (threat && activeTab === 'treatment') {
            // Cast to generic object to avoid strict Risk type matching issues with form data
            const formData = getValues() as unknown as Partial<Risk>;
            const suggestions = RiskRemediationService.suggestMitigationControls(formData, controls);
            setSuggestedControlIds(suggestions);
        }
    }, [activeTab, getValues, controls]);

    useEffect(() => {
        if (showLibraryModal && libraryThreats.length === 0) {
            const fetchThreats = async () => {
                const snap = await getDocs(collection(db, 'threat_library'));
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ThreatTemplate));
                setLibraryThreats(list);
            };
            fetchThreats();
        }
    }, [showLibraryModal, libraryThreats.length]);

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
            const prompt = `Analayse le risque de menace "${currentThreat}".
            Format JSON attendu avec des suggestions courtes:
            {
                "description": "Description succincte du risque",
                "vulnerability": "Vulnérabilité exploitée potentielle",
                "consequences": "Impact principal"
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

    const filteredLibraryThreats = libraryThreats.filter(t =>
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
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full bg-slate-50 dark:bg-black/20">
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
                    />
                )}

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
                                        value={field.value}
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
                                {STANDARD_THREATS.map((t, i) => <option key={i} value={t} />)}
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

                        <div className="relative">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Scénario de Risque & Conséquences
                            </label>
                            <textarea
                                {...control.register('scenario')}
                                rows={4}
                                className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500"
                                placeholder="Décrivez le déroulement de l'incident et ses impacts potentiels..."
                            />
                        </div>
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

                        {/* Strategy & Status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Stratégie</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {RISK_STRATEGIES.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setValue('strategy', s as Risk['strategy'], { shouldDirty: true })}
                                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${strategy === s ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Statut Actuel</label>
                                <div className="flex gap-2">
                                    {RISK_STATUSES.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setValue('status', s as Risk['status'], { shouldDirty: true })}
                                            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SLA & Treatment Plan Details */}
                        {strategy !== 'Accepter' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl border border-brand-100 dark:border-brand-900/30 bg-brand-50/50 dark:bg-brand-900/10">
                                <Controller
                                    name="treatmentDeadline"
                                    control={control}
                                    render={({ field }) => (
                                        <FloatingLabelInput
                                            label="Échéance du Traitement (SLA)"
                                            type="date"
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            required={(strategy as string) !== 'Accepter'}
                                            error={errors.treatmentDeadline?.message}
                                        />
                                    )}
                                />
                                <Controller
                                    name="treatmentOwnerId"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label="Responsable du Traitement"
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            options={usersList.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                            placeholder="Sélectionner un responsable..."
                                        />
                                    )}
                                />
                            </div>
                        )}

                        {/* Justification Field - Required for High Risks Acceptance */}
                        {strategy === 'Accepter' && (probability * impact) >= 12 && (
                            <div className="space-y-2 animate-fade-in p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl">
                                <label className="flex items-center gap-2 text-sm font-bold text-orange-800 dark:text-orange-200">
                                    <AlertTriangle className="h-4 w-4" />
                                    Justification d'Acceptation du Risque (Obligatoire)
                                </label>
                                <p className="text-xs text-orange-700 dark:text-orange-300">
                                    Vous vous apprêtez à accepter un risque critique (Score: {probability * impact}). Veuillez justifier cette décision pour le registre.
                                </p>
                                <textarea
                                    {...control.register('justification')}
                                    rows={3}
                                    className="w-full rounded-lg border-orange-300 dark:border-orange-800 bg-white dark:bg-black/20 text-sm focus:ring-2 focus:ring-orange-500"
                                    placeholder="Expliquez pourquoi ce risque est accepté (ex: coût de traitement disproportionné, risque transitoire...)"
                                />
                                {errors.justification && (
                                    <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-1">
                                        {errors.justification.message}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Existing Controls */}
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
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                        checked={mitigationControlIds?.includes(ctrl.id) || false}
                                                        onChange={() => toggleControlSelection(ctrl.id)}
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

                        <div className="border-t border-slate-200 dark:border-white/10 pt-6">
                            <RiskTreatmentPlan
                                risk={{ ...existingRisk, ...getValues() } as Risk}
                                users={usersList}
                                onUpdate={(treatment) => {
                                    setValue('strategy', treatment.strategy || 'Atténuer', { shouldDirty: true });
                                    setValue('status', treatment.status === 'Terminé' ? 'Fermé' : treatment.status === 'En cours' ? 'En cours' : 'Ouvert', { shouldDirty: true });
                                    setValue('treatment', treatment, { shouldDirty: true });
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Buttons */}
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
                        <Button type="submit" isLoading={isLoading} className="bg-brand-600 hover:bg-brand-700 text-white">
                            {isEditing ? 'Sauvegarder' : 'Créer le Risque'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Threat Library Modal */}
            <Modal
                isOpen={showLibraryModal}
                onClose={() => setShowLibraryModal(false)}
                title="Bibliothèque de Menaces"
                maxWidth="max-w-4xl"
            >
                <div className="p-4">
                    <div className="relative mb-4">
                        <Search className="h-5 w-5 text-slate-500 absolute left-3 top-3" />
                        <input
                            type="text"
                            placeholder="Rechercher une menace type..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
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

