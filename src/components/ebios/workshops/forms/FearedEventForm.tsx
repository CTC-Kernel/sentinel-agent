/**
 * Feared Event Form Component
 * Form for creating/editing feared events in Workshop 1
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from '../../../ui/Icons';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../../utils/cn';
import { GlassCard } from '../../../ui/GlassCard';
import { Button } from '../../../ui/button';
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
    control,
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

  const gravity = useWatch({ control, name: 'gravity' });
  const impactType = useWatch({ control, name: 'impactType' });
  const linkedMissionIds = useWatch({ control, name: 'linkedMissionIds' });
  const linkedEssentialAssetIds = useWatch({ control, name: 'linkedEssentialAssetIds' });

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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditing ? t('ebios.workshop1.editFearedEvent') : t('ebios.workshop1.addFearedEvent')}
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
              {t('ebios.workshop1.eventName')} *
            </label>
            <input
              {...register('name')}
              className={cn(
                "w-full px-4 py-2.5 rounded-xl border transition-colors",
                "bg-white dark:bg-slate-800 text-slate-900 dark:text-white",
                errors.name
                  ? "border-red-300 dark:border-red-700"
                  : "border-slate-200 dark:border-slate-700"
              )}
              placeholder={t('ebios.workshop1.eventNamePlaceholder')}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Impact Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    )}
                  >
                    <span className={cn(
                      "block text-sm font-semibold",
                      impactType === type
                        ? `text-${typeInfo.color}-600 dark:text-${typeInfo.color}-400`
                        : "text-slate-600 dark:text-slate-400"
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('ebios.workshop1.eventDescription')}
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
              placeholder={t('ebios.workshop1.eventDescriptionPlaceholder')}
            />
          </div>

          {/* Gravity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
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
                      : "border-slate-200 dark:border-slate-700"
                  )}
                >
                  <span className={cn(
                    "block text-xl font-bold",
                    gravity === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-slate-500"
                  )}>
                    G{level.level}
                  </span>
                  <span className={cn(
                    "block text-xs mt-1",
                    gravity === level.level
                      ? `text-${level.color}-600 dark:text-${level.color}-400`
                      : "text-slate-400"
                  )}>
                    {level[locale]}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {GRAVITY_SCALE.find((l) => l.level === gravity)?.description[locale]}
            </p>
          </div>

          {/* Linked Items - Two columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Linked Missions */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('ebios.workshop1.linkedMissions')} *
              </label>
              {missions.length === 0 ? (
                <p className="text-sm text-slate-500 italic p-3 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
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
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={linkedMissionIds?.includes(mission.id) || false}
                        onChange={() => toggleMission(mission.id)}
                        className="w-4 h-4 rounded border-slate-300 text-info"
                      />
                      <span className="text-slate-700 dark:text-slate-300 truncate">
                        {mission.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Essential Assets */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('ebios.workshop1.linkedEssentialAssets')} *
              </label>
              {essentialAssets.length === 0 ? (
                <p className="text-sm text-slate-500 italic p-3 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
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
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={linkedEssentialAssetIds?.includes(asset.id) || false}
                        onChange={() => toggleEssentialAsset(asset.id)}
                        className="w-4 h-4 rounded border-slate-300 text-purple-500"
                      />
                      <span className="text-slate-700 dark:text-slate-300 truncate">
                        {asset.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
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
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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

export default FearedEventForm;
