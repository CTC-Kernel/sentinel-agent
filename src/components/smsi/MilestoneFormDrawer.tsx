/**
 * MilestoneFormDrawer.tsx
 * Drawer form for creating and editing SMSI milestones
 *
 * Story 20.2: Définition des Jalons
 * Story 20.4: Attribution des Responsables
 */

import React, { useEffect } from 'react';
import { useStore } from '../../store';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { useZodForm } from '../../hooks/useZodForm';
import { z } from 'zod';
import { FieldValues } from 'react-hook-form';
import { Milestone, PDCAPhase } from '../../types/ebios';
import { PHASE_CONFIG, PHASE_STYLES } from './constants';
import { cn } from '../../utils/cn';
import { Users } from '../ui/Icons';

const milestoneSchema = z.object({
 name: z.string().min(3, 'Name must be at least 3 characters'),
 description: z.string().optional(),
 phase: z.enum(['plan', 'do', 'check', 'act']),
 dueDate: z.string().min(1, 'Due date is required'),
 responsibleId: z.string().optional(),
});

type MilestoneFormData = z.infer<typeof milestoneSchema>;

interface MilestoneFormDrawerProps {
 isOpen: boolean;
 onClose: () => void;
 milestone?: Milestone | null;
 onSubmit: (data: MilestoneFormData) => Promise<void>;
 isLoading?: boolean;
 defaultPhase?: PDCAPhase;
 teamMembers?: Array<{ id: string; displayName: string; email: string }>;
}

