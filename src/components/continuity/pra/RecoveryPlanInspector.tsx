import React, { useEffect } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useZodForm } from '../../../hooks/useZodForm';
import { recoveryPlanSchema, RecoveryPlanFormData } from '../../../schemas/continuitySchema';
import { InspectorLayout } from '../../ui/InspectorLayout';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { CustomSelect } from '../../ui/CustomSelect';
import { Button } from '../../ui/button';
import { UserProfile, Asset, RecoveryPlan } from '../../../types';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import { Clock, Save, Loader2, FileText, Shield, Plus, Trash2, AlertTriangle } from '../../ui/Icons';
import { useFormPersistence } from '../../../hooks/utils/useFormPersistence';

interface RecoveryPlanInspectorProps {
 isOpen: boolean;
 onClose: () => void;
 onSubmit: (data: RecoveryPlanFormData) => Promise<void>;
 isLoading: boolean;
 initialData?: RecoveryPlan;
 users: UserProfile[];
 assets: Asset[];
}

export const RecoveryPlanInspector: React.FC<RecoveryPlanInspectorProps> = ({
 isOpen,
 onClose,
 onSubmit,
 isLoading,
 initialData,
 users,
 assets
}) => {
 const { t } = useLocale();
 const { register, handleSubmit, control, setValue, reset, watch, formState: { errors, isSubmitting, isDirty } } = useZodForm<typeof recoveryPlanSchema>({
 schema: recoveryPlanSchema,
 defaultValues: {
 title: '',
 type: 'IT System',
 rto: '',
 rpo: '',
 description: '',
 ownerId: '',
 status: 'Draft',
 steps: [],
 triggers: [],
 linkedAssetIds: []
 }
 });

 // Persistence Hook
 const { clearDraft } = useFormPersistence<RecoveryPlanFormData>('sentinel_recovery_plan_draft_new', {
 watch,
 reset
 }, {
 enabled: isOpen && !initialData
 });

 const { fields, append, remove } = useFieldArray({
 control,
 name: "steps"
 });

 const steps = useWatch({ control, name: 'steps' });
 const totalDuration = steps?.reduce((acc, step) => acc + (step.estimatedDuration || 0), 0) || 0;

 useEffect(() => {
 if (isOpen) {
 if (initialData) {
 setValue('title', initialData.title);
 setValue('type', initialData.type);
 setValue('rto', initialData.rto);
 setValue('rpo', initialData.rpo);
 setValue('description', initialData.description || '');
 setValue('ownerId', initialData.ownerId);
 setValue('status', initialData.status);
 setValue('linkedAssetIds', initialData.linkedAssetIds || []);
 } else {
 reset({
  title: '',
  type: 'IT System',
  rto: '',
  rpo: '',
  description: '',
  ownerId: '',
  status: 'Draft',
  steps: [],
  triggers: [],
  linkedAssetIds: []
 });
 }
 }
 }, [isOpen, initialData, setValue, reset]);

 const handleFormSubmit = async (data: RecoveryPlanFormData) => {
 await onSubmit(data);
 clearDraft();
 onClose();
 };

 return (
 <InspectorLayout
 isOpen={isOpen}
 onClose={onClose}
 title={initialData ? t('continuity.pra.editPlan', { defaultValue: "Modifier le Plan" }) : t('continuity.pra.newPlan', { defaultValue: "Nouveau Plan de Reprise" })}
 subtitle={t('continuity.pra.defineResilienceProcedures', { defaultValue: "Définissez les procédures de résilience." })}
 icon={Shield}
 hasUnsavedChanges={isDirty}
 footer={
 <div className="flex justify-end gap-2">
  <Button variant="ghost" onClick={onClose}>{t('common.cancel', { defaultValue: 'Annuler' })}</Button>
  <Button
  onClick={handleSubmit(handleFormSubmit)}
  disabled={isLoading || isSubmitting}
  className="bg-primary text-primary-foreground hover:bg-primary/90"
  >
  {(isLoading || isSubmitting) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
  {initialData ? t('common.update', { defaultValue: 'Mettre à jour' }) : t('continuity.pra.createPlan', { defaultValue: 'Créer le Plan' })}
  </Button>
 </div>
 }
 >
 <div className="space-y-6">
 <div className="bg-muted/50 p-4 rounded-3xl border border-border/40 mb-6">
  <div className="flex items-center gap-3">
  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
  <FileText className="w-5 h-5" />
  </div>
  <div>
  <h3 className="font-bold text-foreground">{t('continuity.pra.generalInfo', { defaultValue: 'Informations Générales' })}</h3>
  <p className="text-sm text-muted-foreground">{t('continuity.pra.identityAndScope', { defaultValue: 'Identité et périmètre du plan.' })}</p>
  </div>
  </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="col-span-full">
  <FloatingLabelInput
  label={t('continuity.pra.planTitle', { defaultValue: 'Titre du Plan' })}
  placeholder={t('continuity.pra.planTitlePlaceholder', { defaultValue: 'Ex: Restauration base de données critique' })}
  {...register('title')}
  error={errors.title?.message}
  />
  </div>

  <div className="col-span-1">
  <Controller
  name="type"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('continuity.pra.planType', { defaultValue: 'Type de Plan' })}
   options={[
   { value: 'IT System', label: t('continuity.pra.typeITSystem', { defaultValue: 'Système IT' }) },
   { value: 'Business Process', label: t('continuity.pra.typeBusinessProcess', { defaultValue: 'Processus Métier' }) },
   { value: 'Facility', label: t('continuity.pra.typeFacility', { defaultValue: 'Site / Bâtiment' }) },
   { value: 'Crisis Comm', label: t('continuity.pra.typeCrisisComm', { defaultValue: 'Communication Crise' }) }
   ]}
   value={field.value}
   onChange={field.onChange}
   error={errors.type?.message}
  />
  )}
  />
  </div>

  <div className="col-span-1">
  <Controller
  name="status"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label="Statut"
   options={[
   { value: 'Draft', label: 'Brouillon' },
   { value: 'Active', label: 'Actif' },
   { value: 'Testing', label: 'En Test' },
   { value: 'Archived', label: 'Archivé' }
   ]}
   value={field.value}
   onChange={field.onChange}
   error={errors.status?.message}
  />
  )}
  />
  </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 dark:bg-white/5 p-4 rounded-3xl border border-border/40">
  <div className="col-span-full pb-2 border-b border-border/40 mb-2">
  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
  <Clock className="w-4 h-4 text-primary" />
  Objectifs de Performance (SLA)
  </h4>
  </div>

  <FloatingLabelInput
  label="RTO (Temps)"
  placeholder="Ex: 4h"
  {...register('rto')}
  error={errors.rto?.message}
  />

  <FloatingLabelInput
  label="RPO (Données)"
  placeholder="Ex: 15min"
  {...register('rpo')}
  error={errors.rpo?.message}
  />
 </div>

 <div className="space-y-4">
  <Controller
  name="ownerId"
  control={control}
  render={({ field }) => (
  <CustomSelect
  label="Responsable du Plan"
  options={users.map(u => ({ value: u.uid, label: u.displayName || u.email || 'Inconnu' }))}
  value={field.value}
  onChange={field.onChange}
  placeholder="Sélectionner un responsable"
  error={errors.ownerId?.message}
  />
  )}
  />

  <Controller
  name="linkedAssetIds"
  control={control}
  render={({ field }) => (
  <CustomSelect
  label="Actifs concernés"
  options={assets.map(a => ({ value: a.id, label: a.name }))}
  value={field.value || []}
  onChange={field.onChange}
  multiple
  placeholder="Sélectionner les actifs..."
  />
  )}
  />

  <FloatingLabelInput
  label="Description & Portée"
  placeholder="Décrivez l'objectif et le périmètre de ce plan..."
  {...register('description')}
  textarea
  className="min-h-[100px]"
  error={errors.description?.message}
  />

  <div className="border-t border-border/40 pt-6 mt-6">
  <div className="flex items-center justify-between mb-4">
  <div>
  <h4 className="text-sm font-bold text-foreground">Procédures de Reprise (Playbook)</h4>
  <div className="flex items-center gap-2 mt-1">
   <p className="text-xs text-muted-foreground">Étapes séquentielles pour restaurer le service.</p>
   <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${totalDuration > 0 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-muted text-muted-foreground'}`}>
   Total: {totalDuration} min
   </span>
  </div>
  </div>
  <Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => append({ title: '', estimatedDuration: 0, isCritical: false, id: crypto.randomUUID() })}
  className="text-primary border-primary/30 hover:bg-primary/10 dark:hover:bg-primary"
  >
  <Plus className="w-4 h-4 mr-1" />
  Ajouter une étape
  </Button>
  </div>

  <div className="space-y-3">
  {fields.map((field, index) => (
  <div key={field.id || 'unknown'} className="group relative bg-card/40 backdrop-blur-sm border border-border/40 rounded-3xl p-3 transition-all hover:shadow-sm hover:border-primary/30 dark:hover:border-primary/40">
   <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-70 transition-opacity">
   <button
   type="button"
   onClick={() => remove(index)}
   className="text-muted-foreground hover:text-red-500 transition-colors bg-card/80 backdrop-blur-sm rounded-full p-1 shadow-sm border border-border/40 dark:border-white/5"
   >
   <Trash2 className="w-3 h-3" />
   </button>
   </div>

   <div className="flex items-start gap-3">
   <div className="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold text-muted-foreground border border-border/40 mt-1">
   {index + 1}
   </div>

   <div className="flex-1 space-y-3">
   <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
   <div className="md:col-span-8">
    <input
    aria-label={`Titre de l'étape ${index + 1}`}
    {...register(`steps.${index}.title` as const)}
    placeholder="Titre de l'action (ex: Redémarrer le service)"
    className="w-full bg-transparent border-none p-0 text-sm font-medium placeholder:text-muted-foreground focus-visible:ring-0 text-foreground"
    />
   </div>
   <div className="md:col-span-4 flex items-center gap-2">
    <Clock className="w-3 h-3 text-muted-foreground" />
    <input
    type="number"
    aria-label={`Durée estimée de l'étape ${index + 1} en minutes`}
    {...register(`steps.${index}.estimatedDuration` as const, { valueAsNumber: true })}
    placeholder="Min"
    className="w-full bg-transparent border-none p-0 text-sm text-right placeholder:text-muted-foreground focus-visible:ring-0 text-muted-foreground"
    />
    <span className="text-xs text-muted-foreground">min</span>
   </div>
   </div>

   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
   <input
    aria-label={`Rôle responsable de l'étape ${index + 1}`}
    {...register(`steps.${index}.assignedRole` as const)}
    placeholder="Rôle responsable"
    className="w-full bg-muted/50 dark:bg-white/5 rounded px-2 py-1 text-xs border border-transparent focus-visible:border-primary focus-visible:ring-0 transition-colors"
   />
   <label className="flex items-center gap-2 cursor-pointer">
    <input
    type="checkbox"
    {...register(`steps.${index}.isCritical` as const)}
    className="rounded border-border/40 text-primary focus-visible:ring-primary w-3 h-3"
    />
    <span className="text-xs text-muted-foreground">Étape Critique (Bloquante)</span>
   </label>
   </div>
   </div>
   </div>
  </div>
  ))}

  {fields.length === 0 && (
  <div className="text-center py-8 border-2 border-dashed border-border/40 rounded-3xl bg-muted/50 dark:bg-white/5 flex flex-col items-center">
   <div className="p-3 bg-muted rounded-full mb-3 text-muted-foreground">
   <AlertTriangle className="w-6 h-6" />
   </div>
   <p className="text-sm font-medium text-foreground">Aucune procédure définie</p>
   <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
   Un plan de reprise sans étapes est inutile en cas de crise. Ajoutez vos procédures.
   </p>
   <Button
   type="button"
   variant="ghost"
   size="sm"
   onClick={() => append({ title: '', estimatedDuration: 0, isCritical: false, id: crypto.randomUUID() })}
   className="text-primary hover:bg-primary/10 dark:hover:bg-primary/30"
   >
   Commencer le playbook
   </Button>
  </div>
  )}
  </div>
  </div>
 </div>
 </div>
 </InspectorLayout>
 );
};
