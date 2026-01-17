/**
 * Workshop 2: Sources de Risque
 * Main content component for EBIOS RM Workshop 2
 *
 * Sections:
 * 1. Risk Source Selection (Sources de Risque)
 * 2. Targeted Objectives Selection (Objectifs Visés)
 * 3. SR/OV Pairs Evaluation
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Flag,
  Crosshair,
  Plus,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  UserPlus,
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
import type {
  Workshop2Data,
  RiskSource,
  TargetedObjective,
  SROVPair,
} from '../../../types/ebios';
import {
  ANSSI_RISK_SOURCES,
  ANSSI_TARGETED_OBJECTIVES,
  RISK_SOURCE_CATEGORY_LABELS,
  IMPACT_TYPE_LABELS,
  GRAVITY_SCALE,
} from '../../../data/ebiosLibrary';
import { CustomRiskSourceForm } from '../workshop2/CustomRiskSourceForm';
import { CustomTargetedObjectiveForm } from '../workshop2/CustomTargetedObjectiveForm';
import { SectorRecommendations } from '../workshop2/SectorRecommendations';
import { v4 as uuidv4 } from 'uuid';

interface Workshop2ContentProps {
  data: Workshop2Data;
  onDataChange: (data: Partial<Workshop2Data>) => void;
  riskSources?: RiskSource[];
  targetedObjectives?: TargetedObjective[];
  onCustomRiskSourceSave?: (source: RiskSource) => void;
  onCustomRiskSourceDelete?: (id: string) => void;
  onCustomObjectiveSave?: (objective: TargetedObjective) => void;
  onCustomObjectiveDelete?: (id: string) => void;
  sectorId?: string; // Organization sector for recommendations
  readOnly?: boolean;
}

type SectionKey = 'riskSources' | 'targetedObjectives' | 'srOvPairs';

export const Workshop2Content: React.FC<Workshop2ContentProps> = ({
  data,
  onDataChange,
  riskSources = [],
  targetedObjectives = [],
  onCustomRiskSourceSave,
  onCustomRiskSourceDelete,
  onCustomObjectiveSave,
  onCustomObjectiveDelete,
  sectorId,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['riskSources', 'targetedObjectives', 'srOvPairs'])
  );

  // Custom form states
  const [showRiskSourceForm, setShowRiskSourceForm] = useState(false);
  const [editingRiskSource, setEditingRiskSource] = useState<RiskSource | null>(null);
  const [showObjectiveForm, setShowObjectiveForm] = useState(false);
  const [editingObjective, setEditingObjective] = useState<TargetedObjective | null>(null);

  // Combine ANSSI library with custom sources
  const allRiskSources = useMemo(() => {
    const anssiSources = ANSSI_RISK_SOURCES.map((src, idx) => ({
      ...src,
      id: `anssi-rs-${idx}`,
      createdAt: new Date().toISOString(),
      organizationId: null,
    }));
    return [...anssiSources, ...riskSources];
  }, [riskSources]);

  const allTargetedObjectives = useMemo(() => {
    const anssiObjectives = ANSSI_TARGETED_OBJECTIVES.map((obj, idx) => ({
      ...obj,
      id: `anssi-to-${idx}`,
      createdAt: new Date().toISOString(),
      organizationId: null,
    }));
    return [...anssiObjectives, ...targetedObjectives];
  }, [targetedObjectives]);

  // Group risk sources by category
  const riskSourcesByCategory = useMemo(() => {
    const groups: Record<string, typeof allRiskSources> = {};
    allRiskSources.forEach((src) => {
      if (!groups[src.category]) {
        groups[src.category] = [];
      }
      groups[src.category].push(src);
    });
    return groups;
  }, [allRiskSources]);

  // Group targeted objectives by impact type
  const objectivesByImpact = useMemo(() => {
    const groups: Record<string, typeof allTargetedObjectives> = {};
    allTargetedObjectives.forEach((obj) => {
      if (!groups[obj.impactType]) {
        groups[obj.impactType] = [];
      }
      groups[obj.impactType].push(obj);
    });
    return groups;
  }, [allTargetedObjectives]);

  const toggleSection = (section: SectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Risk Source handlers
  const isRiskSourceSelected = (riskSourceId: string) =>
    data.selectedRiskSources.some((s) => s.riskSourceId === riskSourceId);

  const toggleRiskSource = (riskSourceId: string) => {
    if (readOnly) return;

    if (isRiskSourceSelected(riskSourceId)) {
      // Remove selection and related pairs
      const selectedRiskSources = data.selectedRiskSources.filter(
        (s) => s.riskSourceId !== riskSourceId
      );
      const srOvPairs = data.srOvPairs.filter((p) => p.riskSourceId !== riskSourceId);
      onDataChange({ selectedRiskSources, srOvPairs });
    } else {
      // Add selection
      const selectedRiskSources = [
        ...data.selectedRiskSources,
        {
          id: uuidv4(),
          riskSourceId,
          relevanceJustification: '',
        },
      ];
      onDataChange({ selectedRiskSources });
    }
  };

  // Targeted Objective handlers
  const isTargetedObjectiveSelected = (objectiveId: string) =>
    data.selectedTargetedObjectives.some((s) => s.targetedObjectiveId === objectiveId);

  const toggleTargetedObjective = (objectiveId: string) => {
    if (readOnly) return;

    if (isTargetedObjectiveSelected(objectiveId)) {
      // Remove selection and related pairs
      const selectedTargetedObjectives = data.selectedTargetedObjectives.filter(
        (s) => s.targetedObjectiveId !== objectiveId
      );
      const srOvPairs = data.srOvPairs.filter((p) => p.targetedObjectiveId !== objectiveId);
      onDataChange({ selectedTargetedObjectives, srOvPairs });
    } else {
      // Add selection
      const selectedTargetedObjectives = [
        ...data.selectedTargetedObjectives,
        {
          id: uuidv4(),
          targetedObjectiveId: objectiveId,
          relevanceJustification: '',
        },
      ];
      onDataChange({ selectedTargetedObjectives });
    }
  };

  // Generate all possible SR/OV pairs
  const generatePairs = useCallback(() => {
    if (readOnly) return;

    const existingPairKeys = new Set(
      data.srOvPairs.map((p) => `${p.riskSourceId}-${p.targetedObjectiveId}`)
    );

    const newPairs: SROVPair[] = [];
    data.selectedRiskSources.forEach((sr) => {
      data.selectedTargetedObjectives.forEach((to) => {
        const key = `${sr.riskSourceId}-${to.targetedObjectiveId}`;
        if (!existingPairKeys.has(key)) {
          newPairs.push({
            id: uuidv4(),
            riskSourceId: sr.riskSourceId,
            targetedObjectiveId: to.targetedObjectiveId,
            relevance: 2,
            justification: '',
            retainedForAnalysis: false,
          });
        }
      });
    });

    if (newPairs.length > 0) {
      onDataChange({ srOvPairs: [...data.srOvPairs, ...newPairs] });
    }
  }, [data.selectedRiskSources, data.selectedTargetedObjectives, data.srOvPairs, onDataChange, readOnly]);

  // Update pair
  const updatePair = useCallback(
    (pairId: string, updates: Partial<SROVPair>) => {
      if (readOnly) return;
      const srOvPairs = data.srOvPairs.map((p) =>
        p.id === pairId ? { ...p, ...updates } : p
      );
      onDataChange({ srOvPairs });
    },
    [data.srOvPairs, onDataChange, readOnly]
  );

  // Get source/objective by ID
  const getRiskSourceById = (id: string) => allRiskSources.find((s) => s.id === id);
  const getObjectiveById = (id: string) => allTargetedObjectives.find((o) => o.id === id);

  // Stats
  const selectedSourcesCount = data.selectedRiskSources.length;
  const selectedObjectivesCount = data.selectedTargetedObjectives.length;
  const pairsCount = data.srOvPairs.length;
  const retainedPairsCount = data.srOvPairs.filter((p) => p.retainedForAnalysis).length;

  // Get selected codes for recommendations
  const selectedSourceCodes = useMemo(() => {
    return data.selectedRiskSources
      .map((s) => {
        const source = allRiskSources.find((rs) => rs.id === s.riskSourceId);
        return source?.code;
      })
      .filter(Boolean) as string[];
  }, [data.selectedRiskSources, allRiskSources]);

  const selectedObjectiveCodes = useMemo(() => {
    return data.selectedTargetedObjectives
      .map((s) => {
        const objective = allTargetedObjectives.find((o) => o.id === s.targetedObjectiveId);
        return objective?.code;
      })
      .filter(Boolean) as string[];
  }, [data.selectedTargetedObjectives, allTargetedObjectives]);

  // Handler for selecting a source from recommendations (by code)
  const handleSelectSourceByCode = useCallback((code: string) => {
    const source = allRiskSources.find((s) => s.code === code);
    if (source && !isRiskSourceSelected(source.id)) {
      toggleRiskSource(source.id);
    }
  }, [allRiskSources, isRiskSourceSelected, toggleRiskSource]);

  // Handler for selecting an objective from recommendations (by code)
  const handleSelectObjectiveByCode = useCallback((code: string) => {
    const objective = allTargetedObjectives.find((o) => o.code === code);
    if (objective && !isTargetedObjectiveSelected(objective.id)) {
      toggleTargetedObjective(objective.id);
    }
  }, [allTargetedObjectives, isTargetedObjectiveSelected, toggleTargetedObjective]);

  return (
    <div className="space-y-6">
      {/* Sector Recommendations */}
      {sectorId && !readOnly && (
        <SectorRecommendations
          sectorId={sectorId}
          selectedSourceCodes={selectedSourceCodes}
          selectedObjectiveCodes={selectedObjectiveCodes}
          onSelectSource={handleSelectSourceByCode}
          onSelectObjective={handleSelectObjectiveByCode}
          readOnly={readOnly}
        />
      )}

      {/* Risk Sources Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('riskSources')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
              <Users className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop2.riskSources')}
              </h3>
              <p className="text-sm text-gray-500">
                {selectedSourcesCount} {t('ebios.workshop2.selectedSources')}
              </p>
            </div>
          </div>
          {expandedSections.has('riskSources') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('riskSources') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-gray-500 mb-4">
              {t('ebios.workshop2.riskSourcesHelp')}
            </p>

            <div className="space-y-4">
              {Object.entries(riskSourcesByCategory).map(([category, sources]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      category.includes('state') ? "bg-purple-500" :
                      category.includes('crime') ? "bg-red-500" :
                      category.includes('terrorist') ? "bg-orange-500" :
                      category.includes('activist') ? "bg-yellow-500" :
                      category.includes('competitor') ? "bg-blue-500" :
                      category.includes('insider') ? "bg-pink-500" :
                      "bg-gray-500"
                    )} />
                    {RISK_SOURCE_CATEGORY_LABELS[category as keyof typeof RISK_SOURCE_CATEGORY_LABELS]?.[locale] || category}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {sources.map((source) => (
                      <button
                        key={source.id}
                        onClick={() => toggleRiskSource(source.id)}
                        disabled={readOnly}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all",
                          isRiskSourceSelected(source.id)
                            ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
                          readOnly && "cursor-default"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                            isRiskSourceSelected(source.id)
                              ? "border-red-500 bg-red-500"
                              : "border-gray-300 dark:border-gray-600"
                          )}>
                            {isRiskSourceSelected(source.id) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white">
                              {source.code} - {source.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {source.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Add Custom Source Button */}
              {!readOnly && onCustomRiskSourceSave && (
                <button
                  onClick={() => {
                    setEditingRiskSource(null);
                    setShowRiskSourceForm(true);
                  }}
                  className="w-full mt-4 p-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-red-500"
                >
                  <UserPlus className="w-4 h-4" />
                  {t('ebios.workshop2.addCustomSource', 'Ajouter une source personnalisée')}
                </button>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Targeted Objectives Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('targetedObjectives')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Flag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop2.targetedObjectives')}
              </h3>
              <p className="text-sm text-gray-500">
                {selectedObjectivesCount} {t('ebios.workshop2.selectedObjectives')}
              </p>
            </div>
          </div>
          {expandedSections.has('targetedObjectives') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('targetedObjectives') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <p className="text-sm text-gray-500 mb-4">
              {t('ebios.workshop2.targetedObjectivesHelp')}
            </p>

            <div className="space-y-4">
              {Object.entries(objectivesByImpact).map(([impactType, objectives]) => {
                const impactInfo = IMPACT_TYPE_LABELS[impactType as keyof typeof IMPACT_TYPE_LABELS];
                return (
                  <div key={impactType} className="space-y-2">
                    <h4 className={cn(
                      "text-sm font-medium flex items-center gap-2",
                      `text-${impactInfo?.color || 'gray'}-600 dark:text-${impactInfo?.color || 'gray'}-400`
                    )}>
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        `bg-${impactInfo?.color || 'gray'}-500`
                      )} />
                      {impactInfo?.[locale] || impactType}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {objectives.map((objective) => (
                        <button
                          key={objective.id}
                          onClick={() => toggleTargetedObjective(objective.id)}
                          disabled={readOnly}
                          className={cn(
                            "p-3 rounded-xl border text-left transition-all",
                            isTargetedObjectiveSelected(objective.id)
                              ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
                            readOnly && "cursor-default"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                              isTargetedObjectiveSelected(objective.id)
                                ? "border-amber-500 bg-amber-500"
                                : "border-gray-300 dark:border-gray-600"
                            )}>
                              {isTargetedObjectiveSelected(objective.id) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-gray-900 dark:text-white">
                                {objective.code} - {objective.name}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {objective.description}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Add Custom Objective Button */}
              {!readOnly && onCustomObjectiveSave && (
                <button
                  onClick={() => {
                    setEditingObjective(null);
                    setShowObjectiveForm(true);
                  }}
                  className="w-full mt-4 p-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-amber-500"
                >
                  <Plus className="w-4 h-4" />
                  {t('ebios.workshop2.addCustomObjective', 'Ajouter un objectif personnalisé')}
                </button>
              )}
            </div>
          </div>
        )}
      </GlassCard>

      {/* SR/OV Pairs Section */}
      <GlassCard>
        <button
          onClick={() => toggleSection('srOvPairs')}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Crosshair className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('ebios.workshop2.srOvPairs')}
              </h3>
              <p className="text-sm text-gray-500">
                {retainedPairsCount}/{pairsCount} {t('ebios.workshop2.retainedPairs')}
              </p>
            </div>
          </div>
          {expandedSections.has('srOvPairs') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSections.has('srOvPairs') && (
          <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            {selectedSourcesCount === 0 || selectedObjectivesCount === 0 ? (
              <div className="text-center py-8">
                <Info className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500">
                  {t('ebios.workshop2.selectSourcesAndObjectivesFirst')}
                </p>
              </div>
            ) : (
              <>
                {!readOnly && (
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={generatePairs}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {t('ebios.workshop2.generatePairs')}
                    </button>
                  </div>
                )}

                {data.srOvPairs.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      {t('ebios.workshop2.noPairsYet')}
                    </p>
                    {!readOnly && (
                      <p className="text-sm text-gray-400 mt-1">
                        {t('ebios.workshop2.clickGeneratePairs')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.srOvPairs.map((pair) => {
                      const source = getRiskSourceById(pair.riskSourceId);
                      const objective = getObjectiveById(pair.targetedObjectiveId);
                      const relevanceScale = GRAVITY_SCALE.find((s) => s.level === pair.relevance);

                      return (
                        <div
                          key={pair.id}
                          className={cn(
                            "p-4 rounded-xl border transition-all",
                            pair.retainedForAnalysis
                              ? "border-green-500 bg-green-50/50 dark:bg-green-900/10"
                              : "border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50"
                          )}
                        >
                          <div className="flex flex-col md:flex-row md:items-center gap-4">
                            {/* Source -> Objective */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-red-600 dark:text-red-400 truncate">
                                  {source?.code || '?'}
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium text-amber-600 dark:text-amber-400 truncate">
                                  {objective?.code || '?'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                {source?.name} → {objective?.name}
                              </p>
                            </div>

                            {/* Relevance */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{t('ebios.workshop2.relevance')}:</span>
                              {!readOnly ? (
                                <div className="flex items-center gap-1">
                                  {GRAVITY_SCALE.map((level) => (
                                    <button
                                      key={level.level}
                                      onClick={() => updatePair(pair.id, { relevance: level.level as 1 | 2 | 3 | 4 })}
                                      className={cn(
                                        "w-7 h-7 rounded-lg text-xs font-bold transition-colors",
                                        pair.relevance === level.level
                                          ? `bg-${level.color}-500 text-white`
                                          : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                      )}
                                    >
                                      {level.level}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className={cn(
                                  "px-2 py-1 rounded text-xs font-medium",
                                  `bg-${relevanceScale?.color || 'gray'}-100 dark:bg-${relevanceScale?.color || 'gray'}-900/30`,
                                  `text-${relevanceScale?.color || 'gray'}-600 dark:text-${relevanceScale?.color || 'gray'}-400`
                                )}>
                                  {pair.relevance}
                                </span>
                              )}
                            </div>

                            {/* Retain Toggle */}
                            <button
                              onClick={() => !readOnly && updatePair(pair.id, { retainedForAnalysis: !pair.retainedForAnalysis })}
                              disabled={readOnly}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors",
                                pair.retainedForAnalysis
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700",
                                readOnly && "cursor-default"
                              )}
                            >
                              {pair.retainedForAnalysis ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  {t('ebios.workshop2.retained')}
                                </>
                              ) : (
                                <>
                                  <X className="w-4 h-4" />
                                  {t('ebios.workshop2.notRetained')}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </GlassCard>

      {/* Custom Risk Source Form Modal */}
      {showRiskSourceForm && onCustomRiskSourceSave && (
        <CustomRiskSourceForm
          source={editingRiskSource}
          onSave={(source) => {
            onCustomRiskSourceSave(source);
            setShowRiskSourceForm(false);
            setEditingRiskSource(null);
          }}
          onDelete={editingRiskSource && onCustomRiskSourceDelete ? (id) => {
            onCustomRiskSourceDelete(id);
            setShowRiskSourceForm(false);
            setEditingRiskSource(null);
          } : undefined}
          onClose={() => {
            setShowRiskSourceForm(false);
            setEditingRiskSource(null);
          }}
          existingCodes={allRiskSources.map((s) => s.code)}
        />
      )}

      {/* Custom Targeted Objective Form Modal */}
      {showObjectiveForm && onCustomObjectiveSave && (
        <CustomTargetedObjectiveForm
          objective={editingObjective}
          onSave={(objective) => {
            onCustomObjectiveSave(objective);
            setShowObjectiveForm(false);
            setEditingObjective(null);
          }}
          onDelete={editingObjective && onCustomObjectiveDelete ? (id) => {
            onCustomObjectiveDelete(id);
            setShowObjectiveForm(false);
            setEditingObjective(null);
          } : undefined}
          onClose={() => {
            setShowObjectiveForm(false);
            setEditingObjective(null);
          }}
          existingCodes={allTargetedObjectives.map((o) => o.code)}
        />
      )}
    </div>
  );
};

export default Workshop2Content;
