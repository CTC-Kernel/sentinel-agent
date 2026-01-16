/**
 * Mission Form Component
 * Form for creating/editing missions in Workshop 1
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../../utils/cn';
import { GlassCard } from '../../../ui/GlassCard';
import { missionSchema } from '../../../../schemas/ebiosSchema';
import type { Mission } from '../../../../types/ebios';
import { GRAVITY_SCALE } from '../../../../data/ebiosLibrary';

interface MissionFormProps {
  mission: Mission | null;
  onSave: (mission: Mission) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export const MissionForm: React.FC<MissionFormProps> = ({
  mission,
  onSave,
  onDelete,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const isEditing = !!mission;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Mission>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(missionSchema) as any,
    defaultValues: mission || {
      id: uuidv4(),
      name: '',
      description: '',
      criticality: 2,
      linkedAssetIds: [],
    },
  });


  // eslint-disable-next-line react-hooks/incompatible-library
  const criticality = watch('criticality');

  const handleDelete = useCallback(() => {
    if (mission && onDelete) {
      onDelete(mission.id);
      onClose();
    }
  }, [mission, onDelete, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? t('ebios.workshop1.editMission') : t('ebios.workshop1.addMission')}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('ebios.workshop1.missionName')} *
            </label>
            <input
              {...register('name')}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border transition-colors",
                "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
                errors.name
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                  : "border-gray-200 dark:border-gray-700 focus:ring-blue-500"
              )}
              placeholder={t('ebios.workshop1.missionNamePlaceholder')}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('ebios.workshop1.missionDescription')}
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border transition-colors resize-none",
                "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
                "border-gray-200 dark:border-gray-700 focus:ring-blue-500"
              )}
              placeholder={t('ebios.workshop1.missionDescriptionPlaceholder')}
            />
          </div>

          {/* Criticality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('ebios.workshop1.criticality')} *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {GRAVITY_SCALE.map((level) => (
                <button
                  key={level.level}
                  type="button"
                  onClick={() => setValue('criticality', level.level as 1 | 2 | 3 | 4)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-center",
                    criticality === level.level
                      ? `border-${level.color}-500 bg-${level.color}-50 dark:bg-${level.color}-900/20`
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  <span className={cn(
                    "block text-lg font-bold",
                    criticality === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-gray-500 dark:text-gray-400"
                  )}>
                    {level.level}
                  </span>
                  <span className={cn(
                    "block text-xs mt-1",
                    criticality === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-gray-400 dark:text-gray-500"
                  )}>
                    {level[locale]}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {GRAVITY_SCALE.find((l) => l.level === criticality)?.description[locale]}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            {isEditing && onDelete ? (
              showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-500">{t('common.confirmDelete')}</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-gray-500 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete')}
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
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
                {isEditing ? t('common.save') : t('common.create')}
              </button>
            </div>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

export default MissionForm;
