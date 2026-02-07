import React from 'react';
import { useLocale } from '@/hooks/useLocale';
import { Controller } from 'react-hook-form';
import { useZodForm } from '../../../hooks/useZodForm';
import { bcpDrillSchema, BcpDrillFormData } from '../../../schemas/continuitySchema';
import { BusinessProcess, BcpDrill } from '../../../types';
import { Loader2, Zap, Save, Calendar } from '../../ui/Icons';
import { InspectorLayout } from '../../ui/InspectorLayout';
import { Button } from '../../ui/button';
import { CustomSelect } from '../../ui/CustomSelect';
import { FloatingLabelInput } from '../../ui/FloatingLabelInput';
import { DatePicker } from '../../ui/DatePicker';

interface DrillInspectorProps {
 isOpen: boolean;
 onClose: () => void;
 /* validate */ onSubmit: (data: Partial<BcpDrill>) => Promise<void>;
 processes: BusinessProcess[];
 isLoading?: boolean;
}

export const DrillInspector: React.FC<DrillInspectorProps> = ({
 isOpen,
 onClose,
 onSubmit,
 processes,
 isLoading
}) => {
 const { t } = useLocale();
 const { handleSubmit, control, formState: { errors, isSubmitting, isDirty } } = useZodForm({
 schema: bcpDrillSchema,
 mode: 'onChange'
 });

 const handleFormSubmit = async (data: BcpDrillFormData) => {
 await onSubmit(data);
 onClose();
 };

 /* empty state: Aucun élément à afficher si la liste est vide */

 return (
 <InspectorLayout
 isOpen={isOpen}
 onClose={onClose}
 title={t('continuity.drills.newDrill', { defaultValue: 'Nouvel Exercice' })}
 subtitle={t('continuity.drills.planSubtitle', { defaultValue: 'Planifier ou enregistrer un exercice de continuité' })}
 icon={Zap}
 width="max-w-2xl"
 hasUnsavedChanges={isDirty}
 footer={
 <div className="flex justify-end gap-2">
  <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', { defaultValue: 'Annuler' })}</Button>
  <Button
  onClick={handleSubmit(handleFormSubmit)}
  disabled={isSubmitting || isLoading}
  className="bg-primary text-primary-foreground hover:bg-primary/90"
  >
  {isSubmitting || isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
  {t('common.save', { defaultValue: 'Enregistrer' })}
  </Button>
 </div>
 }
 >
 <div className="space-y-6">
 <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-3xl border border-blue-100 dark:border-blue-800">
  <h3 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
  <Calendar className="w-4 h-4" />
  {t('continuity.drills.planTitle', { defaultValue: "Planification de l'exercice" })}
  </h3>
  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
  {t('continuity.drills.planDescription', { defaultValue: 'Les exercices réguliers sont essentiels pour valider vos plans de continuité.' })}
  </p>
 </div>

 <form className="space-y-6">
  <div>
  <Controller<BcpDrillFormData>
  name="processId"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('continuity.drills.testedProcess', { defaultValue: 'Processus Testé' })}
   options={processes.map(p => ({ value: p.id, label: p.name }))}
   value={field.value || ''}
   onChange={field.onChange}
   error={errors.processId?.message}
  />
  )}
  />
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Controller<BcpDrillFormData>
  name="type"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('continuity.drills.exerciseType', { defaultValue: "Type d'Exercice" })}
   options={[
   { value: "Tabletop", label: t('continuity.drills.typeTabletop', { defaultValue: "Tabletop (Sur table)" }) },
   { value: "Simulation", label: t('continuity.drills.typeSimulation', { defaultValue: "Simulation Technique" }) },
   { value: "Full Scale", label: t('continuity.drills.typeFullScale', { defaultValue: "Grandeur Nature" }) },
   { value: "Call Tree", label: t('continuity.drills.typeCallTree', { defaultValue: "Arbre d'Appel" }) }
   ]}
   value={field.value || ''}
   onChange={field.onChange}
   error={errors.type?.message}
  />
  )}
  />

  <Controller<BcpDrillFormData>
  name="date"
  control={control}
  render={({ field }) => (
  <DatePicker
   label={t('continuity.drills.exerciseDate', { defaultValue: "Date de l'Exercice" })}
   value={field.value}
   onChange={(d) => field.onChange(d)}
   error={errors.date?.message}
  />
  )}
  />
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <Controller<BcpDrillFormData>
  name="result"
  control={control}
  render={({ field }) => (
  <CustomSelect
   label={t('continuity.drills.result', { defaultValue: 'Résultat' })}
   options={[
   { value: "Succès", label: t('continuity.drills.resultSuccess', { defaultValue: "Succès" }) },
   { value: "Succès partiel", label: t('continuity.drills.resultPartial', { defaultValue: "Succès Partiel" }) },
   { value: "Échec", label: t('continuity.drills.resultFailure', { defaultValue: "Échec" }) }
   ]}
   value={field.value || ''}
   onChange={field.onChange}
   error={errors.result?.message}
  />
  )}
  />
  </div>

  <div>
  <Controller
  name="notes"
  control={control}
  render={({ field }) => (
  <FloatingLabelInput
   label={t('continuity.drills.notesObservations', { defaultValue: 'Notes / Observations' })}
   value={field.value || ''}
   onChange={field.onChange}
   textarea
   className="min-h-[100px]"
  />
  )}
  />
  </div>
 </form>
 </div>
 </InspectorLayout>
 );
};
