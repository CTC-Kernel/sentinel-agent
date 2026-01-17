/**
 * Sector Recommendations Component
 * Story 16.6: Suggestions de Sources par Secteur
 *
 * Displays risk source and objective recommendations based on organization sector
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Lightbulb, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
import { Button } from '../../ui/button';
import {
  SECTOR_PROFILES,
  ANSSI_RISK_SOURCES,
  ANSSI_TARGETED_OBJECTIVES,
  getRecommendedSourcesForSector,
  getRecommendedObjectivesForSector,
} from '../../../data/ebiosLibrary';

interface SectorRecommendationsProps {
  sectorId?: string;
  selectedSourceCodes: string[];
  selectedObjectiveCodes: string[];
  dismissedSourceCodes?: string[];
  dismissedObjectiveCodes?: string[];
  onSelectSource: (code: string) => void;
  onSelectObjective: (code: string) => void;
  onDismissSource?: (code: string) => void;
  onDismissObjective?: (code: string) => void;
  onSelectAllSources?: () => void;
  onSelectAllObjectives?: () => void;
  readOnly?: boolean;
}

export const SectorRecommendations: React.FC<SectorRecommendationsProps> = ({
  sectorId,
  selectedSourceCodes,
  selectedObjectiveCodes,
  dismissedSourceCodes = [],
  dismissedObjectiveCodes = [],
  onSelectSource,
  onSelectObjective,
  onDismissSource,
  onDismissObjective,
  onSelectAllSources,
  onSelectAllObjectives,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const [isExpanded, setIsExpanded] = useState(true);

  const sectorProfile = sectorId ? SECTOR_PROFILES[sectorId] : null;

  // Get recommendations not yet selected or dismissed
  const pendingSourceRecommendations = useMemo(() => {
    if (!sectorProfile) return [];
    const recommended = getRecommendedSourcesForSector(sectorId!);
    return recommended.filter(
      (source) =>
        !selectedSourceCodes.includes(source.code) &&
        !dismissedSourceCodes.includes(source.code)
    );
  }, [sectorId, sectorProfile, selectedSourceCodes, dismissedSourceCodes]);

  const pendingObjectiveRecommendations = useMemo(() => {
    if (!sectorProfile) return [];
    const recommended = getRecommendedObjectivesForSector(sectorId!);
    return recommended.filter(
      (obj) =>
        !selectedObjectiveCodes.includes(obj.code) &&
        !dismissedObjectiveCodes.includes(obj.code)
    );
  }, [sectorId, sectorProfile, selectedObjectiveCodes, dismissedObjectiveCodes]);

  // If no sector or no pending recommendations, don't show anything
  if (!sectorProfile || (pendingSourceRecommendations.length === 0 && pendingObjectiveRecommendations.length === 0)) {
    return null;
  }

  const handleSelectAllSources = () => {
    pendingSourceRecommendations.forEach((source) => onSelectSource(source.code));
    onSelectAllSources?.();
  };

  const handleSelectAllObjectives = () => {
    pendingObjectiveRecommendations.forEach((obj) => onSelectObjective(obj.code));
    onSelectAllObjectives?.();
  };

  return (
    <GlassCard className="mb-6 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {t('ebios.workshop2.sectorRecommendations', 'Recommandations pour votre secteur')}
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                {sectorProfile.name[locale]}
              </span>
            </h3>
            <p className="text-sm text-gray-500">
              {pendingSourceRecommendations.length + pendingObjectiveRecommendations.length}{' '}
              {t('ebios.workshop2.pendingRecommendations', 'recommandations en attente')}
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
        <div className="mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-700/50 space-y-4">
          {/* Risk Source Recommendations */}
          {pendingSourceRecommendations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  {t('ebios.workshop2.recommendedSources', 'Sources de risque recommandées')}
                  <span className="text-gray-400">({pendingSourceRecommendations.length})</span>
                </h4>
                {!readOnly && pendingSourceRecommendations.length > 1 && (
                  <button
                    onClick={handleSelectAllSources}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {t('ebios.workshop2.addAll', 'Ajouter toutes')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingSourceRecommendations.map((source) => (
                  <div
                    key={source.code}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
                  >
                    <span className="font-medium text-red-600 dark:text-red-400">{source.code}</span>
                    <span className="text-gray-500 dark:text-gray-400">-</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{source.name}</span>
                    {!readOnly && (
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => onSelectSource(source.code)}
                          className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
                          title={t('ebios.workshop2.addRecommendation', 'Ajouter')}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        {onDismissSource && (
                          <button
                            onClick={() => onDismissSource(source.code)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                            title={t('ebios.workshop2.dismissRecommendation', 'Ignorer')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Targeted Objective Recommendations */}
          {pendingObjectiveRecommendations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  {t('ebios.workshop2.recommendedObjectives', 'Objectifs visés recommandés')}
                  <span className="text-gray-400">({pendingObjectiveRecommendations.length})</span>
                </h4>
                {!readOnly && pendingObjectiveRecommendations.length > 1 && (
                  <button
                    onClick={handleSelectAllObjectives}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {t('ebios.workshop2.addAll', 'Ajouter toutes')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {pendingObjectiveRecommendations.map((obj) => (
                  <div
                    key={obj.code}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
                  >
                    <span className="font-medium text-amber-600 dark:text-amber-400">{obj.code}</span>
                    <span className="text-gray-500 dark:text-gray-400">-</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{obj.name}</span>
                    {!readOnly && (
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => onSelectObjective(obj.code)}
                          className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400"
                          title={t('ebios.workshop2.addRecommendation', 'Ajouter')}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        {onDismissObjective && (
                          <button
                            onClick={() => onDismissObjective(obj.code)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                            title={t('ebios.workshop2.dismissRecommendation', 'Ignorer')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info note */}
          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 pt-2">
            <Building2 className="w-3.5 h-3.5" />
            {t('ebios.workshop2.sectorBasedOnProfile', 'Basé sur le profil ANSSI pour le secteur')}{' '}
            <strong>{sectorProfile.name[locale]}</strong>
          </p>
        </div>
      )}
    </GlassCard>
  );
};

export default SectorRecommendations;
