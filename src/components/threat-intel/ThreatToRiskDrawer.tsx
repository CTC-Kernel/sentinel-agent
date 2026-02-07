import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from '../ui/Icons';
import { useStore } from '../../store';
import { useThreatIntelActions } from '../../hooks/threats/useThreatIntelActions';
import { Button } from '../ui/button';
import { Threat, Risk } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { Drawer } from '../ui/Drawer';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';

const schema = z.object({
 assetId: z.string().min(1, "Asset is required"),
 scenario: z.string().min(10, "Scenario is required (min 10 characters)"),
 probability: z.string(), // Form returns string usually
 impact: z.string(),
 strategy: z.enum(['Accepter', 'Atténuer', 'Transférer', 'Éviter']),
});

type FormData = z.infer<typeof schema>;

interface ThreatToRiskDrawerProps {
 isOpen: boolean;
 onClose: () => void;
 threat: Threat | null;
}

export const ThreatToRiskDrawer: React.FC<ThreatToRiskDrawerProps> = ({ isOpen, onClose, threat }) => {
 const { user, addToast, t } = useStore();
 const { assets, addRisk, updateCommunityThreat } = useThreatIntelActions();

 const { control, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset, setValue } = useForm<FormData>({
 resolver: zodResolver(schema),
 defaultValues: {
 probability: '3',
 impact: '3',
 strategy: 'Atténuer',
 assetId: '',
 scenario: ''
 }
 });

 useEffect(() => {
 if (threat) {
 setValue('scenario', `${t('threatIntel.detectedThreat', { defaultValue: 'Menace détectée' })} : ${threat.title}\n\n${t('threatIntel.source', { defaultValue: 'Source' })} : Threat Intel (${threat.source || t('threatIntel.community', { defaultValue: 'Community' })})`);
 }
  // Justification: t is stable from useLocale and does not need to be in deps.
 }, [threat, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

 const onSubmit = async (data: FormData) => {
 if (!user || !threat) return;
 try {
 const prob = parseInt(data.probability);
 const imp = parseInt(data.impact);
 const score = prob * imp;

 const riskId = await addRisk({
 organizationId: user.organizationId,
 assetId: data.assetId,
 threat: threat.title,
 scenario: data.scenario,
 vulnerability: t('threatIntel.externalSource', { defaultValue: 'Source externe (Threat Intel)' }),
 probability: prob as 1 | 2 | 3 | 4 | 5,
 impact: imp as 1 | 2 | 3 | 4 | 5,
 score: score,
 strategy: data.strategy,
 status: 'Ouvert',
 owner: user.email,
 ownerId: user.uid,
 createdAt: new Date(Date.now()).toISOString(),
 relatedThreatId: threat.id
 } as unknown as Partial<Risk>);

 // Bidirectional linking: Mark threat as processed into a risk
 if (riskId) {
 await updateCommunityThreat(threat.id, {
  relatedRiskId: riskId,
  status: 'Processed'
 });
 }

 addToast(t('threatIntel.toast.riskCreated', { defaultValue: "Risque créé avec succès" }), "success");
 reset();
 onClose();
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'ThreatToRiskDrawer.onSubmit', 'CREATE_FAILED');
 }
 };

 return (
 <Drawer
 isOpen={isOpen}
 onClose={onClose}
 title={t('threatToRisk.title', { defaultValue: 'Mettre en Risque' })}
 subtitle={t('threatToRisk.subtitle', { defaultValue: `Transformer "${threat ? threat.title : 'cette menace'}" en risque formel.` })}
 width="max-w-2xl"
 hasUnsavedChanges={isDirty}
 >
 <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
 <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
  <Controller
  name="assetId"
  control={control}
  render={({ field }) => (
  <div className="relative">
  {/* Enhanced Select for Assets would be better, but CustomSelect works if we map it */}
  <CustomSelect
   label={t('threatToRisk.fields.relatedAsset', { defaultValue: 'Actif concerné' })}
   options={assets.map(a => ({ value: a.id, label: `${a.name} (${a.type})` }))}
   value={field.value}
   onChange={field.onChange}
   error={errors.assetId?.message}
  />
  </div>
  )}
  />

  <Controller
  name="scenario"
  control={control}
  render={({ field }) => (
  <FloatingLabelInput
  label={t('threatToRisk.fields.riskScenario', { defaultValue: 'Scénario de Risque' })}
  {...field}
  error={errors.scenario?.message}
  textarea
  className="min-h-[120px]"
  />
  )}
  />

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
  <Controller
  name="probability"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('threatToRisk.fields.probability', { defaultValue: 'Probabilité (1-5)' })}
   options={[1, 2, 3, 4, 5].map(String).map(v => ({ value: v, label: v }))}
   value={field.value}
   onChange={field.onChange}
  />
  )}
  />
  <Controller
  name="impact"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('threatToRisk.fields.impact', { defaultValue: 'Impact (1-5)' })}
   options={[1, 2, 3, 4, 5].map(String).map(v => ({ value: v, label: v }))}
   value={field.value}
   onChange={field.onChange}
  />
  )}
  />
  </div>

  <Controller
  name="strategy"
  control={control}
  render={({ field }) => (
  <CustomSelect
  label={t('threatToRisk.fields.strategy', { defaultValue: 'Stratégie' })}
  options={[
   { value: 'Atténuer', label: t('threatToRisk.strategy.mitigate', { defaultValue: 'Atténuer' }) },
   { value: 'Accepter', label: t('threatToRisk.strategy.accept', { defaultValue: 'Accepter' }) },
   { value: 'Transférer', label: t('threatToRisk.strategy.transfer', { defaultValue: 'Transférer' }) },
   { value: 'Éviter', label: t('threatToRisk.strategy.avoid', { defaultValue: 'Éviter' }) }
  ]}
  value={field.value}
  onChange={field.onChange}
  />
  )}
  />
 </div>

 <div className="px-6 py-4 border-t border-border/40 shrink-0 flex justify-end gap-3 bg-card z-decorator">
  <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
  {t('common.cancel', { defaultValue: 'Annuler' })}
  </Button>
  <Button
  type="submit"
  disabled={isSubmitting}
  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 gap-2"
  >
  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
  {t('threatToRisk.submit', { defaultValue: 'Créer Risque' })}
  </Button>
 </div>
 </form>
 </Drawer>
 );
};
