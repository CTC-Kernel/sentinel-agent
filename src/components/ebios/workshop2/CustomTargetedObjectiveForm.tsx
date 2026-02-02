/**
 * Custom Targeted Objective Form
 * Story 16.3: Définition des Objectifs Visés (custom objectives)
 *
 * Modal form for creating and editing custom targeted objectives
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Flag, Save, Trash2 } from '../../ui/Icons';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../utils/cn';
import { PremiumCard } from '../../ui/PremiumCard';
import { Button } from '../../ui/button';
import { ConfirmModal } from '../../ui/ConfirmModal';
import type { TargetedObjective } from '../../../types/ebios';
import { IMPACT_TYPE_LABELS } from '../../../data/ebiosLibrary';

const IMPACT_TYPES = ['confidentiality', 'integrity', 'availability'] as const;
type ImpactType = typeof IMPACT_TYPES[number];

// Form validation schema
const customObjectiveSchema = z.object({
  code: z.string().min(1, 'Code is required').max(10, 'Code is too long'),
  name: z.string().min(3, 'Name required (min 3 characters)'),
  impactType: z.string().refine(
    (val): val is ImpactType => IMPACT_TYPES.includes(val as ImpactType),
    { message: 'Impact type is required' }
  ),
  description: z.string().min(10, 'Description required (min 10 characters)'),
});

type CustomObjectiveFormData = z.infer<typeof customObjectiveSchema>;

interface CustomTargetedObjectiveFormProps {
  objective?: TargetedObjective | null;
  onSave: (objective: TargetedObjective) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  existingCodes?: string[];
}

export const CustomTargetedObjectiveForm: React.FC<CustomTargetedObjectiveFormProps> = ({
  objective,
  onSave,
  onDelete,
  onClose,
  existingCodes = [],
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const isEditing = !!objective;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<CustomObjectiveFormData>({
    resolver: zodResolver(customObjectiveSchema),
    defaultValues: {
      code: objective?.code || '',
      name: objective?.name || '',
      impactType: objective?.impactType || 'confidentiality',
      description: objective?.description || '',
    },
  });

  useEffect(() => {
    if (objective) {
      reset({
        code: objective.code,
        name: objective.name,
        impactType: objective.impactType,
        description: objective.description,
      });
    }
  }, [objective, reset]);

  const onSubmit = (data: CustomObjectiveFormData) => {
    // Check for duplicate codes (except when editing the same objective)
    if (!isEditing && existingCodes.includes(data.code)) {
      setError('code', { message: 'This code already exists' });
      return;
    }

    const targetedObjective: TargetedObjective = {
      id: objective?.id || uuidv4(),
      code: data.code,
      name: data.name,
      impactType: data.impactType as ImpactType,
      description: data.description,
      isANSSIStandard: false,
      organizationId: objective?.organizationId || null,
      createdAt: objective?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(targetedObjective);
  };

  const handleDelete = () => {
    if (objective && onDelete) {
      onDelete(objective.id);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)]">
      <PremiumCard glass className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-3xl bg-amber-100 dark:bg-amber-900/30">
              <Flag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEditing
                  ? t('ebios.workshop2.editObjective', 'Modifier l\'objectif visé')
                  : t('ebios.workshop2.addCustomObjective', 'Ajouter un objectif personnalisé')}
              </h3>
              <p className="text-sm text-slate-600">
                {t('ebios.workshop2.customObjectiveHelp', 'Objectif visé spécifique à votre contexte')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-3xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.objectiveCode', 'Code')} *
            </label>
            <input
              {...register('code')}
              type="text"
              placeholder="OV-XX"
              className={cn(
                "w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800",
                errors.code
                  ? "border-red-500"
                  : "border-border/40 dark:border-slate-700"
              )}
            />
            {errors.code && (
              <p className="mt-1 text-sm text-red-500">{errors.code.message}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.objectiveName', 'Nom')} *
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder={t('ebios.workshop2.objectiveNamePlaceholder', 'Ex: Atteinte à la réputation locale')}
              className={cn(
                "w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800",
                errors.name
                  ? "border-red-500"
                  : "border-border/40 dark:border-slate-700"
              )}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Impact Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.objectiveImpactType', 'Type d\'impact')} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {IMPACT_TYPES.map((type) => {
                const info = IMPACT_TYPE_LABELS[type];
                return (
                  <label
                    key={type || 'unknown'}
                    className={cn(
                      "flex flex-col items-center p-3 rounded-3xl border cursor-pointer transition-all",
                      "hover:border-border/40 dark:hover:border-slate-600"
                    )}
                  >
                    <input
                      {...register('impactType')}
                      type="radio"
                      value={type}
                      className="sr-only"
                    />
                    <span className={cn(
                      "w-3 h-3 rounded-full mb-2",
                      `bg-${info.color}-500`
                    )} />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center">
                      {info[locale]}
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.impactType && (
              <p className="mt-1 text-sm text-red-500">{errors.impactType.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.objectiveDescription', 'Description')} *
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder={t('ebios.workshop2.objectiveDescriptionPlaceholder', 'Décrivez cet objectif visé...')}
              className={cn(
                "w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800 resize-none",
                errors.description
                  ? "border-red-500"
                  : "border-border/40 dark:border-slate-700"
              )}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Badge indicator */}
          <div className="flex items-center gap-2 p-3 rounded-3xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500 text-white">
              Custom
            </span>
            <span className="text-sm text-purple-700 dark:text-purple-300">
              {t('ebios.workshop2.customBadgeNote', 'Cet objectif sera marqué comme personnalisé')}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border/40 dark:border-slate-700/50">
            <div>
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('common.delete', 'Supprimer')}
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel', 'Annuler')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? t('common.save', 'Enregistrer') : t('common.add', 'Ajouter')}
              </Button>
            </div>
          </div>
        </form>

        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title={t('ebios.workshop2.deleteObjectiveTitle', 'Supprimer l\'objectif visé')}
          message={t('ebios.workshop2.confirmDeleteObjective', 'Êtes-vous sûr de vouloir supprimer cet objectif visé ?')}
          type="danger"
          confirmText={t('common.delete', 'Supprimer')}
          cancelText={t('common.cancel', 'Annuler')}
        />
      </PremiumCard>
    </div>
  );
};

export default CustomTargetedObjectiveForm;
