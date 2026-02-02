/**
 * Attack Path Form
 * Story 17.2: Définition des Chemins d'Attaque
 *
 * Modal form for creating and editing attack paths
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, TrendingUp, Save, Trash2, ArrowRight } from '../../ui/Icons';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../utils/cn';
import { PremiumCard } from '../../ui/PremiumCard';
import { Button } from '../../ui/button';
import { ConfirmModal } from '../../ui/ConfirmModal';
import type { AttackPath, EcosystemParty, EssentialAsset } from '../../../types/ebios';
import { LIKELIHOOD_SCALE } from '../../../data/ebiosLibrary';

// Form validation schema
const attackPathSchema = z.object({
  name: z.string().min(2, 'Name required (min 2 characters)'),
  description: z.string().optional(),
  sourcePartyId: z.string().min(1, 'Source is required'),
  targetAssetId: z.string().min(1, 'Target is required'),
  intermediatePartyIds: z.array(z.string()),
  likelihood: z.number().min(1).max(4),
  complexity: z.number().min(1).max(4),
});

type AttackPathFormData = z.infer<typeof attackPathSchema>;

interface AttackPathFormProps {
  path?: AttackPath | null;
  parties: EcosystemParty[];
  assets: EssentialAsset[];
  onSave: (path: AttackPath) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const COMPLEXITY_LABELS: Record<number, { fr: string; en: string; color: string }> = {
  1: { fr: 'Très complexe', en: 'Very complex', color: 'green' },
  2: { fr: 'Complexe', en: 'Complex', color: 'yellow' },
  3: { fr: 'Modérée', en: 'Moderate', color: 'orange' },
  4: { fr: 'Simple', en: 'Simple', color: 'red' },
};

export const AttackPathForm: React.FC<AttackPathFormProps> = ({
  path,
  parties,
  assets,
  onSave,
  onDelete,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const isEditing = !!path?.name;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<AttackPathFormData>({
    resolver: zodResolver(attackPathSchema),
    defaultValues: {
      name: path?.name || '',
      description: path?.description || '',
      sourcePartyId: path?.sourcePartyId || '',
      targetAssetId: path?.targetAssetId || '',
      intermediatePartyIds: path?.intermediatePartyIds || [],
      likelihood: path?.likelihood || 2,
      complexity: path?.complexity || 2,
    },
  });

  const watchedSourceId = useWatch({ control, name: 'sourcePartyId' });
  const watchedIntermediates = useWatch({ control, name: 'intermediatePartyIds' });
  const watchedLikelihood = useWatch({ control, name: 'likelihood' });
  const watchedComplexity = useWatch({ control, name: 'complexity' });
  const watchedTargetAssetId = useWatch({ control, name: 'targetAssetId' });

  // Get available parties for intermediates (exclude source)
  const availableIntermediates = useMemo(() => {
    return parties.filter(p => p.id !== watchedSourceId);
  }, [parties, watchedSourceId]);

  useEffect(() => {
    if (path) {
      reset({
        name: path.name,
        description: path.description || '',
        sourcePartyId: path.sourcePartyId,
        targetAssetId: path.targetAssetId,
        intermediatePartyIds: path.intermediatePartyIds,
        likelihood: path.likelihood,
        complexity: path.complexity,
      });
    }
  }, [path, reset]);

  const onSubmit = (data: AttackPathFormData) => {
    const attackPath: AttackPath = {
      id: path?.id || uuidv4(),
      name: data.name,
      description: data.description,
      sourcePartyId: data.sourcePartyId,
      targetAssetId: data.targetAssetId,
      intermediatePartyIds: data.intermediatePartyIds,
      likelihood: data.likelihood as 1 | 2 | 3 | 4,
      complexity: data.complexity as 1 | 2 | 3 | 4,
    };

    onSave(attackPath);
  };

  const handleDelete = () => {
    if (path && onDelete) {
      onDelete(path.id);
      setShowDeleteConfirm(false);
    }
  };

  const toggleIntermediate = (partyId: string) => {
    const current = watchedIntermediates || [];
    if (current.includes(partyId)) {
      setValue('intermediatePartyIds', current.filter(id => id !== partyId));
    } else {
      setValue('intermediatePartyIds', [...current, partyId]);
    }
  };

  const getPartyName = (id: string) => parties.find(p => p.id === id)?.name || '?';
  const getAssetName = (id: string) => assets.find(a => a.id === id)?.name || '?';

  const likelihoodScale = LIKELIHOOD_SCALE.find(l => l.level === watchedLikelihood);
  const complexityLabel = COMPLEXITY_LABELS[watchedComplexity];

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)]">
      <PremiumCard glass className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-3xl bg-orange-100 dark:bg-amber-900/30">
              <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEditing
                  ? t('ebios.workshop3.editPath', 'Modifier le chemin d\'attaque')
                  : t('ebios.workshop3.addAttackPath', 'Créer un chemin d\'attaque')}
              </h3>
              <p className="text-sm text-slate-600">
                {t('ebios.workshop3.pathFormHelp', 'Définir le parcours depuis la source vers la cible')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-3xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop3.pathName', 'Nom du chemin')} *
            </label>
            <input
              {...register('name')}
              type="text"
              placeholder={t('ebios.workshop3.pathNamePlaceholder', 'Ex: Compromission via fournisseur cloud')}
              className={cn(
                "w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800",
                errors.name
                  ? "border-red-500"
                  : "border-border/40 dark:border-slate-700"
              )}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Source & Target */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('ebios.workshop3.sourceParty', 'Partie source')} *
              </label>
              <select
                {...register('sourcePartyId')}
                className={cn(
                  "w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800",
                  errors.sourcePartyId
                    ? "border-red-500"
                    : "border-border/40 dark:border-slate-700"
                )}
              >
                <option value="">{t('ebios.workshop3.selectSource', 'Sélectionner...')}</option>
                {parties.map((party) => (
                  <option key={party.id || 'unknown'} value={party.id}>
                    {party.name}
                  </option>
                ))}
              </select>
              {errors.sourcePartyId && (
                <p className="mt-1 text-sm text-red-500">{errors.sourcePartyId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('ebios.workshop3.targetAsset', 'Actif cible')} *
              </label>
              <select
                {...register('targetAssetId')}
                className={cn(
                  "w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800",
                  errors.targetAssetId
                    ? "border-red-500"
                    : "border-border/40 dark:border-slate-700"
                )}
              >
                <option value="">{t('ebios.workshop3.selectTarget', 'Sélectionner...')}</option>
                {assets.map((asset) => (
                  <option key={asset.id || 'unknown'} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
              {errors.targetAssetId && (
                <p className="mt-1 text-sm text-red-500">{errors.targetAssetId.message}</p>
              )}
            </div>
          </div>

          {/* Path Preview */}
          {watchedSourceId && watchedTargetAssetId && (
            <div className="p-3 rounded-3xl bg-slate-50 dark:bg-slate-800/50">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{t('ebios.workshop3.pathPreview', 'Aperçu du chemin')}:</p>
              <div className="flex items-center flex-wrap gap-2">
                <span className="px-2 py-1 rounded bg-orange-100 dark:bg-amber-900/30 text-orange-700 dark:text-orange-400 text-sm font-medium">
                  {getPartyName(watchedSourceId)}
                </span>
                {watchedIntermediates?.map((id) => (
                  <React.Fragment key={id || 'unknown'}>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm">
                      {getPartyName(id)}
                    </span>
                  </React.Fragment>
                ))}
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm font-medium">
                  {getAssetName(watchedTargetAssetId)}
                </span>
              </div>
            </div>
          )}

          {/* Intermediate Parties */}
          {availableIntermediates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('ebios.workshop3.intermediateParties', 'Parties intermédiaires')}
              </label>
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                {t('ebios.workshop3.intermediateHelp', 'Sélectionnez les parties traversées par l\'attaque')}
              </p>
              <div className="flex flex-wrap gap-2">
                {availableIntermediates.map((party) => {
                  const isSelected = watchedIntermediates?.includes(party.id);
                  return (
                    <button
                      key={party.id || 'unknown'}
                      type="button"
                      onClick={() => toggleIntermediate(party.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-sm transition-all",
                        isSelected
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                          : "border-border/40 dark:border-slate-700 hover:border-border/40"
                      )}
                    >
                      {party.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop3.pathDescription', 'Description')}
            </label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder={t('ebios.workshop3.pathDescriptionPlaceholder', 'Décrivez ce chemin d\'attaque...')}
              className="w-full px-4 py-2.5 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"
            />
          </div>

          {/* Likelihood & Complexity */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-muted-foreground">
                  {t('ebios.workshop3.likelihood', 'Vraisemblance')}
                </label>
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  `bg-${likelihoodScale?.color || 'gray'}-100 dark:bg-${likelihoodScale?.color || 'gray'}-900/30`,
                  `text-${likelihoodScale?.color || 'gray'}-700 dark:text-${likelihoodScale?.color || 'gray'}-400`
                )}>
                  {likelihoodScale?.[locale] || watchedLikelihood}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={watchedLikelihood}
                onChange={(e) => setValue('likelihood', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{t('ebios.workshop3.unlikely', 'Peu probable')}</span>
                <span>{t('ebios.workshop3.veryLikely', 'Très probable')}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-muted-foreground">
                  {t('ebios.workshop3.complexity', 'Complexité')}
                </label>
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  `bg-${complexityLabel?.color || 'gray'}-100 dark:bg-${complexityLabel?.color || 'gray'}-900/30`,
                  `text-${complexityLabel?.color || 'gray'}-700 dark:text-${complexityLabel?.color || 'gray'}-400`
                )}>
                  {complexityLabel?.[locale] || watchedComplexity}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={4}
                step={1}
                value={watchedComplexity}
                onChange={(e) => setValue('complexity', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{t('ebios.workshop3.veryComplex', 'Très complexe')}</span>
                <span>{t('ebios.workshop3.simple', 'Simple')}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border/40 dark:border-slate-700/50">
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
          title={t('ebios.workshop3.deletePathTitle', 'Supprimer le chemin d\'attaque')}
          message={t('ebios.workshop3.confirmDeletePath', 'Êtes-vous sûr de vouloir supprimer ce chemin d\'attaque ?')}
          type="danger"
          confirmText={t('common.delete', 'Supprimer')}
          cancelText={t('common.cancel', 'Annuler')}
        />
      </PremiumCard>
    </div>
  );
};

export default AttackPathForm;