export const MilestoneFormDrawer: React.FC<MilestoneFormDrawerProps> = ({
 isOpen,
 onClose,
 milestone,
 onSubmit,
 isLoading = false,
 defaultPhase = 'plan',
 teamMembers = [],
}) => {
 const { t } = useStore();

 const {
 register,
 handleSubmit,
 formState: { errors, isDirty },
 reset,
 watch,
 setValue,
 } = useZodForm({
 schema: milestoneSchema,
 defaultValues: {
 name: milestone?.name || '',
 description: milestone?.description || '',
 phase: milestone?.phase || defaultPhase,
 dueDate: milestone?.dueDate
 ? new Date(milestone.dueDate).toISOString().split('T')[0]
 : '',
 responsibleId: milestone?.responsibleId || '',
 },
 });

 const selectedPhase = watch('phase') as PDCAPhase;

 useEffect(() => {
 if (isOpen) {
 reset({
 name: milestone?.name || '',
 description: milestone?.description || '',
 phase: milestone?.phase || defaultPhase,
 dueDate: milestone?.dueDate
 ? new Date(milestone.dueDate).toISOString().split('T')[0]
 : '',
 responsibleId: milestone?.responsibleId || '',
 });
 }
 }, [isOpen, milestone, defaultPhase, reset]);

 const handleFormSubmit = async (data: FieldValues) => {
 await onSubmit(data as MilestoneFormData);
 };

 const title = milestone ? t('milestones.edit.title', { defaultValue: 'Modifier le jalon' }) : t('milestones.create.title', { defaultValue: 'Nouveau jalon' });
 const subtitle = t('milestones.form.subtitle', { defaultValue: 'Définissez les détails du jalon SMSI' });

 return (
 <Drawer
 isOpen={isOpen}
 onClose={onClose}
 title={title}
 subtitle={subtitle}
 width="max-w-xl"
 hasUnsavedChanges={isDirty}
 >
 <form
 id="milestone-form"
 onSubmit={handleSubmit(handleFormSubmit)}
 className="flex flex-col h-full"
 >
 <div className="flex-1 space-y-6 pt-6 px-1">
 {/* Name */}
 <FloatingLabelInput
 label={t('milestones.fields.name', { defaultValue: 'Nom du jalon' })}
 placeholder={t('milestones.fields.namePlaceholder', { defaultValue: 'Ex: Rédaction de la politique SMSI' })}
 required
 error={errors.name?.message}
 {...register('name')}
 />

 {/* Description */}
 <FloatingLabelTextarea
 label={t('milestones.fields.description', { defaultValue: 'Description' })}
 placeholder={t('milestones.fields.descriptionPlaceholder', { defaultValue: 'Décrivez les objectifs et livrables attendus...' })}
 rows={3}
 error={errors.description?.message}
 {...register('description')}
 />

 {/* Phase Selection - Story 20.2 */}
 <div className="space-y-2">
 <h4 id="phase-label" className="text-sm font-medium text-foreground text-muted-foreground">
 {t('milestones.fields.pdcaPhase', { defaultValue: 'Phase PDCA' })} *
 </h4>
 <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby="phase-label">
 {(Object.keys(PHASE_CONFIG) as PDCAPhase[]).map((phase) => {
 const config = PHASE_CONFIG[phase];
 const style = PHASE_STYLES[phase];
 const isSelected = selectedPhase === phase;
 const PhaseIcon = config.icon as React.ComponentType<{ className?: string }>;

 return (
  <button
  key={phase || 'unknown'}
  type="button"
  onClick={() => setValue('phase', phase)}
  className={cn(
  'flex items-center gap-3 p-3 rounded-3xl border-2 transition-all text-left',
  isSelected
  ? `${style.borderActive} ${style.bgActive}`
  : 'border-border/40 hover:border-border/40 dark:hover:border-border'
  )}
  >
  <div
  className={cn(
  'w-10 h-10 rounded-lg flex items-center justify-center',
  style.iconBg
  )}
  >
  <PhaseIcon className={cn('w-5 h-5', style.iconText)} />
  </div>
  <div>
  <p
  className={cn(
  'font-medium',
  isSelected
  ? style.textActive
  : 'text-foreground'
  )}
  >
  {config.label}
  </p>
  <p className="text-xs text-muted-foreground line-clamp-1">
  {config.description.substring(0, 30)}...
  </p>
  </div>
  </button>
 );
 })}
 </div>
 <input type="hidden" {...register('phase')} />
 {errors.phase && (
 <p className="text-sm text-red-500">{errors.phase.message}</p>
 )}
 </div>

 {/* Due Date */}
 <FloatingLabelInput
 type="date"
 label={t('milestones.fields.dueDate', { defaultValue: "Date d'échéance" })}
 required
 error={errors.dueDate?.message}
 {...register('dueDate')}
 />

 {/* Responsible Person - Story 20.4 */}
 <div className="space-y-2">
 <label htmlFor="responsible-select" className="text-sm font-medium text-foreground flex items-center gap-2">
 <Users className="w-4 h-4" />
 {t('milestones.fields.responsible', { defaultValue: 'Responsable' })}
 </label>
 <select
 id="responsible-select"
 {...register('responsibleId')}
 className="w-full px-4 py-3 rounded-3xl border border-border/40 bg-card text-foreground focus-visible:ring-2 focus-visible:ring-primary focus:border-blue-500"
 >
 <option value="">{t('milestones.fields.unassigned', { defaultValue: 'Non assigné' })}</option>
 {teamMembers.map((member) => (
 <option key={member.id || 'unknown'} value={member.id}>
  {member.displayName || member.email}
 </option>
 ))}
 </select>
 {errors.responsibleId && (
 <p className="text-sm text-red-500">
 {errors.responsibleId.message}
 </p>
 )}
 </div>

 {/* Quick Tips */}
 <div className="p-4 rounded-3xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 dark:border-blue-800">
 <p className="text-sm text-blue-700 dark:text-blue-400">
 <strong>{t('milestones.tips.title', { defaultValue: 'Conseil :' })}</strong> {t('milestones.tips.smartDescription', { defaultValue: 'Définissez des jalons SMART (Spécifiques, Mesurables, Atteignables, Réalistes, Temporellement définis) pour un suivi efficace.' })}
 </p>
 </div>
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
 <Button type="submit" isLoading={isLoading}>
 {milestone ? t('common.save') : t('common.create')}
 </Button>
 </div>
 </form>
 </Drawer>
 );
};

export default MilestoneFormDrawer;
