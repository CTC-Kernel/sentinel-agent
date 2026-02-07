/**
 * Essential Asset Form Component
 * Form for creating/editing essential assets in Workshop 1
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from '../../../ui/Icons';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../../utils/cn';
import { PremiumCard } from '../../../ui/PremiumCard';
import { Button } from '../../../ui/button';
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

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


 return (
 <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)]" role="dialog" aria-modal="true">
 <PremiumCard glass className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="flex items-center justify-between mb-6">
 <h3 className="text-lg font-semibold text-foreground">
 {isEditing ? t('ebios.workshop1.editEssentialAsset') : t('ebios.workshop1.addEssentialAsset')}
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
 <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
 {t('ebios.workshop1.assetName')} *
 </label>
 <input
 {...register('name')}
 id="name"
 className={cn(
 "w-full px-4 py-2.5 rounded-3xl border transition-colors",
 "bg-card text-foreground",
 errors.name
  ? "border-red-300 dark:border-red-700"
  : "border-border/40"
 )}
 placeholder={t('ebios.workshop1.assetNamePlaceholder')}
 />
 {errors.name && (
 <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
 )}
 </div>

 {/* Type */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 {t('ebios.workshop1.assetType')} *
 </label>
 <div className="grid grid-cols-3 gap-2">
 {ASSET_TYPES.map((type) => (
 <button
  key={type || 'unknown'}
  type="button"
  onClick={() => setValue('type', type)}
  className={cn(
  "p-3 rounded-3xl border-2 transition-all text-center",
  selectedType === type
  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
  : "border-border/40 hover:border-border/40 dark:hover:border-border"
  )}
 >
  <span className={cn(
  "block text-sm font-medium",
  selectedType === type
  ? "text-purple-600 dark:text-purple-400"
  : "text-muted-foreground"
  )}>
  {t(`ebios.assetTypes.${type}`)}
  </span>
 </button>
 ))}
 </div>
 </div>

 {/* Description */}
 <div>
 <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1.5">
 {t('ebios.workshop1.assetDescription')}
 </label>
 <textarea
 {...register('description')}
 id="description"
 rows={3}
 className="w-full px-4 py-2.5 rounded-3xl border border-border/40 bg-card text-foreground resize-none"
 placeholder={t('ebios.workshop1.assetDescriptionPlaceholder')}
 />
 </div>

 {/* Criticality */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-3">
 {t('ebios.workshop1.criticality')} *
 </label>
 <div className="grid grid-cols-4 gap-2">
 {GRAVITY_SCALE.map((level) => (
 <button
  key={level.level || 'unknown'}
  type="button"
  onClick={() => setValue('criticality', level.level as 1 | 2 | 3 | 4)}
  className={cn(
  "p-3 rounded-3xl border-2 transition-all text-center",
  criticality === level.level
  ? `border-${level.color}-500 bg-${level.color}-50 dark:bg-${level.color}-900/20`
  : "border-border/40"
  )}
 >
  <span className={cn(
  "block text-lg font-bold",
  criticality === level.level
  ? `text-${level.color}-600 dark:text-${level.color}-400`
  : "text-muted-foreground"
  )}>
  {level.level}
  </span>
  <span className={cn(
  "block text-xs mt-1",
  criticality === level.level
  ? `text-${level.color}-600 dark:text-${level.color}-400`
  : "text-muted-foreground"
  )}>
  {level[locale]}
  </span>
 </button>
 ))}
 </div>
 </div>

 {/* Linked Missions */}
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 {t('ebios.workshop1.linkedMissions')} *
 </label>
 {missions.length === 0 ? (
 <p className="text-sm text-muted-foreground italic">
 {t('ebios.workshop1.noMissionsYet')}
 </p>
 ) : (
 <div className="space-y-2 max-h-40 overflow-y-auto">
 {missions.map((mission) => (
  <label
  key={mission.id || 'unknown'}
  htmlFor={`mission-${mission.id}`}
  className={cn(
  "flex items-center gap-3 p-3 rounded-3xl border cursor-pointer transition-colors",
  linkedMissionIds?.includes(mission.id)
  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
  : "border-border/40 hover:border-border/40 dark:hover:border-border"
  )}
  >
  <input
  type="checkbox"
  id={`mission-${mission.id}`}
  checked={linkedMissionIds?.includes(mission.id) || false}
  onChange={() => toggleMission(mission.id)}
  className="w-4 h-4 rounded border-border/40 text-info focus-visible:ring-primary"
  />
  <span className="text-sm text-foreground text-muted-foreground">
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
 <div className="flex items-center justify-between pt-4 border-t border-border/40/50">
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

export default EssentialAssetForm;
