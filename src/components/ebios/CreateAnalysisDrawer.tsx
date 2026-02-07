import React from 'react';
import { useTranslation } from 'react-i18next';
import { useZodForm } from '../../hooks/useZodForm';
import { Controller } from 'react-hook-form';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { CustomSelect } from '../ui/CustomSelect';
import { createEbiosAnalysisSchema, type CreateEbiosAnalysisFormData } from '../../schemas/ebiosSchema';
import { Shield } from '../ui/Icons';

interface CreateAnalysisDrawerProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (data: CreateEbiosAnalysisFormData) => Promise<void> | void;
 isLoading?: boolean;
}

export const CreateAnalysisDrawer: React.FC<CreateAnalysisDrawerProps> = ({
 isOpen,
 onClose,
 onSave,
 isLoading = false
}) => {
 const { t } = useTranslation();

 const {
 register,
 handleSubmit,
 formState: { errors, isDirty },
 reset,
 control
 } = useZodForm({
 schema: createEbiosAnalysisSchema,
 defaultValues: {
 name: '',
 description: '',
 sector: '',
 targetCertificationDate: ''
 },
 });

 // Reset form when opening
 React.useEffect(() => {
 if (isOpen) {
 reset();
 }
 }, [isOpen, reset]);

 const /* validate */ onSubmit = async (data: CreateEbiosAnalysisFormData) => {
 await onSave(data);
 };

 const sectorOptions = [
 { value: 'finance', label: t('ebios.sectors.finance') },
 { value: 'healthcare', label: t('ebios.sectors.healthcare') },
 { value: 'energy', label: t('ebios.sectors.energy') },
 { value: 'transport', label: t('ebios.sectors.transport') },
 { value: 'telecommunications', label: t('ebios.sectors.telecommunications') },
 { value: 'government', label: t('ebios.sectors.government') },
 { value: 'industry', label: t('ebios.sectors.industry') },
 { value: 'retail', label: t('ebios.sectors.retail') },
 { value: 'other', label: t('ebios.sectors.other') },
 ];

 return (
 <InspectorLayout
 isOpen={isOpen}
 onClose={onClose}
 title={t('ebios.createAnalysis')}
 subtitle={t('ebios.createAnalysisInfo')}
 width="max-w-6xl"
 icon={Shield}
 hasUnsavedChanges={isDirty}
 >
 <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
 <div className="flex-1 space-y-8 pt-2 max-w-5xl mx-auto w-full">

  {/* Header Section in Form */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
  {/* Name */}
  <div className="space-y-6">
  <FloatingLabelInput
  label={t('ebios.analysisName')}
  placeholder={t('ebios.analysisNamePlaceholder')}
  error={errors.name?.message}
  {...register('name')}
  />

  {/* Sector */}
  <Controller
  name="sector"
  control={control}
  render={({ field }) => (
   <CustomSelect
   label={t('ebios.sector')}
   options={[
   { value: "", label: t('ebios.selectSector') },
   ...sectorOptions
   ]}
   value={field.value || ""}
   onChange={field.onChange}
   error={errors.sector?.message}
   />
  )}
  />

  {/* Target Date */}
  <FloatingLabelInput
  type="date"
  label={t('ebios.targetCertificationDate')}
  error={errors.targetCertificationDate?.message}
  {...register('targetCertificationDate')}
  />
  </div>

  {/* Description - Right Side */}
  <div>
  <FloatingLabelInput
  label={t('ebios.analysisDescription')}
  placeholder={t('ebios.analysisDescriptionPlaceholder')}
  textarea
  className="h-full min-h-[200px]"
  error={errors.description?.message}
  {...register('description')}
  />
  </div>
  </div>
 </div>

 <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-border/40 shrink-0">
  <Button
  type="button"
  variant="ghost"
  onClick={onClose}
  disabled={isLoading}
  >
  {t('common.cancel')}
  </Button>
  <Button
  type="submit"
  isLoading={isLoading}
  >
  {t('ebios.startAnalysis')}
  </Button>
 </div>
 </form>
 </InspectorLayout >
 );
};

export default CreateAnalysisDrawer;
