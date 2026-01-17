/**
 * Scenario Suggestions Component
 * Story 17.6: Suggestions de Scénarios par Secteur
 *
 * Displays strategic scenario suggestions based on organization sector
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb, ChevronDown, ChevronUp, Sparkles, Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
import {
  SECTOR_PROFILES,
  getScenarioTemplatesForSector,
  scoreScenarioTemplate,
  type ScenarioTemplate,
} from '../../../data/ebiosLibrary';
import { GRAVITY_SCALE } from '../../../data/ebiosLibrary';

interface ScenarioSuggestionsProps {
  sectorId?: string;
  usedTemplateIds?: string[];
  dismissedTemplateIds?: string[];
  onUseTemplate: (template: ScenarioTemplate) => void;
  onDismissTemplate?: (templateId: string) => void;
  readOnly?: boolean;
}

export const ScenarioSuggestions: React.FC<ScenarioSuggestionsProps> = ({
  sectorId,
  usedTemplateIds = [],
  dismissedTemplateIds = [],
  onUseTemplate,
  onDismissTemplate,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const [isExpanded, setIsExpanded] = useState(true);

  const sectorProfile = sectorId ? SECTOR_PROFILES[sectorId] : null;

  // Get and filter templates
  const availableTemplates = useMemo(() => {
    if (!sectorId) return [];
    const templates = getScenarioTemplatesForSector(sectorId);
    return templates
      .filter(
        (template) =>
          !usedTemplateIds.includes(template.id) &&
          !dismissedTemplateIds.includes(template.id)
      )
      .map((template) => ({
        ...template,
        score: scoreScenarioTemplate(template, sectorId),
      }))
      .sort((a, b) => b.score - a.score);
  }, [sectorId, usedTemplateIds, dismissedTemplateIds]);

  // If no sector or no templates, don't show
  if (!sectorProfile || availableTemplates.length === 0) {
    return null;
  }

  const getGravityColor = (level: number) => {
    const scale = GRAVITY_SCALE.find((g) => g.level === level);
    return scale?.color || 'gray';
  };

  return (
    <GlassCard className="mb-6 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {t('ebios.workshop3.scenarioSuggestions', 'Suggestions de scénarios')}
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                {sectorProfile.name[locale]}
              </span>
            </h3>
            <p className="text-sm text-gray-500">
              {availableTemplates.length}{' '}
              {t('ebios.workshop3.templatesAvailable', 'modèles disponibles pour votre secteur')}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-amber-700/50 space-y-3">
          {availableTemplates.map((template) => {
            const gravityColor = getGravityColor(template.typicalGravity);
            const relevancePercent = template.score;

            return (
              <div
                key={template.id}
                className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {template.name[locale]}
                      </h4>
                      {relevancePercent >= 50 && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          {relevancePercent}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {template.description[locale]}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                          `bg-${gravityColor}-100 dark:bg-${gravityColor}-900/30`,
                          `text-${gravityColor}-700 dark:text-${gravityColor}-400`
                        )}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        G{template.typicalGravity}
                      </span>
                      <span className="text-xs text-gray-400">
                        {template.typicalImpactTypes
                          .map((type) =>
                            type === 'confidentiality'
                              ? 'C'
                              : type === 'integrity'
                                ? 'I'
                                : 'A'
                          )
                          .join('/')}
                      </span>
                    </div>
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => onUseTemplate(template)}
                        className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 transition-colors"
                        title={t('ebios.workshop3.useTemplate', 'Utiliser ce modèle')}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      {onDismissTemplate && (
                        <button
                          onClick={() => onDismissTemplate(template.id)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                          title={t('ebios.workshop3.dismissTemplate', 'Ignorer')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Info note */}
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 pt-2">
            <Lightbulb className="w-3.5 h-3.5" />
            {t(
              'ebios.workshop3.templatesBasedOnSector',
              'Scénarios typiques basés sur le secteur'
            )}{' '}
            <strong>{sectorProfile.name[locale]}</strong>
          </p>
        </div>
      )}
    </GlassCard>
  );
};

export default ScenarioSuggestions;
