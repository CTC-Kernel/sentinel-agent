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
  name: z.string().min(3, 'Le nom doit contenir au moins 3 caractères'),
  description: z.string().optional(),
  phase: z.enum(['plan', 'do', 'check', 'act']),
  dueDate: z.string().min(1, 'La date d\'échéance est requise'),
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
    formState: { errors },
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

  const title = milestone ? 'Modifier le jalon' : 'Nouveau jalon';
  const subtitle = 'Définissez les détails du jalon SMSI';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      width="max-w-xl"
    >
      <form
        id="milestone-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col h-full"
      >
        <div className="flex-1 space-y-6 pt-6 px-1">
          {/* Name */}
          <FloatingLabelInput
            label="Nom du jalon"
            placeholder="Ex: Rédaction de la politique SMSI"
            required
            error={errors.name?.message}
            {...register('name')}
          />

          {/* Description */}
          <FloatingLabelTextarea
            label="Description"
            placeholder="Décrivez les objectifs et livrables attendus..."
            rows={3}
            error={errors.description?.message}
            {...register('description')}
          />

          {/* Phase Selection - Story 20.2 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
              Phase PDCA *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(PHASE_CONFIG) as PDCAPhase[]).map((phase) => {
                const config = PHASE_CONFIG[phase];
                const style = PHASE_STYLES[phase];
                const isSelected = selectedPhase === phase;
                const PhaseIcon = config.icon as React.ComponentType<{ className?: string }>;

                return (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => setValue('phase', phase)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                      isSelected
                        ? `${style.borderActive} ${style.bgActive}`
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
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
                            : 'text-slate-700 dark:text-slate-300'
                        )}
                      >
                        {config.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-300 line-clamp-1">
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
            label="Date d'échéance"
            required
            error={errors.dueDate?.message}
            {...register('dueDate')}
          />

          {/* Responsible Person - Story 20.4 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Responsable
            </label>
            <select
              {...register('responsibleId')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus-visible:ring-2 focus-visible:ring-brand-400 focus:border-blue-500"
            >
              <option value="">Non assigné</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
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
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Conseil :</strong> Définissez des jalons SMART (Spécifiques,
              Mesurables, Atteignables, Réalistes, Temporellement définis) pour
              un suivi efficace.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
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
