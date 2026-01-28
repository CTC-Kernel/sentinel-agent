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
} from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { PremiumCard } from '../../ui/PremiumCard';
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
  const isRiskSourceSelected = useCallback((riskSourceId: string) =>
    data.selectedRiskSources.some((s) => s.riskSourceId === riskSourceId),
    [data.selectedRiskSources]);

  const toggleRiskSource = useCallback((riskSourceId: string) => {
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
  }, [readOnly, isRiskSourceSelected, data.selectedRiskSources, data.srOvPairs, onDataChange]);

  // Targeted Objective handlers
  const isTargetedObjectiveSelected = useCallback((objectiveId: string) =>
    data.selectedTargetedObjectives.some((s) => s.targetedObjectiveId === objectiveId),
    [data.selectedTargetedObjectives]);

  const toggleTargetedObjective = useCallback((objectiveId: string) => {
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
  }, [readOnly, isTargetedObjectiveSelected, data.selectedTargetedObjectives, data.srOvPairs, onDataChange]);

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
      <div className="animate-fade-in-up delay-100">
        <PremiumCard glass className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-error/5 border-border/40 rounded-3xl">
          <button
            onClick={() => toggleSection('riskSources')}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-error-bg text-error-text group-hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-error-text transition-colors">
                  {t('ebios.workshop2.riskSources')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-300 font-medium">
                  {selectedSourcesCount} {t('ebios.workshop2.selectedSources')}
                </p>
              </div>
            </div>
            {expandedSections.has('riskSources') ? (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:bg-error group-hover:text-white transition-all">
                <ChevronUp className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-all">
                <ChevronDown className="w-5 h-5" />
              </div>
            )}
          </button>

          {expandedSections.has('riskSources') && (
            <div className="mt-6 pt-6 border-t border-border/40 animate-accordion-down">
              <p className="text-sm text-slate-500 dark:text-slate-300 font-medium mb-6 bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-border/40">
                <Info className="w-4 h-4 inline-block mr-2 text-muted-foreground" />
                {t('ebios.workshop2.riskSourcesHelp')}
              </p>

              <div className="space-y-6">
                {Object.entries(riskSourcesByCategory).map(([category, sources]) => (
                  <div key={category} className="space-y-3">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                      <span className={cn(
                        "w-2.5 h-2.5 rounded-full ring-4 ring-opacity-20",
                        category.includes('state') ? "bg-violet-500 ring-violet-500" :
                          category.includes('crime') ? "bg-error ring-error" :
                            category.includes('terrorist') ? "bg-warning ring-warning" :
                              category.includes('activist') ? "bg-amber-500 ring-amber-500" :
                                category.includes('competitor') ? "bg-info ring-info" :
                                  category.includes('insider') ? "bg-violet-400 ring-violet-400" :
                                    "bg-muted/300 ring-slate-500"
                      )} />
                      {RISK_SOURCE_CATEGORY_LABELS[category as keyof typeof RISK_SOURCE_CATEGORY_LABELS]?.[locale] || category}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sources.map((source) => (
                        <button
                          key={source.id}
                          onClick={() => toggleRiskSource(source.id)}
                          disabled={readOnly}
                          className={cn(
                            "group relative p-4 rounded-2xl border text-left transition-all duration-200",
                            isRiskSourceSelected(source.id)
                              ? "border-error bg-error-bg shadow-sm"
                              : "border-border/40 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 hover:border-error/50 hover:shadow-md",
                            readOnly && "cursor-default opacity-80"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                              isRiskSourceSelected(source.id)
                                ? "border-error bg-error shadow-sm"
                                : "border-border/40 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-error/60"
                            )}>
                              {isRiskSourceSelected(source.id) && (
                                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-bold text-sm transition-colors",
                                isRiskSourceSelected(source.id) ? "text-error-text" : "text-slate-900 dark:text-white"
                              )}>
                                {source.code} - {source.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
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
                    className="w-full mt-6 p-4 rounded-3xl border-2 border-dashed border-border/40 hover:border-error/50 hover:bg-error-bg/50 transition-all flex items-center justify-center gap-2 text-slate-500 dark:text-slate-300 hover:text-error-text font-medium group"
                  >
                    <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-error-bg transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                    {t('ebios.workshop2.addCustomSource', 'Ajouter une source personnalisée')}
                  </button>
                )}
              </div>
            </div>
          )}
        </PremiumCard>
      </div>

      {/* Targeted Objectives Section */}
      <div className="animate-fade-in-up delay-200">
        <PremiumCard glass className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-warning/5 hover:border-warning/20">
          <button
            onClick={() => toggleSection('targetedObjectives')}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-warning-bg text-warning-text group-hover:scale-110 transition-transform duration-300">
                <Flag className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-warning-text transition-colors">
                  {t('ebios.workshop2.targetedObjectives')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-300 font-medium">
                  {selectedObjectivesCount} {t('ebios.workshop2.selectedObjectives')}
                </p>
              </div>
            </div>
            {expandedSections.has('targetedObjectives') ? (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:bg-warning group-hover:text-white transition-all">
                <ChevronUp className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-all">
                <ChevronDown className="w-5 h-5" />
              </div>
            )}
          </button>

          {expandedSections.has('targetedObjectives') && (
            <div className="mt-6 pt-6 border-t border-border/40 animate-accordion-down">
              <p className="text-sm text-slate-500 dark:text-slate-300 font-medium mb-6 bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-border/40">
                <Info className="w-4 h-4 inline-block mr-2 text-muted-foreground" />
                {t('ebios.workshop2.targetedObjectivesHelp')}
              </p>

              <div className="space-y-6">
                {Object.entries(objectivesByImpact).map(([impactType, objectives]) => {
                  const impactInfo = IMPACT_TYPE_LABELS[impactType as keyof typeof IMPACT_TYPE_LABELS];
                  return (
                    <div key={impactType} className="space-y-3">
                      <h4 className={cn(
                        "flex items-center gap-2 text-sm font-bold uppercase tracking-wider",
                        `text-${impactInfo?.color || 'gray'}-600 dark:text-${impactInfo?.color || 'gray'}-400`
                      )}>
                        <span className={cn(
                          "w-2.5 h-2.5 rounded-full ring-4 ring-opacity-20",
                          `bg-${impactInfo?.color || 'gray'}-500 ring-${impactInfo?.color || 'gray'}-500`
                        )} />
                        {impactInfo?.[locale] || impactType}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {objectives.map((objective) => (
                          <button
                            key={objective.id}
                            onClick={() => toggleTargetedObjective(objective.id)}
                            disabled={readOnly}
                            className={cn(
                              "group relative p-4 rounded-2xl border text-left transition-all duration-200",
                              isTargetedObjectiveSelected(objective.id)
                                ? "border-warning bg-warning-bg shadow-sm"
                                : "border-border/40 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-white dark:hover:bg-slate-800 hover:border-warning/50 hover:shadow-md",
                              readOnly && "cursor-default opacity-80"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                isTargetedObjectiveSelected(objective.id)
                                  ? "border-warning bg-warning shadow-sm"
                                  : "border-border/40 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-warning/60"
                              )}>
                                {isTargetedObjectiveSelected(objective.id) && (
                                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "font-bold text-sm transition-colors",
                                  isTargetedObjectiveSelected(objective.id) ? "text-warning-text" : "text-slate-900 dark:text-white"
                                )}>
                                  {objective.code} - {objective.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
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
                    className="w-full mt-6 p-4 rounded-3xl border-2 border-dashed border-border/40 hover:border-warning/50 hover:bg-warning-bg/50 transition-all flex items-center justify-center gap-2 text-slate-500 dark:text-slate-300 hover:text-warning-text font-medium group"
                  >
                    <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-warning-bg transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                    {t('ebios.workshop2.addCustomObjective', 'Ajouter un objectif personnalisé')}
                  </button>
                )}
              </div>
            </div>
          )}
        </PremiumCard>
      </div>

      {/* SR/OV Pairs Section */}
      <div className="animate-fade-in-up delay-300">
        <PremiumCard glass className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-brand/5 hover:border-brand-200">
          <button
            onClick={() => toggleSection('srOvPairs')}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-brand-50 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform duration-300">
                <Crosshair className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {t('ebios.workshop2.srOvPairs')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-300 font-medium">
                  {retainedPairsCount}/{pairsCount} {t('ebios.workshop2.retainedPairs')}
                </p>
              </div>
            </div>
            {expandedSections.has('srOvPairs') ? (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:bg-brand-500 group-hover:text-white transition-all">
                <ChevronUp className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-all">
                <ChevronDown className="w-5 h-5" />
              </div>
            )}
          </button>

          {expandedSections.has('srOvPairs') && (
            <div className="mt-6 pt-6 border-t border-border/40 dark:border-slate-700/50 animate-accordion-down">
              {selectedSourcesCount === 0 || selectedObjectivesCount === 0 ? (
                <div className="text-center py-12 bg-muted/30/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-border/40 dark:border-slate-700">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <Info className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                    {t('ebios.workshop2.noSelectionTitle', 'Pas de sélection')}
                  </h4>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    {t('ebios.workshop2.selectSourcesAndObjectivesFirst')}
                  </p>
                </div>
              ) : (
                <>
                  {!readOnly && (
                    <div className="flex justify-end mb-6">
                      <button
                        onClick={generatePairs}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-3xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-lg shadow-brand hover:shadow-brand transition-all transform hover:-translate-y-0.5"
                      >
                        <Plus className="w-5 h-5" />
                        {t('ebios.workshop2.generatePairs')}
                      </button>
                    </div>
                  )}

                  {data.srOvPairs.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50/30 dark:bg-slate-800/30 rounded-3xl border border-dashed border-border/40">
                      <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                        {t('ebios.workshop2.noPairsYet')}
                      </p>
                      {!readOnly && (
                        <p className="text-slate-500 dark:text-slate-400">
                          {t('ebios.workshop2.clickGeneratePairs')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {data.srOvPairs.map((pair) => {
                        const source = getRiskSourceById(pair.riskSourceId);
                        const objective = getObjectiveById(pair.targetedObjectiveId);
                        const relevanceScale = GRAVITY_SCALE.find((s) => s.level === pair.relevance);

                        return (
                          <div
                            key={pair.id}
                            className={cn(
                              "group p-5 rounded-2xl border transition-all duration-300",
                              pair.retainedForAnalysis
                                ? "border-success/50 bg-success-bg shadow-sm"
                                : "border-border/40 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-brand-300 hover:shadow-md"
                            )}
                          >
                            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                              {/* Source -> Objective Visualization */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-4 mb-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="w-8 h-8 rounded-lg bg-error-bg flex items-center justify-center flex-shrink-0 text-error-text font-bold text-xs ring-1 ring-error/20">
                                      SR
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                        {source?.name || '?'}
                                      </p>
                                      <p className="text-xs text-error-text font-medium">
                                        {source?.code}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-center px-4">
                                    <div className="w-full h-px bg-slate-200 dark:bg-slate-700 w-16 relative">
                                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end text-right">
                                    <div className="min-w-0">
                                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                        {objective?.name || '?'}
                                      </p>
                                      <p className="text-xs text-warning-text font-medium">
                                        {objective?.code}
                                      </p>
                                    </div>
                                    <div className="w-8 h-8 rounded-lg bg-warning-bg flex items-center justify-center flex-shrink-0 text-warning-text font-bold text-xs ring-1 ring-warning/20">
                                      OV
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between lg:justify-end gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-border/40 dark:border-slate-700/50">
                                {/* Relevance Selector */}
                                <div className="flex flex-col items-center lg:items-end gap-2">
                                  <span className="text-[11px] items-center uppercase font-bold text-slate-500 dark:text-slate-300 tracking-wider">
                                    {t('ebios.workshop2.relevance')}
                                  </span>
                                  {!readOnly ? (
                                    <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900/50">
                                      {GRAVITY_SCALE.map((level) => (
                                        <button
                                          key={level.level}
                                          onClick={() => updatePair(pair.id, { relevance: level.level as 1 | 2 | 3 | 4 })}
                                          className={cn(
                                            "w-8 h-8 rounded-md text-xs font-bold transition-all duration-200 flex items-center justify-center transform hover:scale-105",
                                            pair.relevance === level.level
                                              ? `bg-${level.color}-500 text-white shadow-sm`
                                              : "text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                                          )}
                                        >
                                          {level.level}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className={cn(
                                      "px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm border",
                                      `bg-${relevanceScale?.color || 'gray'}-50 dark:bg-${relevanceScale?.color || 'gray'}-900/20`,
                                      `text-${relevanceScale?.color || 'gray'}-700 dark:text-${relevanceScale?.color || 'gray'}-400`,
                                      `border-${relevanceScale?.color || 'gray'}-200 dark:border-${relevanceScale?.color || 'gray'}-800`
                                    )}>
                                      {relevanceScale?.[locale as 'fr' | 'en'] || relevanceScale?.fr} ({pair.relevance})
                                    </span>
                                  )}
                                </div>

                                {/* Retain Toggle */}
                                <div className="h-10 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block" />

                                <button
                                  onClick={() => !readOnly && updatePair(pair.id, { retainedForAnalysis: !pair.retainedForAnalysis })}
                                  disabled={readOnly}
                                  className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-3xl font-bold text-sm transition-all duration-200 transform active:scale-95",
                                    pair.retainedForAnalysis
                                      ? "bg-success text-success-foreground shadow-lg shadow-success hover:bg-success/90"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300",
                                    readOnly && "cursor-default active:scale-100"
                                  )}
                                >
                                  {pair.retainedForAnalysis ? (
                                    <>
                                      <Check className="w-4 h-4 stroke-[3]" />
                                      {t('ebios.workshop2.retained')}
                                    </>
                                  ) : (
                                    <>
                                      <X className="w-4 h-4 stroke-[3]" />
                                      {t('ebios.workshop2.notRetained')}
                                    </>
                                  )}
                                </button>
                              </div>
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
        </PremiumCard>
      </div>

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
