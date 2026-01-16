/**
 * Create EBIOS Analysis Modal
 * Modal for creating a new EBIOS RM analysis
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn } from '../../utils/cn';
import { GlassCard } from '../ui/GlassCard';
import { createEbiosAnalysisSchema, type CreateEbiosAnalysisFormData } from '../../schemas/ebiosSchema';

interface CreateAnalysisModalProps {
  onSave: (data: CreateEbiosAnalysisFormData) => void;
  onClose: () => void;
}

export const CreateAnalysisModal: React.FC<CreateAnalysisModalProps> = ({
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEbiosAnalysisFormData>({
    resolver: zodResolver(createEbiosAnalysisSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = (data: CreateEbiosAnalysisFormData) => {
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('ebios.createAnalysis')}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('ebios.analysisName')} *
            </label>
            <input
              {...register('name')}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border transition-colors",
                "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
                errors.name
                  ? "border-red-300 dark:border-red-700"
                  : "border-gray-200 dark:border-gray-700 focus:border-blue-500"
              )}
              placeholder={t('ebios.analysisNamePlaceholder')}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('ebios.analysisDescription')}
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:border-blue-500"
              placeholder={t('ebios.analysisDescriptionPlaceholder')}
            />
          </div>

          {/* Sector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('ebios.sector')}
            </label>
            <select
              {...register('sector')}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">{t('ebios.selectSector')}</option>
              <option value="finance">{t('ebios.sectors.finance')}</option>
              <option value="healthcare">{t('ebios.sectors.healthcare')}</option>
              <option value="energy">{t('ebios.sectors.energy')}</option>
              <option value="transport">{t('ebios.sectors.transport')}</option>
              <option value="telecommunications">{t('ebios.sectors.telecommunications')}</option>
              <option value="government">{t('ebios.sectors.government')}</option>
              <option value="industry">{t('ebios.sectors.industry')}</option>
              <option value="retail">{t('ebios.sectors.retail')}</option>
              <option value="other">{t('ebios.sectors.other')}</option>
            </select>
          </div>

          {/* Target Certification Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('ebios.targetCertificationDate')}
            </label>
            <input
              type="date"
              {...register('targetCertificationDate')}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Info Box */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('ebios.createAnalysisInfo')}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
            >
              {t('ebios.startAnalysis')}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

export default CreateAnalysisModal;
