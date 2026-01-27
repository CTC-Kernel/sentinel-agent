/**
 * OperationalScenarioForm.tsx
 * Modal form for creating/editing operational scenarios
 *
 * Story 18.1: Déclinaison en Modes Opératoires
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Cpu, AlertCircle, Info } from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { PremiumCard } from '../../ui/PremiumCard';
import type { OperationalScenario, StrategicScenario } from '../../../types/ebios';

// Form schema
const operationalScenarioSchema = z.object({
  name: z.string().min(5, 'Nom requis (min 5 caractères)'),
  description: z.string().min(10, 'Description requise (min 10 caractères)'),
  strategicScenarioId: z.string().min(1, 'Scénario stratégique requis'),
});

type OperationalScenarioFormData = z.infer<typeof operationalScenarioSchema>;

interface OperationalScenarioFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<OperationalScenario>) => void;
  scenario?: OperationalScenario | null;
  strategicScenarios: StrategicScenario[];
  existingScenarios: OperationalScenario[];
}

export const OperationalScenarioForm: React.FC<OperationalScenarioFormProps> = ({
  isOpen,
  onClose,
  onSave,
  scenario,
  strategicScenarios,
  existingScenarios,
}) => {
  const { t } = useTranslation();
  const isEdit = !!scenario?.id;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OperationalScenarioFormData>({
    resolver: zodResolver(operationalScenarioSchema),
    defaultValues: {
      name: scenario?.name || '',
      description: scenario?.description || '',
      strategicScenarioId: scenario?.strategicScenarioId || '',
    },
  });

  const watchedStrategicId = useWatch({ control, name: 'strategicScenarioId' });
  const selectedStrategic = strategicScenarios.find(s => s.id === watchedStrategicId);

  // Generate scenario code
  const generateCode = (): string => {
    const nextNumber = existingScenarios.length + 1;
    return `SO-${String(nextNumber).padStart(3, '0')}`;
  };

  // Reset form when scenario changes
  useEffect(() => {
    if (scenario) {
      reset({
        name: scenario.name,
        description: scenario.description || '',
        strategicScenarioId: scenario.strategicScenarioId,
      });
    } else {
      reset({
        name: '',
        description: '',
        strategicScenarioId: '',
      });
    }
  }, [scenario, reset]);

  const currentName = useWatch({ control, name: 'name' });

  // Auto-fill name when strategic scenario is selected (only for new scenarios)
  useEffect(() => {
    if (!isEdit && selectedStrategic && !currentName) {
      setValue('name', `${selectedStrategic.name} - Opérationnel`);
    }
  }, [selectedStrategic, isEdit, setValue, currentName]);

  const onSubmit = (data: OperationalScenarioFormData) => {
    onSave({
      ...scenario,
      ...data,
      code: scenario?.code || generateCode(),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <PremiumCard glass className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-100 dark:bg-amber-900/30">
              <Cpu className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEdit ? t('ebios.workshop4.editScenario') : t('ebios.workshop4.newScenario')}
              </h2>
              <p className="text-sm text-slate-500">
                {!isEdit && `Code: ${generateCode()}`}
                {isEdit && `Code: ${scenario?.code || 'SO-XXX'}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          {/* Strategic Scenario Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-muted-foreground">
              {t('ebios.workshop4.parentStrategicScenario')} *
            </label>
            <select
              {...register('strategicScenarioId')}
              className={cn(
                "w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white",
                errors.strategicScenarioId
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-slate-200 dark:border-slate-700'
              )}
            >
              <option value="">{t('ebios.workshop4.selectStrategicScenario')}</option>
              {strategicScenarios.map((ss) => (
                <option key={ss.id} value={ss.id}>
                  {ss.name} (G{ss.gravity})
                </option>
              ))}
            </select>
            {errors.strategicScenarioId && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.strategicScenarioId.message}
              </p>
            )}
          </div>

          {/* Selected Strategic Scenario Info */}
          {selectedStrategic && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-300">
                    {selectedStrategic.name}
                  </p>
                  {selectedStrategic.description && (
                    <p className="mt-1 text-blue-700 dark:text-blue-400">
                      {selectedStrategic.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      selectedStrategic.gravity >= 3
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    )}>
                      Gravité: G{selectedStrategic.gravity}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-muted-foreground">
              {t('ebios.workshop4.scenarioName')} *
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder="Ex: Phishing ciblé via messagerie"
              className={cn(
                "w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white",
                errors.name
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-slate-200 dark:border-slate-700'
              )}
            />
            {errors.name && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-muted-foreground">
              {t('ebios.workshop4.scenarioDescription')} *
            </label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Décrivez le mode opératoire détaillé de ce scénario..."
              className={cn(
                "w-full px-4 py-3 rounded-xl border bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none",
                errors.description
                  ? 'border-red-300 dark:border-red-700'
                  : 'border-slate-200 dark:border-slate-700'
              )}
            />
            {errors.description && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.description.message}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {t('ebios.workshop4.descriptionHelp')}
            </p>
          </div>

          {/* Info about next steps */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('ebios.workshop4.nextSteps')}
            </h4>
            <ul className="text-sm text-slate-500 dark:text-slate-300 space-y-1 list-disc list-inside">
              <li>{t('ebios.workshop4.nextStep1')}</li>
              <li>{t('ebios.workshop4.nextStep2')}</li>
              <li>{t('ebios.workshop4.nextStep3')}</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
            >
              {isSubmitting ? t('common.saving') : isEdit ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </PremiumCard>
    </div>
  );
};

export default OperationalScenarioForm;
