/**
 * Strategic Scenario Form
 * Story 17.3: Construction des Scénarios Stratégiques
 * Story 17.4: Évaluation de la Gravité
 *
 * Modal form for creating and editing strategic scenarios with gravity evaluation
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Map, Save, Trash2, AlertTriangle, Lightbulb } from '../../ui/Icons';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../../../utils/cn';
import { PremiumCard } from '../../ui/PremiumCard';
import { Button } from '../../ui/button';
import { ConfirmModal } from '../../ui/ConfirmModal';
import type {
  StrategicScenario,
  SROVPair,
  AttackPath,
  FearedEvent,
} from '../../../types/ebios';
import { GRAVITY_SCALE } from '../../../data/ebiosLibrary';

// Form validation schema
const strategicScenarioSchema = z.object({
  name: z.string().min(3, 'Name required (min 3 characters)'),
  description: z.string().optional(),
  srOvPairId: z.string().min(1, 'SR/OV pair is required'),
  attackPathIds: z.array(z.string()),
  fearedEventIds: z.array(z.string()).min(1, 'At least one feared event is required'),
  gravity: z.number().min(1).max(4),
  gravityJustification: z.string().optional(),
}).refine(
  (data) => data.gravity < 3 || (data.gravityJustification && data.gravityJustification.length >= 10),
  {
    message: 'Justification required for gravity >= 3 (min 10 characters)',
    path: ['gravityJustification'],
  }
);

type StrategicScenarioFormData = z.infer<typeof strategicScenarioSchema>;

interface StrategicScenarioFormProps {
  scenario?: StrategicScenario | null;
  retainedPairs: SROVPair[];
  attackPaths: AttackPath[];
  fearedEvents: FearedEvent[];
  onSave: (scenario: StrategicScenario) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export const StrategicScenarioForm: React.FC<StrategicScenarioFormProps> = ({
  scenario,
  retainedPairs,
  attackPaths,
  fearedEvents,
  onSave,
  onDelete,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const isEditing = !!scenario?.name;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    control,
  } = useForm<StrategicScenarioFormData>({
    resolver: zodResolver(strategicScenarioSchema),
    defaultValues: {
      name: scenario?.name || '',
      description: scenario?.description || '',
      srOvPairId: scenario?.srOvPairId || '',
      attackPathIds: scenario?.attackPathIds || [],
      fearedEventIds: scenario?.fearedEventIds || [],
      gravity: scenario?.gravity || 2,
      gravityJustification: scenario?.gravityJustification || '',
    },
  });

  const watchedAttackPathIds = useWatch({ control, name: 'attackPathIds' });
  const watchedFearedEventIds = useWatch({ control, name: 'fearedEventIds' });
  const watchedGravity = useWatch({ control, name: 'gravity' });

  // Get suggested gravity from linked feared event
  const suggestedGravity = useMemo(() => {
    if (watchedFearedEventIds.length > 0) {
      const linkedEvent = fearedEvents.find(e => watchedFearedEventIds.includes(e.id));
      return linkedEvent?.gravity;
    }
    return null;
  }, [watchedFearedEventIds, fearedEvents]);

  useEffect(() => {
    if (scenario) {
      reset({
        name: scenario.name,
        description: scenario.description || '',
        srOvPairId: scenario.srOvPairId,
        attackPathIds: scenario.attackPathIds,
        fearedEventIds: scenario.fearedEventIds,
        gravity: scenario.gravity,
        gravityJustification: scenario.gravityJustification || '',
      });
    }
  }, [scenario, reset]);

  const onSubmit = (data: StrategicScenarioFormData) => {
    const strategicScenario: StrategicScenario = {
      id: scenario?.id || uuidv4(),
      name: data.name,
      description: data.description,
      srOvPairId: data.srOvPairId,
      attackPathIds: data.attackPathIds,
      fearedEventIds: data.fearedEventIds,
      gravity: data.gravity as 1 | 2 | 3 | 4,
      gravityJustification: data.gravityJustification,
    };

    onSave(strategicScenario);
  };

  const handleDelete = () => {
    if (scenario && onDelete) {
      onDelete(scenario.id);
      setShowDeleteConfirm(false);
    }
  };

  const toggleAttackPath = (pathId: string) => {
    const current = watchedAttackPathIds || [];
    if (current.includes(pathId)) {
      setValue('attackPathIds', current.filter(id => id !== pathId));
    } else {
      setValue('attackPathIds', [...current, pathId]);
    }
  };

  const toggleFearedEvent = (eventId: string) => {
    const current = watchedFearedEventIds || [];
    if (current.includes(eventId)) {
      setValue('fearedEventIds', current.filter(id => id !== eventId));
    } else {
      setValue('fearedEventIds', [...current, eventId]);
    }
  };

  const inheritGravity = () => {
    if (suggestedGravity) {
      setValue('gravity', suggestedGravity);
      const linkedEvent = fearedEvents.find(e => watchedFearedEventIds.includes(e.id));
      if (linkedEvent) {
        setValue('gravityJustification', `Héritée de l'événement redouté "${linkedEvent.name}"`);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)]">
      <PremiumCard glass className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-3xl bg-red-100 dark:bg-amber-900/30">
              <Map className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isEditing
                  ? t('ebios.workshop3.editScenario', 'Modifier le scénario stratégique')
                  : t('ebios.workshop3.addScenario', 'Créer un scénario stratégique')}
              </h3>
              <p className="text-sm text-slate-600">
                {t('ebios.workshop3.scenarioFormHelp', 'Décrire le scénario d\'attaque de haut niveau')}
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
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop3.scenarioName', 'Nom du scénario')} *
            </label>
            <input
              {...register('name')}
              id="name"
              type="text"
              placeholder={t('ebios.workshop3.scenarioNamePlaceholder', 'Ex: Exfiltration de données via fournisseur')}
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

          {/* SR/OV Pair */}
          <div>
            <label htmlFor="srOvPairId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop3.linkedPair', 'Couple SR/OV')} *
            </label>
            <select
              {...register('srOvPairId')}
              id="srOvPairId"
              className={cn(
                "w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800",
                errors.srOvPairId
                  ? "border-red-500"
                  : "border-border/40 dark:border-slate-700"
              )}
            >
              <option value="">{t('ebios.workshop3.selectPair', 'Sélectionner un couple SR/OV...')}</option>
              {retainedPairs.map((pair) => (
                <option key={pair.id || 'unknown'} value={pair.id}>
                  SR/OV - Pertinence: {pair.relevance}/4 {pair.justification ? `(${pair.justification.slice(0, 30)}...)` : ''}
                </option>
              ))}
            </select>
            {errors.srOvPairId && (
              <p className="mt-1 text-sm text-red-500">{errors.srOvPairId.message}</p>
            )}
          </div>

          {/* Feared Events */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('ebios.workshop3.fearedEvents', 'Événements redoutés')} *
            </label>
            {fearedEvents.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                {t('ebios.workshop3.noFearedEvents', 'Aucun événement redouté défini dans l\'Atelier 1')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {fearedEvents.map((event) => {
                  const isSelected = watchedFearedEventIds?.includes(event.id);
                  return (
                    <button
                      key={event.id || 'unknown'}
                      type="button"
                      onClick={() => toggleFearedEvent(event.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-sm transition-all",
                        isSelected
                          ? "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          : "border-border/40 dark:border-slate-700 hover:border-border/40"
                      )}
                    >
                      {event.name}
                      {event.gravity && (
                        <span className="ml-1 text-xs opacity-70">G{event.gravity}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {errors.fearedEventIds && (
              <p className="mt-1 text-sm text-red-500">{errors.fearedEventIds.message}</p>
            )}
          </div>

          {/* Attack Paths */}
          {attackPaths.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('ebios.workshop3.linkedPaths', 'Chemins d\'attaque associés')}
              </label>
              <div className="flex flex-wrap gap-2">
                {attackPaths.map((path) => {
                  const isSelected = watchedAttackPathIds?.includes(path.id);
                  return (
                    <button
                      key={path.id || 'unknown'}
                      type="button"
                      onClick={() => toggleAttackPath(path.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-sm transition-all",
                        isSelected
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                          : "border-border/40 dark:border-slate-700 hover:border-border/40"
                      )}
                    >
                      {path.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description / Narrative */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('ebios.workshop3.narrative', 'Narrative du scénario')}
            </label>
            <textarea
              {...register('description')}
              id="description"
              rows={3}
              placeholder={t('ebios.workshop3.narrativePlaceholder', 'Décrivez comment l\'attaquant pourrait exploiter ce scénario...')}
              className="w-full px-4 py-2.5 rounded-3xl border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"
            />
          </div>

          {/* Gravity Evaluation - Story 17.4 */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800 dark:border-red-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                {t('ebios.workshop3.gravityEvaluation', 'Évaluation de la gravité')}
              </h4>
              {suggestedGravity && suggestedGravity !== watchedGravity && (
                <button
                  type="button"
                  onClick={inheritGravity}
                  className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-1"
                >
                  <Lightbulb className="w-3 h-3" />
                  {t('ebios.workshop3.inheritGravity', 'Reprendre G{level}').replace('{level}', String(suggestedGravity))}
                </button>
              )}
            </div>

            {/* Gravity Selector */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {GRAVITY_SCALE.map((g) => (
                <button
                  key={g.level || 'unknown'}
                  type="button"
                  onClick={() => setValue('gravity', g.level)}
                  className={cn(
                    "p-3 rounded-3xl border-2 transition-all text-center",
                    watchedGravity === g.level
                      ? `border-${g.color}-500 bg-${g.color}-100 dark:bg-${g.color}-900/30`
                      : "border-border/40 dark:border-slate-700 hover:border-border/40"
                  )}
                >
                  <span className={cn(
                    "text-lg font-bold",
                    watchedGravity === g.level
                      ? `text-${g.color}-600 dark:text-${g.color}-400`
                      : "text-slate-600 dark:text-slate-600"
                  )}>
                    G{g.level}
                  </span>
                  <p className="text-xs mt-1 text-slate-600">
                    {g[locale]}
                  </p>
                </button>
              ))}
            </div>

            {/* Gravity Justification */}
            {watchedGravity >= 3 && (
              <div>
                <label htmlFor="gravityJustification" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('ebios.workshop3.gravityJustification', 'Justification')} *
                </label>
                <textarea
                  {...register('gravityJustification')}
                  id="gravityJustification"
                  rows={2}
                  placeholder={t('ebios.workshop3.gravityJustificationPlaceholder', 'Expliquez pourquoi cette gravité a été attribuée...')}
                  className={cn(
                    "w-full px-4 py-2.5 rounded-3xl border bg-white dark:bg-slate-800 resize-none",
                    errors.gravityJustification
                      ? "border-red-500"
                      : "border-border/40 dark:border-slate-700"
                  )}
                />
                {errors.gravityJustification && (
                  <p className="mt-1 text-sm text-red-500">{errors.gravityJustification.message}</p>
                )}
              </div>
            )}
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
          title={t('ebios.workshop3.deleteScenarioTitle', 'Supprimer le scénario')}
          message={t('ebios.workshop3.confirmDeleteScenario', 'Êtes-vous sûr de vouloir supprimer ce scénario ?')}
          type="danger"
          confirmText={t('common.delete', 'Supprimer')}
          cancelText={t('common.cancel', 'Annuler')}
        />
      </PremiumCard>
    </div>
  );
};

export default StrategicScenarioForm;
