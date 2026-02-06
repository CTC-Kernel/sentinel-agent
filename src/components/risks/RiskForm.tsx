/**
 * RiskForm - Main risk form component
 * Refactored to use extracted tab components for maintainability
 * Reduced from 993 lines to ~450 lines
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { RiskStrategy } from '@/constants/RiskConstants';
import { useWatch, FieldErrors } from 'react-hook-form';
import { useZodForm } from '../../hooks/useZodForm';
import { toast } from '@/lib/toast';
import { riskSchema, RiskFormData } from '../../schemas/riskSchema';
import { Risk, Control, Asset, UserProfile, BusinessProcess, Supplier, Criticality, ThreatTemplate } from '../../types';
import { LayoutGrid, FileText, Activity, Layers, History, Search, Shield, AlertTriangle } from '../ui/Icons';
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
 onDirtyChange?: (isDirty: boolean) => void;
}


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
 autoSaveDebounceMs = 30000,
 onDirtyChange
}) => {
 const { t } = useLocale();

 // State
 const [isDraft, setIsDraft] = useState(() => initialDraftMode || (existingRisk?.status === RISK_DRAFT_STATUS));
 const [isSavingDraft, setIsSavingDraft] = useState(false);
 const [activeTab, setActiveTab] = useState('context');
 const [showDraftRecoveryBanner, setShowDraftRecoveryBanner] = useState(false);
 const [isGenerating, setIsGenerating] = useState(false);
 const [showLibraryModal, setShowLibraryModal] = useState(false);
 const [searchTerm, setSearchTerm] = useState('');
 const [suggestedControlIds, setSuggestedControlIds] = useState<string[]>([]);

 const TABS = [
 { id: 'context', label: t('risks.tabs.context', { defaultValue: 'Contexte & Actifs' }), icon: LayoutGrid },
 { id: 'identification', label: t('risks.tabs.identification', { defaultValue: 'Identification' }), icon: FileText },
 { id: 'assessment', label: t('risks.tabs.assessment', { defaultValue: 'Évaluation' }), icon: Activity },
 { id: 'treatment', label: t('risks.tabs.treatment', { defaultValue: 'Traitement & Contrôles' }), icon: Layers },
 { id: 'history', label: t('common.history', { defaultValue: 'Historique' }), icon: History },
 ];

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
 strategy: initialData?.strategy || RiskStrategy.MITIGATE,
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

 useEffect(() => {
 onDirtyChange?.(isDirty);
 }, [isDirty, onDirtyChange]);

 // Navigation warning
 const { isBlocked: isNavigationBlocked, proceed: proceedNavigation, cancel: cancelNavigation, bypass: bypassNavigation } = useUnsavedChangesWarning({
 hasUnsavedChanges: isDirty && !readOnly,
 enabled: !readOnly,
 });

 // Fetch threat library
 const { data: libraryThreats } = useFirestoreCollection<ThreatTemplate>('threat_library', [], { enabled: showLibraryModal });

 // Validation error handler
 const onInvalid = useCallback((errors: FieldErrors<RiskFormData>) => {
 const missingFields = Object.keys(errors);
 const fieldTabMapping: Record<string, string> = {
 assetId: 'context', framework: 'context', ownerId: 'context', affectedProcessIds: 'context', relatedSupplierIds: 'context',
 threat: 'identification', vulnerability: 'identification', scenario: 'identification',
 probability: 'assessment', impact: 'assessment', residualProbability: 'assessment', residualImpact: 'assessment',
 strategy: 'treatment', status: 'treatment', mitigationControlIds: 'treatment', justification: 'treatment', treatment: 'treatment'
 };
 const firstErrorField = missingFields[0];
 if (firstErrorField && fieldTabMapping[firstErrorField]) setActiveTab(fieldTabMapping[firstErrorField]);

 // Auto-scroll to the first error field after tab switch
 setTimeout(() => {
 const firstError = document.querySelector('[aria-invalid="true"]');
 if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
 }, 100);

 const fieldLabels: Record<string, string> = {
 assetId: t('common.assets', { defaultValue: 'Actifs' }),
 threat: t('common.threat', { defaultValue: 'Menace' }),
 vulnerability: t('common.vulnerability', { defaultValue: 'Vulnérabilité' }),
 justification: t('risks.validation_justification', { defaultValue: 'Justification' })
 };

 const translatedFields = missingFields.map(f => fieldLabels[f] || f);
 toast.error(`${t('validation.required', { defaultValue: 'Champs requis' })}: ${translatedFields.join(', ')}`);
 }, [t, setActiveTab]);

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
 if (draftErrors.threat) { toast.error(t('risks.validation_threat_required', { defaultValue: 'La menace est requise pour enregistrer un brouillon' })); setActiveTab('identification'); }
 return;
 }
 setIsSavingDraft(true);
 try { await onSaveDraft(data); setIsDraft(true); clearPersistedDraft(); bypassNavigation(); } finally { setIsSavingDraft(false); }
 }, [onSaveDraft, getValues, clearPersistedDraft, bypassNavigation, t, setActiveTab]);

 const handlePublishDraft = useCallback(async () => {
 if (!onPublishDraft) return;
 handleSubmit(async (validData: RiskFormData) => { await onPublishDraft(validData); setIsDraft(false); clearPersistedDraft(); bypassNavigation(); }, onInvalid)();
 }, [onPublishDraft, handleSubmit, clearPersistedDraft, bypassNavigation, onInvalid]);

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
 if (savedDraft) { reset({ ...getValues(), ...savedDraft }); setShowDraftRecoveryBanner(false); toast.success(t('risks.draftRestored', { defaultValue: 'Brouillon restauré' })); }
 }, [savedDraft, reset, getValues, t]);

 const handleDiscardDraft = useCallback(() => { clearPersistedDraft(); setShowDraftRecoveryBanner(false); toast.info(t('risks.draftDiscarded', { defaultValue: 'Brouillon supprimé' })); }, [clearPersistedDraft, t]);

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
 <div className="flex items-center justify-between border-b border-border/40 bg-white dark:bg-transparent px-6 pt-4">
 <div className="flex overflow-x-auto scrollbar-hide pb-1 -mb-1">
  {TABS.map((tab) => {
  const Icon = tab.icon;
  return (
  <button key={tab.id || 'unknown'} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all duration-normal ease-apple ${activeTab === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
  <Icon className={`h-4 w-4 transition-colors ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
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
 {/* Form Error Summary */}
 {Object.keys(errors).length > 0 && (
  <div className="p-4 bg-error/10 border border-error/20 rounded-xl animate-fade-in" role="alert">
  <div className="flex items-center gap-3">
  <div className="p-2 bg-error/20 rounded-lg"><AlertTriangle className="h-5 w-5 text-error" /></div>
  <div>
  <p className="font-bold text-error text-sm">{t('validation.formErrors', { defaultValue: 'Erreurs de validation' })}</p>
  <ul className="text-xs text-muted-foreground mt-1 list-disc ml-4">
   {Object.entries(errors).map(([field, error]) => (
   <li key={field || 'unknown'}>{String(error?.message || field)}</li>
   ))}
  </ul>
  </div>
  </div>
  </div>
 )}

 {/* Draft Recovery Banner */}
 {showDraftRecoveryBanner && (
  <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl flex items-center justify-between animate-fade-in">
  <div className="flex items-center gap-3">
  <div className="p-2 bg-warning/20 rounded-lg"><History className="h-5 w-5 text-warning" /></div>
  <div><p className="font-bold text-warning text-sm">{t('risks.draftDetected', { defaultValue: 'Brouillon non enregistré détecté' })}</p><p className="text-xs text-muted-foreground">{t('risks.draftDetectedDesc', { defaultValue: 'Un brouillon de ce formulaire a été trouvé. Voulez-vous le restaurer ?' })}</p></div>
  </div>
  <div className="flex gap-2">
  <Button type="button" variant="ghost" onClick={handleDiscardDraft} className="text-warning hover:bg-warning/10">{t('riskForm.draftIgnore', { defaultValue: 'Ignorer' })}</Button>
  <Button type="button" onClick={handleRestoreDraft} className="bg-warning hover:bg-warning/90 text-white rounded-lg">{t('riskForm.draftRestore', { defaultValue: 'Restaurer' })}</Button>
  </div>
  </div>
 )}

 {!isEditing && activeTab === 'context' && (
  <AIAssistantHeader templates={RISK_TEMPLATES.filter(t => !t.framework || t.framework === (framework || 'ISO27005'))} onSelectTemplate={handleSelectTemplate} onAutoGenerate={handleAutoGenerate} isGenerating={isGenerating} title={t('risks.riskTemplatesTitle', { defaultValue: 'Modèles de Risques', framework: framework || 'ISO27005' }) + ` (${framework || 'ISO27005'})`} description={t('risks.riskTemplatesDescription', { defaultValue: 'Sélectionnez un modèle standard ajusté au référentiel choisi.' })} readOnly={readOnly} />
 )}

 <fieldset disabled={readOnly} className={`space-y-6 disabled:text-muted-foreground ${readOnly ? 'pointer-events-none' : ''}`}>
  {activeTab === 'context' && <RiskFormContextTab control={control} errors={errors} assets={assets} usersList={usersList} processes={processes} suppliers={suppliers} framework={framework || 'ISO27005'} setValue={setValue} readOnly={readOnly} />}
  {activeTab === 'identification' && <RiskFormIdentificationTab control={control} errors={errors} assets={assets} getValues={getValues} setValue={setValue} showLibraryModal={showLibraryModal} setShowLibraryModal={setShowLibraryModal} readOnly={readOnly} />}
  {activeTab === 'assessment' && <RiskFormAssessmentTab probability={probability ?? 3} impact={impact ?? 3} residualProbability={residualProbability ?? 3} residualImpact={residualImpact ?? 3} setValue={setValue} control={control} errors={errors} readOnly={readOnly} />}
  {activeTab === 'treatment' && <RiskFormTreatmentTab control={control} errors={errors} existingRisk={existingRisk} controls={controls} usersList={usersList} getValues={getValues} setValue={setValue} strategy={(strategy as RiskStrategy) || RiskStrategy.MITIGATE} probability={probability ?? 3} impact={impact ?? 3} mitigationControlIds={mitigationControlIds || []} suggestedControlIds={suggestedControlIds} readOnly={readOnly} />}
  {activeTab === 'history' && existingRisk?.id && <div className="space-y-6 bg-[var(--glass-bg)] backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-border/40 shadow-premium"><ResourceHistory resourceId={existingRisk.id} resourceType="Risk" /></div>}
 </fieldset>
 {activeTab === 'history' && !existingRisk?.id && <div className="p-8 text-center text-muted-foreground">{t('riskForm.saveToSeeHistory', { defaultValue: 'Veuillez enregistrer le risque pour voir l\'historique.' })}</div>}
 </div>

 {/* Footer Buttons */}
 {!readOnly && (
 <div className="border-t border-border/40 p-6 bg-background/80 backdrop-blur-xl flex justify-between items-center shrink-0">
  <Button type="button" onClick={onCancel} variant="ghost">{t('common.cancel', { defaultValue: 'Annuler' })}</Button>
  <div className="flex gap-3">
  {activeTab !== 'context' && <Button type="button" variant="secondary" onClick={() => { const idx = TABS.findIndex(t => t.id === activeTab); if (idx > 0) setActiveTab(TABS[idx - 1].id); }}>{t('common.previous', { defaultValue: 'Précédent' })}</Button>}
  {activeTab !== 'treatment' ? (
  <Button type="button" onClick={() => { const idx = TABS.findIndex(t => t.id === activeTab); if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id); }}>{t('common.next', { defaultValue: 'Suivant' })}</Button>
  ) : (
  <div className="flex gap-2">
  {onSaveDraft && (!isEditing || isDraft) && <Button type="button" variant="secondary" onClick={handleSaveAsDraft} isLoading={isSavingDraft} disabled={isSavingDraft || isLoading} className="px-6 py-3 border border-warning/50 text-warning hover:bg-warning/10 rounded-xl font-bold text-sm transition-all duration-normal ease-apple">{t('riskForm.saveDraft', { defaultValue: 'Enregistrer brouillon' })}</Button>}
  {isDraft && isEditing && onPublishDraft && <Button type="button" onClick={handlePublishDraft} isLoading={isLoading} disabled={isLoading || isSavingDraft} className="px-6 py-3 bg-success hover:bg-success/90 text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-normal ease-apple shadow-lg shadow-success/20 font-bold text-sm">{t('riskForm.publishRisk', { defaultValue: 'Publier le Risque' })}</Button>}
  {(!isDraft || !isEditing) && <Button type="submit" isLoading={isLoading} disabled={isLoading || isSavingDraft} className="px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-normal ease-apple shadow-lg shadow-primary/20 font-bold text-sm">{isEditing ? t('common.save', { defaultValue: 'Sauvegarder' }) : t('riskForm.createRisk', { defaultValue: 'Créer le Risque' })}</Button>}
  </div>
  )}
  </div>
 </div>
 )}

 {/* Threat Library Modal */}
 <Modal isOpen={showLibraryModal} onClose={() => setShowLibraryModal(false)} title={t('riskForm.threatLibrary', { defaultValue: 'Bibliothèque de Menaces' })} maxWidth="max-w-4xl">
 <div className="p-4">
  <div className="relative mb-4"><FloatingLabelInput label={t('risks.searchThreat', { defaultValue: 'Rechercher une menace...' })} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} icon={Search} /></div>
  <div className="max-h-[60vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
  {filteredLibraryThreats.map((threat) => (
  <div key={threat.id || 'unknown'} onClick={() => handleSelectThreatFromLibrary(threat)} onKeyDown={(e) => e.key === 'Enter' && handleSelectThreatFromLibrary(threat)} role="button" tabIndex={0} aria-label={t('risks.selectThreat', { defaultValue: 'Sélectionner la menace', name: threat.name }) + ` ${threat.name}`} className="border border-border/40 p-4 rounded-xl hover:border-primary/50 cursor-pointer bg-background transition-all duration-normal ease-apple hover:shadow-md group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
  <div className="flex justify-between items-start mb-2">
   <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><span className="font-bold text-foreground line-clamp-1">{threat.name}</span></div>
   <span className="text-xs uppercase font-bold text-muted-foreground border px-1.5 py-0.5 rounded-lg">{threat.framework}</span>
  </div>
  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{threat.description}</p>
  <div className="flex gap-2 text-xs text-muted-foreground">
   <span className="bg-muted px-2 py-1 rounded">{t('risks.scoreRef', { defaultValue: 'Score Ref' })}: {threat.probability * threat.impact}</span>
   <span className="bg-muted px-2 py-1 rounded truncate flex-1">{threat.strategy}</span>
  </div>
  </div>
  ))}
  </div>
 </div>
 </Modal>

 {/* Navigation Blocking Confirmation Modal */}
 <ConfirmModal isOpen={isNavigationBlocked} onClose={cancelNavigation} onConfirm={proceedNavigation} title={t('riskForm.unsavedChangesTitle', { defaultValue: 'Modifications non enregistrées' })} message={t('riskForm.unsavedChangesMessage', { defaultValue: 'Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir quitter cette page ?' })} type="warning" confirmText={t('riskForm.leaveWithoutSaving', { defaultValue: 'Quitter sans enregistrer' })} cancelText={t('riskForm.stayOnPage', { defaultValue: 'Rester sur la page' })} />
 </form>
 );
};
