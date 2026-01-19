/**
 * Essential Asset Form Component
 * Form for creating/editing essential assets in Workshop 1
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from '../../../ui/Icons';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../../utils/cn';
import { GlassCard } from '../../../ui/GlassCard';
import { essentialAssetSchema } from '../../../../schemas/ebiosSchema';
import type { EssentialAsset, Mission } from '../../../../types/ebios';
import { GRAVITY_SCALE } from '../../../../data/ebiosLibrary';

interface EssentialAssetFormProps {
  asset: EssentialAsset | null;
  missions: Mission[];
  onSave: (asset: EssentialAsset) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const ASSET_TYPES: EssentialAsset['type'][] = ['information', 'process', 'function'];

export const EssentialAssetForm: React.FC<EssentialAssetFormProps> = ({
  asset,
  missions,
  onSave,
  onDelete,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const isEditing = !!asset;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EssentialAsset>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(essentialAssetSchema) as any,
    defaultValues: asset || {
      id: uuidv4(),
      name: '',
      description: '',
      type: 'information',
      criticality: 2,
      linkedMissionIds: [],
    },
  });

  const criticality = useWatch({ control, name: 'criticality' });
  const selectedType = useWatch({ control, name: 'type' });
  const linkedMissionIds = useWatch({ control, name: 'linkedMissionIds' });

  const handleDelete = useCallback(() => {
    if (asset && onDelete) {
      onDelete(asset.id);
      onClose();
    }
  }, [asset, onDelete, onClose]);

  const toggleMission = (missionId: string) => {
    const current = linkedMissionIds || [];
    if (current.includes(missionId)) {
      setValue('linkedMissionIds', current.filter((id) => id !== missionId));
    } else {
      setValue('linkedMissionIds', [...current, missionId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? t('ebios.workshop1.editEssentialAsset') : t('ebios.workshop1.addEssentialAsset')}
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
              {t('ebios.workshop1.assetName')} *
            </label>
            <input
              {...register('name')}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border transition-colors",
                "bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
                errors.name
                  ? "border-red-300 dark:border-red-700"
                  : "border-gray-200 dark:border-gray-700"
              )}
              placeholder={t('ebios.workshop1.assetNamePlaceholder')}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ebios.workshop1.assetType')} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ASSET_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue('type', type)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-center",
                    selectedType === type
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  )}
                >
                  <span className={cn(
                    "block text-sm font-medium",
                    selectedType === type
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-gray-600 dark:text-gray-400"
                  )}>
                    {t(`ebios.assetTypes.${type}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('ebios.workshop1.assetDescription')}
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              placeholder={t('ebios.workshop1.assetDescriptionPlaceholder')}
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
                      : "border-gray-200 dark:border-gray-700"
                  )}
                >
                  <span className={cn(
                    "block text-lg font-bold",
                    criticality === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-gray-500"
                  )}>
                    {level.level}
                  </span>
                  <span className={cn(
                    "block text-xs mt-1",
                    criticality === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-gray-400"
                  )}>
                    {level[locale]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Linked Missions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ebios.workshop1.linkedMissions')} *
            </label>
            {missions.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                {t('ebios.workshop1.noMissionsYet')}
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {missions.map((mission) => (
                  <label
                    key={mission.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                      linkedMissionIds?.includes(mission.id)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={linkedMissionIds?.includes(mission.id) || false}
                      onChange={() => toggleMission(mission.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {mission.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {errors.linkedMissionIds && (
              <p className="mt-1 text-sm text-red-500">{errors.linkedMissionIds.message}</p>
            )}
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
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium"
                  >
                    {t('common.delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 rounded-lg text-gray-500 text-sm font-medium"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                className="px-4 py-2 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
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

export default EssentialAssetForm;
