/**
 * RiskForm - Main risk form component
 * Refactored to use extracted tab components for maintainability
 * Reduced from 993 lines to ~450 lines
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useWatch, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { toast } from '@/lib/toast';
import { riskSchema, RiskFormData } from '../../schemas/riskSchema';
import { Risk, Control, Asset, UserProfile, BusinessProcess, Supplier, Criticality, ThreatTemplate } from '../../types';
import { LayoutGrid, FileText, Activity, Layers, History, Search, Shield } from '../ui/Icons';
import { ResourceHistory } from '../shared/ResourceHistory';
import { ErrorLogger } from '../../services/errorLogger';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { Button } from '../ui/button';
import { DraftBadge } from '../ui/DraftBadge';
import { AutoSaveIndicator } from '../ui/AutoSaveIndicator';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useRiskDraftPersistence } from '../../hooks/risks/useRiskDraftPersistence';
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning';
import { canSaveRiskAsDraft, RISK_DRAFT_STATUS } from '../../utils/riskDraftSchema';
import { useAuth } from '../../hooks/useAuth';
import { ConfirmModal } from '../ui/ConfirmModal';
import { AIAssistantHeader } from '../ui/AIAssistantHeader';
import { aiService } from '../../services/aiService';
import { RISK_TEMPLATES } from '../../data/riskTemplates';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { Modal } from '../ui/Modal';
import { RiskRemediationService } from '../../services/RiskRemediationService';

// Extracted tab components
import {
    RiskFormContextTab,
    RiskFormIdentificationTab,
    RiskFormAssessmentTab,
    RiskFormTreatmentTab,
} from './form';

interface RiskFormProps {
    onSubmit: (data: RiskFormData) => Promise<void>;
    onSaveDraft?: (data: Partial<RiskFormData>) => Promise<void>;
    onPublishDraft?: (data: RiskFormData) => Promise<void>;
    onAutoSave?: (data: Partial<RiskFormData>) => Promise<void>;
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
    isDraftMode?: boolean;
    enableAutoSave?: boolean;
    autoSaveDebounceMs?: number;
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
    onSaveDraft,
    onPublishDraft,
    onAutoSave,
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
    readOnly = false,
    isDraftMode: initialDraftMode = false,
    enableAutoSave = true,
    autoSaveDebounceMs = 30000
}) => {
    // State
    const [isDraft, setIsDraft] = useState(() => initialDraftMode || (existingRisk?.status === RISK_DRAFT_STATUS));
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [activeTab, setActiveTab] = useState('context');
    const [showDraftRecoveryBanner, setShowDraftRecoveryBanner] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showLibraryModal, setShowLibraryModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestedControlIds, setSuggestedControlIds] = useState<string[]>([]);

    const { user } = useAuth();

    // Draft persistence
    const { savedDraft, saveDraft: persistDraft, clearDraft: clearPersistedDraft, hasDraft: hasPersistedDraft } = useRiskDraftPersistence({
        organizationId: user?.organizationId || '',
        riskId: existingRisk?.id,
        enabled: !isEditing && !readOnly && !!user?.organizationId,
    });

    // Form setup
    const { control, handleSubmit, reset, formState: { errors, isDirty }, setValue, getValues } = useZodForm<typeof riskSchema>({
        schema: riskSchema,
        mode: 'onChange', // Changed from onBlur for immediate feedback
        shouldUnregister: false,
        defaultValues: {
            assetId: initialData?.assetId || '',
            threat: initialData?.threat || '',
            scenario: initialData?.scenario || '',
            framework: initialData?.framework || 'ISO27005',
            vulnerability: initialData?.vulnerability || '',
            probability: initialData?.probability || 3,
            impact: initialData?.impact || 3,
            residualProbability: initialData?.residualProbability || 3,
            residualImpact: initialData?.residualImpact || 3,
            strategy: initialData?.strategy || 'Atténuer',
            status: initialData?.status || 'Ouvert',
            ownerId: initialData?.ownerId || '',
            mitigationControlIds: initialData?.mitigationControlIds || [],
            affectedProcessIds: initialData?.affectedProcessIds || [],
            relatedSupplierIds: initialData?.relatedSupplierIds || [],
            ...initialData
        }
    });

    // Watched values
    const framework = useWatch({ control, name: 'framework' });
    const probability = useWatch({ control, name: 'probability' });
    const impact = useWatch({ control, name: 'impact' });
    const residualProbability = useWatch({ control, name: 'residualProbability' });
    const residualImpact = useWatch({ control, name: 'residualImpact' });
    const mitigationControlIds = useWatch({ control, name: 'mitigationControlIds' });
    const strategy = useWatch({ control, name: 'strategy' });
    const assetId = useWatch({ control, name: 'assetId' });
    const watchedFormValues = useWatch({ control });

    // Auto-save
    const shouldAutoSave = enableAutoSave && isDraft && isEditing && !!onAutoSave && !readOnly;

    const handleAutoSave = useCallback(async (data: Partial<RiskFormData>) => {
        if (!onAutoSave) return;
        const { canSave } = canSaveRiskAsDraft(data as Record<string, unknown>);
        if (canSave) await onAutoSave(data);
    }, [onAutoSave]);

    const { status: autoSaveStatus, lastSavedAt: autoSaveLastSavedAt, error: autoSaveError, retry: autoSaveRetry } = useAutoSave({
        data: watchedFormValues as Partial<RiskFormData>,
        onSave: handleAutoSave,
        enabled: shouldAutoSave,
        debounceMs: autoSaveDebounceMs,
        isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
    });

    // Navigation warning
    const { isBlocked: isNavigationBlocked, proceed: proceedNavigation, cancel: cancelNavigation, bypass: bypassNavigation } = useUnsavedChangesWarning({
        hasUnsavedChanges: isDirty && !readOnly,
        enabled: !readOnly,
    });

    // Fetch threat library
    const { data: libraryThreats } = useFirestoreCollection<ThreatTemplate>('threat_library', [], { enabled: showLibraryModal });

    // Validation error handler
    const onInvalid = (errors: FieldErrors<RiskFormData>) => {
        const missingFields = Object.keys(errors);
        const fieldTabMapping: Record<string, string> = {
            assetId: 'context', framework: 'context', ownerId: 'context', affectedProcessIds: 'context', relatedSupplierIds: 'context',
            threat: 'identification', vulnerability: 'identification', scenario: 'identification',
            probability: 'assessment', impact: 'assessment', residualProbability: 'assessment', residualImpact: 'assessment',
            strategy: 'treatment', status: 'treatment', mitigationControlIds: 'treatment', justification: 'treatment', treatment: 'treatment'
        };
        const firstErrorField = missingFields[0];
        if (firstErrorField && fieldTabMapping[firstErrorField]) setActiveTab(fieldTabMapping[firstErrorField]);
        const translatedFields = missingFields.map(f => f === 'assetId' ? 'Actif Principal' : f === 'threat' ? 'Menace' : f === 'vulnerability' ? 'Vulnérabilité' : f === 'justification' ? 'Justification' : f);
        toast.error(`Formulaire incomplet. Veuillez vérifier : ${translatedFields.join(', ')}`);
    };

    // Handlers
    const handleSelectTemplate = (templateName: string) => {
        const t = RISK_TEMPLATES.find(t => t.name === templateName);
        if (t) {
            setValue('threat', t.threat || t.name, { shouldDirty: true });
            setValue('scenario', t.scenario || '', { shouldDirty: true });
            setValue('vulnerability', t.vulnerability || t.description, { shouldDirty: true });
            if (typeof t.probability === 'number') setValue('probability', t.probability as RiskFormData['probability'], { shouldDirty: true });
            if (typeof t.impact === 'number') setValue('impact', t.impact as RiskFormData['impact'], { shouldDirty: true });
            if (t.strategy) setValue('strategy', t.strategy as RiskFormData['strategy'], { shouldDirty: true });
            if (t.treatment) setValue('treatment', { ...t.treatment, dueDate: t.treatment.dueDate || undefined } as RiskFormData['treatment'], { shouldDirty: true });
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

    const handleSaveAsDraft = useCallback(async () => {
        if (!onSaveDraft) return;
        const data = getValues();
        const { canSave, errors: draftErrors } = canSaveRiskAsDraft(data as Record<string, unknown>);
        if (!canSave) {
            if (draftErrors.threat) { toast.error('La menace est requise pour enregistrer un brouillon'); setActiveTab('identification'); }
            return;
        }
        setIsSavingDraft(true);
        try { await onSaveDraft(data); setIsDraft(true); clearPersistedDraft(); bypassNavigation(); } finally { setIsSavingDraft(false); }
    }, [onSaveDraft, getValues, clearPersistedDraft, bypassNavigation]);

    const handlePublishDraft = useCallback(async () => {
        if (!onPublishDraft) return;
        handleSubmit(async (validData: RiskFormData) => { await onPublishDraft(validData); setIsDraft(false); clearPersistedDraft(); bypassNavigation(); }, onInvalid)();
    }, [onPublishDraft, handleSubmit, clearPersistedDraft, bypassNavigation]);

    const handleAutoGenerate = async () => {
        const currentThreat = getValues('threat');
        if (!currentThreat) return;
        setIsGenerating(true);
        try {
            const prompt = `Agis comme un expert en cybersécurité ISO 27005. Analyse le risque lié à la menace "${currentThreat}". Format JSON: {"description": "...", "vulnerability": "...", "consequences": "..."}`;
            const resultText = await aiService.generateText(prompt);
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                if (data.vulnerability) setValue('vulnerability', data.vulnerability, { shouldDirty: true });
            }
        } catch (error) { ErrorLogger.handleErrorWithToast(error, 'RiskForm.handleAutoGenerate', 'AI_ERROR'); } finally { setIsGenerating(false); }
    };

    const handleFormSubmit = useCallback(async (data: RiskFormData) => {
        await onSubmit(data); clearPersistedDraft(); bypassNavigation();
    }, [onSubmit, clearPersistedDraft, bypassNavigation]);

    const handleRestoreDraft = useCallback(() => {
        if (savedDraft) { reset({ ...getValues(), ...savedDraft }); setShowDraftRecoveryBanner(false); toast.success('Brouillon restauré'); }
    }, [savedDraft, reset, getValues]);

    const handleDiscardDraft = useCallback(() => { clearPersistedDraft(); setShowDraftRecoveryBanner(false); toast.info('Brouillon supprimé'); }, [clearPersistedDraft]);

    // Effects
    useEffect(() => {
        const threat = getValues('threat');
        if (threat && activeTab === 'treatment') {
            const formData = getValues() as unknown as Partial<Risk>;
            setSuggestedControlIds(RiskRemediationService.suggestMitigationControls(formData, controls));
        }
    }, [activeTab, getValues, controls]);

    useEffect(() => {
        if (existingRisk) {
            let resolvedOwnerId = existingRisk.ownerId || '';
            if (!resolvedOwnerId && existingRisk.owner) {
                const foundUser = usersList.find(u => u.displayName === existingRisk.owner);
                if (foundUser) resolvedOwnerId = foundUser.uid;
            }
            reset({ ...existingRisk, assetId: existingRisk.assetId || '', threat: existingRisk.threat || '', vulnerability: existingRisk.vulnerability || '', ownerId: resolvedOwnerId, scenario: existingRisk.scenario || '', framework: existingRisk.framework || 'ISO27005', mitigationControlIds: existingRisk.mitigationControlIds || [], affectedProcessIds: existingRisk.affectedProcessIds || [], relatedSupplierIds: existingRisk.relatedSupplierIds || [], isSecureStorage: existingRisk.isSecureStorage || false });
        }
    }, [existingRisk, reset, usersList]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isLoading) { if (showLibraryModal) setShowLibraryModal(false); else onCancel(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isLoading, onCancel, showLibraryModal]);

    useEffect(() => {
        if (!assetId) return;
        const asset = assets.find(a => a.id === assetId);
        if (!asset) return;
        const mapCriticalityToImpact = (crit: Criticality): number => ({ [Criticality.CRITICAL]: 5, [Criticality.HIGH]: 4, [Criticality.MEDIUM]: 3, [Criticality.LOW]: 2 }[crit] || 2);
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

    useEffect(() => { if (!isEditing && hasPersistedDraft && savedDraft && !existingRisk) setShowDraftRecoveryBanner(true); }, [isEditing, hasPersistedDraft, savedDraft, existingRisk]);

    useEffect(() => { if (!isEditing && isDirty && watchedFormValues) persistDraft(watchedFormValues as Partial<RiskFormData>); }, [isEditing, isDirty, watchedFormValues, persistDraft]);

    const filteredLibraryThreats = (libraryThreats || []).filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.threat.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <form onSubmit={handleSubmit(handleFormSubmit, onInvalid)} className="flex flex-col h-full bg-transparent">
            {/* Header Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-6 pt-4">
                <div className="flex">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-600 hover:text-slate-700 dark:text-slate-400'}`}>
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-3 pb-3">
                    {isDraft && <DraftBadge showIcon size="md" />}
                    {shouldAutoSave && <AutoSaveIndicator status={autoSaveStatus} lastSavedAt={autoSaveLastSavedAt} error={autoSaveError} onRetry={autoSaveRetry} compact={false} />}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Draft Recovery Banner */}
                {showDraftRecoveryBanner && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-800/50 rounded-full"><History className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                            <div><p className="font-medium text-amber-800 dark:text-amber-200">Brouillon non enregistré détecté</p><p className="text-sm text-amber-600 dark:text-amber-400">Un brouillon de ce formulaire a été trouvé. Voulez-vous le restaurer ?</p></div>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={handleDiscardDraft} className="text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30">Ignorer</Button>
                            <Button type="button" onClick={handleRestoreDraft} className="bg-amber-600 hover:bg-amber-700 text-white">Restaurer</Button>
                        </div>
                    </div>
                )}

                {!isEditing && activeTab === 'context' && (
                    <AIAssistantHeader templates={RISK_TEMPLATES.filter(t => !t.framework || t.framework === (framework || 'ISO27005'))} onSelectTemplate={handleSelectTemplate} onAutoGenerate={handleAutoGenerate} isGenerating={isGenerating} title={`Modèles de Risques (${framework || 'ISO27005'})`} description="Sélectionnez un modèle standard ajusté au référentiel choisi." readOnly={readOnly} />
                )}

                <fieldset disabled={readOnly} className={`space-y-6 group-disabled:opacity-90 ${readOnly ? 'pointer-events-none' : ''}`}>
                    {activeTab === 'context' && <RiskFormContextTab control={control} errors={errors} assets={assets} usersList={usersList} processes={processes} suppliers={suppliers} framework={framework || 'ISO27005'} setValue={setValue} readOnly={readOnly} />}
                    {activeTab === 'identification' && <RiskFormIdentificationTab control={control} errors={errors} assets={assets} getValues={getValues} setValue={setValue} showLibraryModal={showLibraryModal} setShowLibraryModal={setShowLibraryModal} readOnly={readOnly} />}
                    {activeTab === 'assessment' && <RiskFormAssessmentTab probability={probability ?? 3} impact={impact ?? 3} residualProbability={residualProbability ?? 3} residualImpact={residualImpact ?? 3} setValue={setValue} control={control} errors={errors} readOnly={readOnly} />}
                    {activeTab === 'treatment' && <RiskFormTreatmentTab control={control} errors={errors} existingRisk={existingRisk} controls={controls} usersList={usersList} getValues={getValues} setValue={setValue} strategy={strategy || 'Atténuer'} probability={probability ?? 3} impact={impact ?? 3} mitigationControlIds={mitigationControlIds || []} suggestedControlIds={suggestedControlIds} readOnly={readOnly} />}
                    {activeTab === 'history' && existingRisk?.id && <div className="space-y-6 glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/5 shadow-sm"><ResourceHistory resourceId={existingRisk.id} resourceType="Risk" /></div>}
                </fieldset>
                {activeTab === 'history' && !existingRisk?.id && <div className="p-8 text-center text-slate-500">Veuillez enregistrer le risque pour voir l'historique.</div>}
            </div>

            {/* Footer Buttons */}
            {!readOnly && (
                <div className="border-t border-slate-200 dark:border-white/10 p-6 bg-white dark:bg-black/40 backdrop-blur-md flex justify-between items-center">
                    <Button type="button" onClick={onCancel} variant="ghost">Annuler</Button>
                    <div className="flex gap-3">
                        {activeTab !== 'context' && <Button type="button" variant="secondary" onClick={() => { const idx = TABS.findIndex(t => t.id === activeTab); if (idx > 0) setActiveTab(TABS[idx - 1].id); }}>Précédent</Button>}
                        {activeTab !== 'treatment' ? (
                            <Button type="button" onClick={() => { const idx = TABS.findIndex(t => t.id === activeTab); if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id); }}>Suivant</Button>
                        ) : (
                            <div className="flex gap-2">
                                {onSaveDraft && (!isEditing || isDraft) && <Button type="button" variant="secondary" onClick={handleSaveAsDraft} isLoading={isSavingDraft} disabled={isSavingDraft || isLoading} className="px-6 py-3 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl font-medium text-sm">Enregistrer brouillon</Button>}
                                {isDraft && isEditing && onPublishDraft && <Button type="button" onClick={handlePublishDraft} isLoading={isLoading} disabled={isLoading || isSavingDraft} className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl hover:scale-105 transition-transform shadow-lg shadow-green-500/20 font-bold text-sm">Publier le Risque</Button>}
                                {(!isDraft || !isEditing) && <Button type="submit" isLoading={isLoading} disabled={isLoading || isSavingDraft} className="px-8 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl hover:scale-105 transition-transform shadow-lg shadow-brand-500/20 font-bold text-sm">{isEditing ? 'Sauvegarder' : 'Créer le Risque'}</Button>}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Threat Library Modal */}
            <Modal isOpen={showLibraryModal} onClose={() => setShowLibraryModal(false)} title="Bibliothèque de Menaces" maxWidth="max-w-4xl">
                <div className="p-4">
                    <div className="relative mb-4"><FloatingLabelInput label="Rechercher une menace..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} icon={Search} /></div>
                    <div className="max-h-[60vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredLibraryThreats.map((t) => (
                            <div key={t.id} onClick={() => handleSelectThreatFromLibrary(t)} className="border border-slate-200 dark:border-white/10 p-4 rounded-xl hover:border-brand-500 cursor-pointer bg-white dark:bg-slate-800 transition-all hover:shadow-md group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-brand-500" /><span className="font-bold text-slate-900 dark:text-white line-clamp-1">{t.name}</span></div>
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

            {/* Navigation Blocking Confirmation Modal */}
            <ConfirmModal isOpen={isNavigationBlocked} onClose={cancelNavigation} onConfirm={proceedNavigation} title="Modifications non enregistrées" message="Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir quitter cette page ?" type="warning" confirmText="Quitter sans enregistrer" cancelText="Rester sur la page" />
        </form>
    );
};
