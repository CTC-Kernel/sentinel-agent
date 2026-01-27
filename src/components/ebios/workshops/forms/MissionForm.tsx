/**
 * Mission Form Component
 * Form for creating/editing missions in Workshop 1
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from '../../../ui/Icons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../../utils/cn';
import { GlassCard } from '../../../ui/GlassCard';
import { Button } from '../../../ui/button';
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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditing ? t('ebios.workshop1.editMission') : t('ebios.workshop1.addMission')}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('ebios.workshop1.missionName')} *
            </label>
            <input
              {...register('name')}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border transition-colors",
                "bg-white dark:bg-slate-800 text-slate-900 dark:text-white",
                errors.name
                  ? "border-red-300 dark:border-red-700 focus:ring-red-500"
                  : "border-slate-200 dark:border-slate-700 focus-visible:ring-brand-500"
              )}
              placeholder={t('ebios.workshop1.missionNamePlaceholder')}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('ebios.workshop1.missionDescription')}
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border transition-colors resize-none",
                "bg-white dark:bg-slate-800 text-slate-900 dark:text-white",
                "border-slate-200 dark:border-slate-700 focus-visible:ring-brand-500"
              )}
              placeholder={t('ebios.workshop1.missionDescriptionPlaceholder')}
            />
          </div>

          {/* Criticality */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
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
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  )}
                >
                  <span className={cn(
                    "block text-lg font-bold",
                    criticality === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-slate-500 dark:text-slate-400"
                  )}>
                    {level.level}
                  </span>
                  <span className={cn(
                    "block text-xs mt-1",
                    criticality === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-slate-400 dark:text-slate-500"
                  )}>
                    {level[locale]}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {GRAVITY_SCALE.find((l) => l.level === criticality)?.description[locale]}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-slate-700/50">
            {isEditing && onDelete ? (
              showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-500">{t('common.confirmDelete')}</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                  >
                    {t('common.delete')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  {t('common.delete')}
                </Button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                loadingText={t('common.saving')}
              >
                {isEditing ? t('common.save') : t('common.create')}
              </Button>
            </div>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

export default MissionForm;
