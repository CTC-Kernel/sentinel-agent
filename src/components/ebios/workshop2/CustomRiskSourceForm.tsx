/**
 * Custom Risk Source Form
 * Story 16.2: Création de Sources de Risque Custom
 *
 * Modal form for creating and editing custom risk sources
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Users, Save, Trash2 } from '../../ui/Icons';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../utils/cn';
import { PremiumCard } from '../../ui/PremiumCard';
import { Button } from '../../ui/button';
import { ConfirmModal } from '../../ui/ConfirmModal';
import type { RiskSource, RiskSourceCategory } from '../../../types/ebios';
import { RISK_SOURCE_CATEGORIES } from '../../../types/ebios';
import { RISK_SOURCE_CATEGORY_LABELS } from '../../../data/ebiosLibrary';

// Form validation schema
const customRiskSourceSchema = z.object({
  code: z.string().min(1, 'Code requis').max(10, 'Code trop long'),
  name: z.string().min(3, 'Nom requis (min 3 caractères)'),
  category: z.string().refine(
    (val): val is RiskSourceCategory => RISK_SOURCE_CATEGORIES.includes(val as RiskSourceCategory),
    { message: 'Catégorie requise' }
  ),
  description: z.string().min(10, 'Description requise (min 10 caractères)'),
  motivation: z.string().optional(),
  resources: z.string().optional(),
});

type CustomRiskSourceFormData = z.infer<typeof customRiskSourceSchema>;

interface CustomRiskSourceFormProps {
  source?: RiskSource | null;
  onSave: (source: RiskSource) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  existingCodes?: string[];
}

export const CustomRiskSourceForm: React.FC<CustomRiskSourceFormProps> = ({
  source,
  onSave,
  onDelete,
  onClose,
  existingCodes = [],
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const isEditing = !!source;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<CustomRiskSourceFormData>({
    resolver: zodResolver(customRiskSourceSchema),
    defaultValues: {
      code: source?.code || '',
      name: source?.name || '',
      category: source?.category || 'opportunist',
      description: source?.description || '',
      motivation: source?.motivation || '',
      resources: source?.resources || '',
    },
  });

  useEffect(() => {
    if (source) {
      reset({
        code: source.code,
        name: source.name,
        category: source.category,
        description: source.description,
        motivation: source.motivation || '',
        resources: source.resources || '',
      });
    }
  }, [source, reset]);

  const onSubmit = (data: CustomRiskSourceFormData) => {
    // Check for duplicate codes (except when editing the same source)
    if (!isEditing && existingCodes.includes(data.code)) {
      setError('code', { message: 'Ce code existe déjà' });
      return;
    }

    const riskSource: RiskSource = {
      id: source?.id || uuidv4(),
      code: data.code,
      name: data.name,
      category: data.category as RiskSourceCategory,
      description: data.description,
      motivation: data.motivation,
      resources: data.resources,
      isANSSIStandard: false,
      organizationId: source?.organizationId || null,
      createdAt: source?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(riskSource);
  };

  const handleDelete = () => {
    if (source && onDelete) {
      onDelete(source.id);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <PremiumCard glass className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100 dark:bg-amber-900/30">
              <Users className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEditing
                  ? t('ebios.workshop2.editRiskSource', 'Modifier la source de risque')
                  : t('ebios.workshop2.addCustomSource', 'Ajouter une source personnalisée')}
              </h3>
              <p className="text-sm text-slate-500">
                {t('ebios.workshop2.customSourceHelp', 'Source de risque spécifique à votre contexte')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.sourceCode', 'Code')} *
            </label>
            <input
              {...register('code')}
              type="text"
              placeholder="SR-XX"
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-800",
                errors.code
                  ? "border-red-500"
                  : "border-slate-200 dark:border-slate-700"
              )}
            />
            {errors.code && (
              <p className="mt-1 text-sm text-red-500">{errors.code.message}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.sourceName', 'Nom')} *
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder={t('ebios.workshop2.sourceNamePlaceholder', 'Ex: Concurrent local')}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-800",
                errors.name
                  ? "border-red-500"
                  : "border-slate-200 dark:border-slate-700"
              )}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.sourceCategory', 'Catégorie')} *
            </label>
            <select
              {...register('category')}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-800",
                errors.category
                  ? "border-red-500"
                  : "border-slate-200 dark:border-slate-700"
              )}
            >
              {RISK_SOURCE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {RISK_SOURCE_CATEGORY_LABELS[cat]?.[locale] || cat}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-500">{errors.category.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.sourceDescription', 'Description')} *
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder={t('ebios.workshop2.sourceDescriptionPlaceholder', 'Décrivez cette source de risque...')}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-800 resize-none",
                errors.description
                  ? "border-red-500"
                  : "border-slate-200 dark:border-slate-700"
              )}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Motivation */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.sourceMotivation', 'Motivation')}
            </label>
            <textarea
              {...register('motivation')}
              rows={2}
              placeholder={t('ebios.workshop2.sourceMotivationPlaceholder', 'Quelles sont les motivations de cette source ?')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"
            />
          </div>

          {/* Resources */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop2.sourceResources', 'Ressources / Capacités')}
            </label>
            <input
              {...register('resources')}
              type="text"
              placeholder={t('ebios.workshop2.sourceResourcesPlaceholder', 'Ex: Moyennes, outils standards')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          {/* Badge indicator */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500 text-white">
              Custom
            </span>
            <span className="text-sm text-purple-700 dark:text-purple-300">
              {t('ebios.workshop2.customBadgeNote', 'Cette source sera marquée comme personnalisée')}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
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
          title={t('ebios.workshop2.deleteSourceTitle', 'Supprimer la source de risque')}
          message={t('ebios.workshop2.confirmDeleteSource', 'Êtes-vous sûr de vouloir supprimer cette source de risque ?')}
          type="danger"
          confirmText={t('common.delete', 'Supprimer')}
          cancelText={t('common.cancel', 'Annuler')}
        />
      </PremiumCard>
    </div>
  );
};

export default CustomRiskSourceForm;
