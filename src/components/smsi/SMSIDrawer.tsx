import React, { useEffect } from 'react';
import { useStore } from '../../store';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { useZodForm } from '../../hooks/useZodForm';
import { z } from 'zod';
import { Shield, Clock, Settings, CheckCircle2 } from '../ui/Icons';
import { cn } from '../../utils/cn';
import { FieldValues } from 'react-hook-form';
import { SMSIProgram } from '../../types/ebios';

const smsiSchema = z.object({
 name: z.string().min(1),
 description: z.string().optional(),
 targetCertificationDate: z.string().optional(),
 isCertified: z.boolean().optional(),
 template: z.enum(['standard', 'fast-track', 'maintenance']).default('standard'),
});

const PROGRAM_TEMPLATES = [
 {
 id: 'standard',
 nameKey: 'smsi.drawer.templateStandardName',
 nameDefault: 'Implémentation Standard ISO 27001',
 descKey: 'smsi.drawer.templateStandardDesc',
 descDefault: 'Cycle complet PDCA avec tous les jalons classiques.',
 icon: Shield
 },
 {
 id: 'fast-track',
 nameKey: 'smsi.drawer.templateFastTrackName',
 nameDefault: 'Fast Track (Startup/PME)',
 descKey: 'smsi.drawer.templateFastTrackDesc',
 descDefault: 'Focus sur les risques critiques et contrôles essentiels.',
 icon: Clock
 },
 {
 id: 'maintenance',
 nameKey: 'smsi.drawer.templateMaintenanceName',
 nameDefault: 'Maintien & Amélioration',
 descKey: 'smsi.drawer.templateMaintenanceDesc',
 descDefault: 'Pour les organisations déjà certifiées (Cycle annuel).',
 icon: Settings
 }
] as const;

type SMSIFormData = z.infer<typeof smsiSchema>;

interface SMSIDrawerProps {
 isOpen: boolean;
 onClose: () => void;
 program?: SMSIProgram | null;
 onSubmit: (data: SMSIFormData) => Promise<void>;
 isLoading?: boolean;
}

export const SMSIDrawer: React.FC<SMSIDrawerProps> = ({
 isOpen,
 onClose,
 program,
 onSubmit,
 isLoading = false
}) => {
 const { t } = useStore();
 const isEditing = !!program;

 const { register, handleSubmit, formState: { errors, isDirty }, reset, watch, setValue } = useZodForm({
 schema: smsiSchema,
 defaultValues: {
 name: program?.name || '',
 description: program?.description || '',
 targetCertificationDate: program?.targetCertificationDate ? new Date(program.targetCertificationDate).toISOString().split('T')[0] : '',
 isCertified: false,
 template: 'standard'
 }
 });

 const selectedTemplate = watch('template');

 useEffect(() => {
 if (isOpen) {
 reset({
 name: program?.name || '',
 description: program?.description || '',
 targetCertificationDate: program?.targetCertificationDate ? new Date(program.targetCertificationDate).toISOString().split('T')[0] : '',
 isCertified: false,
 template: 'standard'
 });
 }
 }, [isOpen, program, reset]);

 const handleFormSubmit = async (data: FieldValues) => {
 await onSubmit(data as SMSIFormData);
 };

 const title = program ? t('smsi.editProgram') : t('smsi.newProgram');
 const subtitle = t('smsi.programDetails');

 return (
 <Drawer
 isOpen={isOpen}
 onClose={onClose}
 title={title}
 subtitle={subtitle}
 width="max-w-xl"
 hasUnsavedChanges={isDirty}
 >
 <form id="smsi-form" onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
 <div className="flex-1 space-y-6 pt-6 px-1">
  <FloatingLabelInput
  label={t('common.name')}
  placeholder={t('smsi.drawer.namePlaceholder', { defaultValue: 'Ex: Certification ISO 27001 - 2025' })}
  required
  error={errors.name?.message}
  {...register('name')}
  />

  <FloatingLabelTextarea
  label={t('common.description')}
  placeholder={t('smsi.drawer.descriptionPlaceholder', { defaultValue: 'Description du périmètre et des objectifs...' })}
  rows={4}
  error={errors.description?.message}
  {...register('description')}
  />

  <FloatingLabelInput
  type="date"
  label={t('smsi.targetDate')}
  error={errors.targetCertificationDate?.message}
  {...register('targetCertificationDate')}
  />

  {!isEditing && (
  <div className="pt-4">
  <h4 id="template-label" className="text-sm font-medium text-foreground mb-3">
  {t('smsi.drawer.programTemplate', { defaultValue: 'Modèle de programme' })}
  </h4>
  <div className="grid gap-3" role="radiogroup" aria-labelledby="template-label">
  {PROGRAM_TEMPLATES.map((template) => (
   <button
   key={template.id || 'unknown'}
   type="button"
   onClick={() => setValue('template', template.id)}
   aria-checked={selectedTemplate === template.id}
   role="radio"
   className={cn(
   "relative flex items-start gap-3 p-3 rounded-3xl border cursor-pointer transition-all w-full text-left",
   selectedTemplate === template.id
   ? "border-primary bg-primary/10 dark:bg-primary ring-1 ring-primary"
   : "border-border/40 hover:border-border/40 dark:hover:border-white/20 bg-card"
   )}
   >
   <div className={cn(
   "p-2 rounded-lg",
   selectedTemplate === template.id ? "bg-primary/15 text-primary dark:bg-primary dark:text-primary/70" : "bg-muted text-muted-foreground "
   )}>
   <template.icon className="w-5 h-5" />
   </div>
   <div className="flex-1">
   <h4 className={cn(
   "text-sm font-medium mb-0.5",
   selectedTemplate === template.id ? "text-primary dark:text-primary/30" : "text-foreground"
   )}>
   {t(template.nameKey, { defaultValue: template.nameDefault })}
   </h4>
   <p className="text-xs text-muted-foreground">
   {t(template.descKey, { defaultValue: template.descDefault })}
   </p>
   </div>
   {selectedTemplate === template.id && (
   <div className="absolute top-3 right-3 text-primary">
   <CheckCircle2 className="w-5 h-5 fill-current" />
   </div>
   )}
   </button>
  ))}
  </div>
  </div>
  )}
 </div>

 <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-border/40">
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
  {program ? t('common.save') : t('common.create')}
  </Button>
 </div>
 </form>
 </Drawer>
 );
};
