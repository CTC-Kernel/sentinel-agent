/**
 * Supporting Asset Form Component
 * Form for creating/editing supporting assets in Workshop 1
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from '../../../ui/Icons';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../../utils/cn';
import { PremiumCard } from '../../../ui/PremiumCard';
import { Button } from '../../../ui/button';
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
      <PremiumCard glass className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditing ? t('ebios.workshop1.editSupportingAsset') : t('ebios.workshop1.addSupportingAsset')}
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

        <form onSubmit={handleSubmit(handleSave)} className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('ebios.workshop1.assetName')} *
            </label>
            <input
              {...register('name')}
              id="name"
              className={cn(
                "w-full px-4 py-2.5 rounded-3xl border transition-colors",
                "bg-white dark:bg-slate-800 text-slate-900 dark:text-white",
                errors.name
                  ? "border-red-300 dark:border-red-700"
                  : "border-border/40 dark:border-slate-700"
              )}
              placeholder={t('ebios.workshop1.supportingAssetNamePlaceholder')}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('ebios.workshop1.assetType')} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORTING_ASSET_TYPES.map((type) => (
                <button
                  key={type || 'unknown'}
                  type="button"
                  onClick={() => setValue('type', type)}
                  className={cn(
                    "p-2.5 rounded-3xl border-2 transition-all text-center",
                    selectedType === type
                      ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
                      : "border-border/40 dark:border-slate-700 hover:border-border/40"
                  )}
                >
                  <span className={cn(
                    "block text-xs font-medium",
                    selectedType === type
                      ? "text-cyan-600 dark:text-cyan-400"
                      : "text-slate-600 dark:text-slate-300"
                  )}>
                    {t(`ebios.supportingAssetTypes.${type}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('ebios.workshop1.assetDescription')}
            </label>
            <textarea
              {...register('description')}
              id="description"
              rows={3}
              className="w-full px-4 py-2.5 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
              placeholder={t('ebios.workshop1.supportingAssetDescriptionPlaceholder')}
            />
          </div>

          {/* Linked Essential Assets */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('ebios.workshop1.linkedEssentialAssets')} *
            </label>
            {essentialAssets.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                {t('ebios.workshop1.noEssentialAssetsYet')}
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {essentialAssets.map((essentialAsset) => (
                  <label
                    key={essentialAsset.id || 'unknown'}
                    htmlFor={`essential-asset-${essentialAsset.id}`}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-3xl border cursor-pointer transition-colors",
                      linkedEssentialAssetIds?.includes(essentialAsset.id)
                        ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20"
                        : "border-border/40 dark:border-slate-700 hover:border-border/40"
                    )}
                  >
                    <span className="sr-only">Sélectionner l'actif essentiel: {essentialAsset.name}</span>
                    <input
                      type="checkbox"
                      id={`essential-asset-${essentialAsset.id}`}
                      checked={linkedEssentialAssetIds?.includes(essentialAsset.id) || false}
                      onChange={() => toggleEssentialAsset(essentialAsset.id)}
                      className="w-4 h-4 rounded border-border/40 text-cyan-500 focus:ring-cyan-500"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-slate-700 dark:text-slate-300 block truncate">
                        {essentialAsset.name}
                      </span>
                      <span className="text-xs text-slate-600">
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
          <div className="flex items-center justify-between pt-4 border-t border-border/40 dark:border-slate-700/50">
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
      </PremiumCard>
    </div>
  );
};

export default SupportingAssetForm;
