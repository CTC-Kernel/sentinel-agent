/**
 * Supporting Asset Form Component
 * Form for creating/editing supporting assets in Workshop 1
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../../utils/cn';
import { GlassCard } from '../../../ui/GlassCard';
import { supportingAssetSchema } from '../../../../schemas/ebiosSchema';
import type { SupportingAsset, EssentialAsset } from '../../../../types/ebios';

interface SupportingAssetFormProps {
  asset: SupportingAsset | null;
  essentialAssets: EssentialAsset[];
  onSave: (asset: SupportingAsset) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const SUPPORTING_ASSET_TYPES: SupportingAsset['type'][] = [
  'hardware',
  'software',
  'network',
  'personnel',
  'site',
  'organization',
];

export const SupportingAssetForm: React.FC<SupportingAssetFormProps> = ({
  asset,
  essentialAssets,
  onSave,
  onDelete,
  onClose,
}) => {
  const { t } = useTranslation();
  const isEditing = !!asset;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SupportingAsset>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(supportingAssetSchema) as any,
    defaultValues: asset || {
      id: uuidv4(),
      name: '',
      description: '',
      type: 'software',
      linkedEssentialAssetIds: [],
    },
  });

  const selectedType = useWatch({ control, name: 'type' });
  const linkedEssentialAssetIds = useWatch({ control, name: 'linkedEssentialAssetIds' });

  const handleSave = useCallback((data: SupportingAsset) => {
    onSave(data);
  }, [onSave]);

  const handleDelete = useCallback(() => {
    if (asset && onDelete) {
      onDelete(asset.id);
      onClose();
    }
  }, [asset, onDelete, onClose]);

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
      <GlassCard className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? t('ebios.workshop1.editSupportingAsset') : t('ebios.workshop1.addSupportingAsset')}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleSave)} className="space-y-5">
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
              placeholder={t('ebios.workshop1.supportingAssetNamePlaceholder')}
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
              {SUPPORTING_ASSET_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue('type', type)}
                  className={cn(
                    "p-2.5 rounded-xl border-2 transition-all text-center",
                    selectedType === type
                      ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  )}
                >
                  <span className={cn(
                    "block text-xs font-medium",
                    selectedType === type
                      ? "text-cyan-600 dark:text-cyan-400"
                      : "text-gray-600 dark:text-gray-400"
                  )}>
                    {t(`ebios.supportingAssetTypes.${type}`)}
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
              placeholder={t('ebios.workshop1.supportingAssetDescriptionPlaceholder')}
            />
          </div>

          {/* Linked Essential Assets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ebios.workshop1.linkedEssentialAssets')} *
            </label>
            {essentialAssets.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                {t('ebios.workshop1.noEssentialAssetsYet')}
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {essentialAssets.map((essentialAsset) => (
                  <label
                    key={essentialAsset.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                      linkedEssentialAssetIds?.includes(essentialAsset.id)
                        ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={linkedEssentialAssetIds?.includes(essentialAsset.id) || false}
                      onChange={() => toggleEssentialAsset(essentialAsset.id)}
                      className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700 dark:text-gray-300 block truncate">
                        {essentialAsset.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {t(`ebios.assetTypes.${essentialAsset.type}`)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {errors.linkedEssentialAssetIds && (
              <p className="mt-1 text-sm text-red-500">{errors.linkedEssentialAssetIds.message}</p>
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

export default SupportingAssetForm;
