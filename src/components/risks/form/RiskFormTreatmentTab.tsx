/**
 * RiskFormTreatmentTab - Treatment & controls tab for RiskForm
 * Extracted from RiskForm.tsx for better maintainability
 */

import React, { useCallback, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { RiskStrategy, RISK_ACCEPTANCE_THRESHOLD } from '@/constants/RiskConstants';
import { Layers, AlertTriangle, Shield, Sparkles, Search } from '../../ui/Icons';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { RiskTreatmentPlan } from '../RiskTreatmentPlan';
import { Risk } from '../../../types';
import { RiskFormTreatmentTabProps } from './riskFormTypes';
import { CONTROL_STATUS } from '../../../constants/complianceConfig';

export const RiskFormTreatmentTab: React.FC<RiskFormTreatmentTabProps> = React.memo(({
 control,
 errors,
 existingRisk,
 controls,
 usersList,
 getValues,
 setValue,
 strategy,
 probability,
 impact,
 mitigationControlIds,
 suggestedControlIds,
}) => {
 const { t } = useLocale();
 const toggleControlSelection = useCallback((controlId: string) => {
 const currentIds = getValues('mitigationControlIds') || [];
 if (currentIds.includes(controlId)) {
 setValue('mitigationControlIds', currentIds.filter(id => id !== controlId), { shouldDirty: true });
 } else {
 setValue('mitigationControlIds', [...currentIds, controlId], { shouldDirty: true });
 }
 }, [getValues, setValue]);

 const [searchTerm, setSearchTerm] = useState('');

 const showJustification = strategy === RiskStrategy.ACCEPT && (probability * impact) >= RISK_ACCEPTANCE_THRESHOLD;

 return (
 <div className="space-y-8 bg-[var(--glass-bg)] backdrop-blur-xl p-4 sm:p-6 rounded-xl border border-border/40 shadow-premium">
 <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
 <Layers className="h-5 w-5 text-primary" /> {t('risks.tabs.treatment')}
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
  const statusMap: Record<string, 'Ouvert' | 'En cours' | 'Fermé'> = {
  'Terminé': 'Fermé',
  'En cours': 'En cours',
  'Planifié': 'Ouvert',
  'Retard': 'En cours'
  };
  const mappedStatus = statusMap[treatment.status] || 'Ouvert';
  setValue('status', mappedStatus, { shouldDirty: true });
  }
 }}
 />

 {/* 2. Justification (Conditional) */}
 {showJustification && (
 <div className="space-y-2 animate-fade-in p-4 bg-warning/10 border border-warning/20 rounded-xl">
  <label className="flex items-center gap-2 text-sm font-bold text-warning">
  <AlertTriangle className="h-4 w-4" />
  {t('risks.validation_justification_required') || "Justification d'Acceptation du Risque (Obligatoire)"}
  </label>
  <p className="text-xs text-muted-foreground">
  {t('risks.validation_justification_desc', { score: probability * impact }) || `Vous vous apprêtez à accepter un risque critique (Score: ${probability * impact}). Veuillez justifier cette décision pour le registre.`}
  </p>
  <FloatingLabelInput
  label={t('risks.justification') || "Justification d'Acceptation"}
  {...control.register('justification')}
  textarea
  rows={3}
  placeholder={t('risks.justification_placeholder') || "Expliquez pourquoi ce risque est accepté (ex: coût de traitement disproportionné, risque transitoire...)"}
  error={errors.justification?.message}
  />
  {errors.justification && (
  <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-1">
  {errors.justification.message}
  </p>
  )}
 </div>
 )}

 <div className="border-t border-border/40 pt-6"></div>

 {/* 3. Existing Controls Link */}
 <div className="space-y-3">
 <div className="flex items-center text-sm font-bold text-foreground">
  <Shield className="h-4 w-4 mr-2 text-primary" />
  {t('common.controls')}
 </div>

 {/* Search Bar */}
 <div className="relative mb-2">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <input
  type="text"
  aria-label="Rechercher des contrôles"
  placeholder={t('common.searchPlaceholder') || "Rechercher..."}
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="w-full pl-9 pr-4 py-2 bg-background border border-border/40 rounded-xl text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all duration-normal ease-apple"
  />
 </div>

 <div className="border border-border/40 rounded-xl max-h-[250px] overflow-y-auto p-2 bg-muted/10">
  {controls.length > 0 ? (
  controls
  .filter(c =>
  c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  c.code.toLowerCase().includes(searchTerm.toLowerCase())
  )
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
   <label key={ctrl.id || 'unknown'} className={`flex items-start space-x-3 p-2 rounded-lg cursor-pointer hover:bg-background transition-colors ${mitigationControlIds?.includes(ctrl.id) ? 'bg-background shadow-sm border border-border/40' : ''} ${isSuggested ? 'bg-primary/5' : ' '}`}>
   <input
   id={`control-${ctrl.id}`}
   checked={mitigationControlIds?.includes(ctrl.id) || false}
   onChange={() => toggleControlSelection(ctrl.id)}
   type="checkbox"
   className="mt-1 rounded border-border/40 text-primary focus-visible:ring-primary"
   />
   <span className="sr-only">{ctrl.code}</span>
   <div className="flex-1">
   <div className="flex items-center justify-between">
   <span className="text-xs font-bold text-foreground flex items-center gap-2">
    {ctrl.code}
    {isSuggested && <span className="text-xs bg-primary/10 text-primary px-1.5 rounded-full flex items-center"><Sparkles className="w-3 h-3 mr-1" /> IA</span>}
   </span>
   {ctrl.status === CONTROL_STATUS.IMPLEMENTED && <span className="text-xs bg-success/10 text-success px-1.5 rounded-full">{t('common.status.implemented') || "Implémenté"}</span>}
   </div>
   <span className="text-xs text-muted-foreground">{ctrl.name}</span>
   </div>
   </label>
  )
  })
  ) : (
  <div className="p-4 text-center text-xs text-muted-foreground">{t('common.noControls') || "Aucun contrôle disponible."}</div>
  )}
 </div>
 <p className="text-xs text-muted-foreground">{t('risks.controls_hint') || "Sélectionnez les contrôles déjà en place réduisant le risque."}</p>
 </div>
 </div>
 );
});

RiskFormTreatmentTab.displayName = 'RiskFormTreatmentTab';
