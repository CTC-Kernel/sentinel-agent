/**
 * Feared Event Form Component
 * Form for creating/editing feared events in Workshop 1
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../../utils/cn';
import { GlassCard } from '../../../ui/GlassCard';
import { fearedEventSchema } from '../../../../schemas/ebiosSchema';
import type { FearedEvent, Mission, EssentialAsset } from '../../../../types/ebios';
import { GRAVITY_SCALE, IMPACT_TYPE_LABELS } from '../../../../data/ebiosLibrary';

interface FearedEventFormProps {
  event: FearedEvent | null;
  missions: Mission[];
  essentialAssets: EssentialAsset[];
  onSave: (event: FearedEvent) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const IMPACT_TYPES: FearedEvent['impactType'][] = ['confidentiality', 'integrity', 'availability'];

export const FearedEventForm: React.FC<FearedEventFormProps> = ({
  event,
  missions,
  essentialAssets,
  onSave,
  onDelete,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const isEditing = !!event;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FearedEvent>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(fearedEventSchema) as any,
    defaultValues: event || {
      id: uuidv4(),
      name: '',
      description: '',
      impactType: 'confidentiality',
      gravity: 2,
      linkedMissionIds: [],
      linkedEssentialAssetIds: [],
    },
  });



  const gravity = watch('gravity');
  const impactType = watch('impactType');
  const linkedMissionIds = watch('linkedMissionIds');
  const linkedEssentialAssetIds = watch('linkedEssentialAssetIds');

  const handleDelete = useCallback(() => {
    if (event && onDelete) {
      onDelete(event.id);
      onClose();
    }
  }, [event, onDelete, onClose]);

  const toggleMission = (missionId: string) => {
    const current = linkedMissionIds || [];
    if (current.includes(missionId)) {
      setValue('linkedMissionIds', current.filter((id) => id !== missionId));
    } else {
      setValue('linkedMissionIds', [...current, missionId]);
    }
  };

  const toggleEssentialAsset = (assetId: string) => {
    const current = linkedEssentialAssetIds || [];
    if (current.includes(assetId)) {
      setValue('linkedEssentialAssetIds', current.filter((id) => id !== assetId));
    } else {
      setValue('linkedEssentialAssetIds', [...current, assetId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? t('ebios.workshop1.editFearedEvent') : t('ebios.workshop1.addFearedEvent')}
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
              {t('ebios.workshop1.eventName')} *
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
              placeholder={t('ebios.workshop1.eventNamePlaceholder')}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Impact Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ebios.workshop1.impactType')} *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {IMPACT_TYPES.map((type) => {
                const typeInfo = IMPACT_TYPE_LABELS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setValue('impactType', type)}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all text-center",
                      impactType === type
                        ? `border-${typeInfo.color}-500 bg-${typeInfo.color}-50 dark:bg-${typeInfo.color}-900/20`
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    )}
                  >
                    <span className={cn(
                      "block text-sm font-semibold",
                      impactType === type
                        ? `text-${typeInfo.color}-600 dark:text-${typeInfo.color}-400`
                        : "text-gray-600 dark:text-gray-400"
                    )}>
                      {typeInfo[locale]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('ebios.workshop1.eventDescription')}
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              placeholder={t('ebios.workshop1.eventDescriptionPlaceholder')}
            />
          </div>

          {/* Gravity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('ebios.workshop1.gravity')} *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {GRAVITY_SCALE.map((level) => (
                <button
                  key={level.level}
                  type="button"
                  onClick={() => setValue('gravity', level.level as 1 | 2 | 3 | 4)}
                  className={cn(
                    "p-3 rounded-xl border-2 transition-all text-center",
                    gravity === level.level
                      ? `border-${level.color}-500 bg-${level.color}-50 dark:bg-${level.color}-900/20`
                      : "border-gray-200 dark:border-gray-700"
                  )}
                >
                  <span className={cn(
                    "block text-xl font-bold",
                    gravity === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-gray-500"
                  )}>
                    G{level.level}
                  </span>
                  <span className={cn(
                    "block text-xs mt-1",
                    gravity === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-gray-400"
                  )}>
                    {level[locale]}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {GRAVITY_SCALE.find((l) => l.level === gravity)?.description[locale]}
            </p>
          </div>

          {/* Linked Items - Two columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Linked Missions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('ebios.workshop1.linkedMissions')} *
              </label>
              {missions.length === 0 ? (
                <p className="text-sm text-gray-500 italic p-3 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  {t('ebios.workshop1.noMissionsYet')}
                </p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {missions.map((mission) => (
                    <label
                      key={mission.id}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors text-sm",
                        linkedMissionIds?.includes(mission.id)
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={linkedMissionIds?.includes(mission.id) || false}
                        onChange={() => toggleMission(mission.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300 truncate">
                        {mission.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Essential Assets */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('ebios.workshop1.linkedEssentialAssets')} *
              </label>
              {essentialAssets.length === 0 ? (
                <p className="text-sm text-gray-500 italic p-3 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  {t('ebios.workshop1.noEssentialAssetsYet')}
                </p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {essentialAssets.map((asset) => (
                    <label
                      key={asset.id}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors text-sm",
                        linkedEssentialAssetIds?.includes(asset.id)
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={linkedEssentialAssetIds?.includes(asset.id) || false}
                        onChange={() => toggleEssentialAsset(asset.id)}
                        className="w-4 h-4 rounded border-gray-300 text-purple-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300 truncate">
                        {asset.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
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

export default FearedEventForm;
