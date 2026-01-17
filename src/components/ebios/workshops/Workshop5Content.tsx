/**
 * Workshop 5: Traitement du Risque
 * Main content component for EBIOS RM Workshop 5
 *
 * Sections:
 * 1. Treatment Plan - Strategy selection for each operational scenario
 * 2. Residual Risk Assessment - Evaluate risk after controls
 * 3. Risk Acceptance Workflow - Formal acceptance of residual risks
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  FileCheck,
  BarChart3,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingDown,
  ClipboardCheck,
  UserCircle,
  Calendar,
  Shield,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
import type {
  Workshop5Data,
  Workshop4Data,
  Workshop3Data,
  TreatmentPlanItem,
  ResidualRiskAssessment,
  OperationalScenario,
  StrategicScenario,
} from '../../../types/ebios';
import { RISK_MATRIX_CONFIG, getControlSuggestionsForScenario } from '../../../data/ebiosLibrary';
import { ISO_SEED_CONTROLS } from '../../../data/complianceData';
import { ControlSelectorModal } from '../workshop5/ControlSelectorModal';
import { v4 as uuidv4 } from 'uuid';

interface Workshop5ContentProps {
  data: Workshop5Data;
  workshop4Data: Workshop4Data;
  workshop3Data: Workshop3Data;
  onDataChange: (data: Partial<Workshop5Data>) => void;
  readOnly?: boolean;
}

// Treatment strategy configuration
const TREATMENT_STRATEGIES = [
  {
    value: 'mitigate' as const,
    icon: ShieldCheck,
    color: 'blue',
    label: { fr: 'Réduire', en: 'Mitigate' },
    description: {
      fr: 'Mettre en place des mesures pour réduire le risque',
      en: 'Implement measures to reduce the risk',
    },
  },
  {
    value: 'transfer' as const,
    icon: TrendingDown,
    color: 'purple',
    label: { fr: 'Transférer', en: 'Transfer' },
    description: {
      fr: 'Transférer le risque à un tiers (assurance, sous-traitance)',
      en: 'Transfer risk to a third party (insurance, outsourcing)',
    },
  },
  {
    value: 'avoid' as const,
    icon: XCircle,
    color: 'orange',
    label: { fr: 'Éviter', en: 'Avoid' },
    description: {
      fr: 'Éviter l\'activité génératrice de risque',
      en: 'Avoid the risk-generating activity',
    },
  },
  {
    value: 'accept' as const,
    icon: CheckCircle,
    color: 'green',
    label: { fr: 'Accepter', en: 'Accept' },
    description: {
      fr: 'Accepter le risque en connaissance de cause',
      en: 'Accept the risk with full knowledge',
    },
  },
];

const TREATMENT_STATUS_OPTIONS = [
  {
    value: 'planned' as const,
    label: { fr: 'Planifié', en: 'Planned' },
    color: 'gray',
  },
  {
    value: 'in_progress' as const,
    label: { fr: 'En cours', en: 'In progress' },
    color: 'blue',
  },
  {
    value: 'completed' as const,
    label: { fr: 'Terminé', en: 'Completed' },
    color: 'green',
  },
];

export const Workshop5Content: React.FC<Workshop5ContentProps> = ({
  data,
  workshop4Data,
  workshop3Data,
  onDataChange,
  readOnly = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('fr') ? 'fr' : 'en';

  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [showAcceptanceModal, setShowAcceptanceModal] = useState<string | null>(null);
  const [showControlSelector, setShowControlSelector] = useState<string | null>(null);

  // Get operational scenarios from Workshop 4
  const operationalScenarios = workshop4Data.operationalScenarios;
  const strategicScenarios = workshop3Data.strategicScenarios;

  // Get strategic scenario for an operational scenario
  const getStrategicScenario = (opScenario: OperationalScenario): StrategicScenario | undefined => {
    return strategicScenarios.find(s => s.id === opScenario.strategicScenarioId);
  };

  // Risk level calculation
  const getRiskLevel = (gravity: number, likelihood: number) => {
    return RISK_MATRIX_CONFIG.getRiskLevel(gravity, likelihood);
  };

  const getRiskColor = (level: string) => {
    return RISK_MATRIX_CONFIG.levels[level as keyof typeof RISK_MATRIX_CONFIG.levels]?.color || 'gray';
  };

  // Get treatment plan for a scenario
  const getTreatmentPlan = (scenarioId: string): TreatmentPlanItem | undefined => {
    return data.treatmentPlan.find(tp => tp.operationalScenarioId === scenarioId);
  };

  // Get residual risk assessment for a scenario
  const getResidualRisk = (scenarioId: string): ResidualRiskAssessment | undefined => {
    return data.residualRisks.find(rr => rr.operationalScenarioId === scenarioId);
  };

  // Get control name by code
  const getControlName = (code: string): string => {
    const control = ISO_SEED_CONTROLS.find(c => c.code === code);
    return control?.name || code;
  };

  // Get suggested controls for a scenario based on MITRE techniques
  const getSuggestedControls = useCallback((scenarioId: string): string[] => {
    const opScenario = operationalScenarios.find(s => s.id === scenarioId);
    if (!opScenario?.attackSequence) return [];
    return getControlSuggestionsForScenario(opScenario.attackSequence);
  }, [operationalScenarios]);

  // Calculate residual risk based on control effectiveness
  const calculateResidualRisk = (initialRisk: number, effectiveness: number): number => {
    const reduction = initialRisk * (effectiveness / 100);
    return Math.max(1, Math.round(initialRisk - reduction));
  };

  // Handlers
  const handleCreateTreatment = useCallback((scenarioId: string) => {
    const newTreatment: TreatmentPlanItem = {
      id: uuidv4(),
      operationalScenarioId: scenarioId,
      strategy: 'mitigate',
      strategyJustification: '',
      selectedControlIds: [],
      status: 'planned',
    };

    onDataChange({
      treatmentPlan: [...data.treatmentPlan, newTreatment],
    });
  }, [data.treatmentPlan, onDataChange]);

  const handleUpdateTreatment = useCallback((scenarioId: string, updates: Partial<TreatmentPlanItem>) => {
    const treatmentPlan = data.treatmentPlan.map(tp =>
      tp.operationalScenarioId === scenarioId ? { ...tp, ...updates } : tp
    );
    onDataChange({ treatmentPlan });
  }, [data.treatmentPlan, onDataChange]);

  const handleDeleteTreatment = useCallback((scenarioId: string) => {
    const treatmentPlan = data.treatmentPlan.filter(tp => tp.operationalScenarioId !== scenarioId);
    const residualRisks = data.residualRisks.filter(rr => rr.operationalScenarioId !== scenarioId);
    onDataChange({ treatmentPlan, residualRisks });
  }, [data.treatmentPlan, data.residualRisks, onDataChange]);

  // Handle updating selected controls for a treatment
  const handleUpdateControls = useCallback((scenarioId: string, controlIds: string[]) => {
    const treatmentPlan = data.treatmentPlan.map(tp =>
      tp.operationalScenarioId === scenarioId
        ? { ...tp, selectedControlIds: controlIds }
        : tp
    );
    onDataChange({ treatmentPlan });
    setShowControlSelector(null);
  }, [data.treatmentPlan, onDataChange]);

  const handleUpdateResidualRisk = useCallback((scenarioId: string, effectiveness: number) => {
    const opScenario = operationalScenarios.find(s => s.id === scenarioId);
    if (!opScenario) return;

    const initialRisk = opScenario.riskLevel;
    const residualRiskLevel = calculateResidualRisk(initialRisk, effectiveness);

    const existing = data.residualRisks.find(rr => rr.operationalScenarioId === scenarioId);

    if (existing) {
      const residualRisks = data.residualRisks.map(rr =>
        rr.operationalScenarioId === scenarioId
          ? { ...rr, controlEffectiveness: effectiveness, residualRiskLevel }
          : rr
      );
      onDataChange({ residualRisks });
    } else {
      const newResidualRisk: ResidualRiskAssessment = {
        id: uuidv4(),
        operationalScenarioId: scenarioId,
        initialRiskLevel: initialRisk,
        controlEffectiveness: effectiveness,
        residualRiskLevel,
      };
      onDataChange({ residualRisks: [...data.residualRisks, newResidualRisk] });
    }
  }, [data.residualRisks, operationalScenarios, onDataChange]);

  const handleAcceptRisk = useCallback((scenarioId: string, justification: string) => {
    const residualRisks = data.residualRisks.map(rr =>
      rr.operationalScenarioId === scenarioId
        ? {
            ...rr,
            acceptedBy: 'current_user', // Would be replaced with actual user ID
            acceptanceDate: new Date().toISOString(),
            acceptanceJustification: justification,
          }
        : rr
    );
    onDataChange({ residualRisks });
    setShowAcceptanceModal(null);
  }, [data.residualRisks, onDataChange]);

  // Stats
  const treatedCount = data.treatmentPlan.length;
  const acceptedCount = data.residualRisks.filter(rr => rr.acceptedBy).length;
  const averageEffectiveness = data.residualRisks.length > 0
    ? Math.round(data.residualRisks.reduce((sum, rr) => sum + rr.controlEffectiveness, 0) / data.residualRisks.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{operationalScenarios.length}</p>
          <p className="text-sm text-gray-500 mt-1">{t('ebios.workshop5.totalRisks')}</p>
        </GlassCard>
        <GlassCard className="text-center">
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{treatedCount}</p>
          <p className="text-sm text-gray-500 mt-1">{t('ebios.workshop5.treatedRisks')}</p>
        </GlassCard>
        <GlassCard className="text-center">
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{acceptedCount}</p>
          <p className="text-sm text-gray-500 mt-1">{t('ebios.workshop5.acceptedRisks')}</p>
        </GlassCard>
        <GlassCard className="text-center">
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{averageEffectiveness}%</p>
          <p className="text-sm text-gray-500 mt-1">{t('ebios.workshop5.avgEffectiveness')}</p>
        </GlassCard>
      </div>

      {/* Treatment Overview Progress */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-500" />
            {t('ebios.workshop5.treatmentProgress')}
          </h3>
          <span className="text-sm text-gray-500">
            {treatedCount}/{operationalScenarios.length} {t('ebios.workshop5.scenarios')}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${operationalScenarios.length > 0 ? (treatedCount / operationalScenarios.length) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between mt-4 text-xs text-gray-500">
          <span>{t('ebios.workshop5.strategyDistribution')}</span>
        </div>
        <div className="flex gap-2 mt-2">
          {TREATMENT_STRATEGIES.map((strategy) => {
            const count = data.treatmentPlan.filter(tp => tp.strategy === strategy.value).length;
            return (
              <div
                key={strategy.value}
                className={cn(
                  "flex-1 p-2 rounded-lg text-center",
                  `bg-${strategy.color}-50 dark:bg-${strategy.color}-900/20`
                )}
              >
                <p className={cn("text-lg font-bold", `text-${strategy.color}-600 dark:text-${strategy.color}-400`)}>
                  {count}
                </p>
                <p className="text-xs text-gray-500">{strategy.label[locale]}</p>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Risk Treatment List */}
      {operationalScenarios.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">{t('ebios.workshop5.noOperationalScenarios')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('ebios.workshop5.completeWorkshop4First')}</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {operationalScenarios.map((opScenario) => {
            const strategicScenario = getStrategicScenario(opScenario);
            const treatment = getTreatmentPlan(opScenario.id);
            const residualRisk = getResidualRisk(opScenario.id);
            const isExpanded = expandedScenario === opScenario.id;

            const gravity = strategicScenario?.gravity || 2;
            const initialRiskLevel = getRiskLevel(gravity, opScenario.likelihood);
            const initialRiskColor = getRiskColor(initialRiskLevel);

            const residualRiskLevel = residualRisk
              ? getRiskLevel(
                  Math.ceil(residualRisk.residualRiskLevel / opScenario.likelihood),
                  opScenario.likelihood
                )
              : initialRiskLevel;
            const residualRiskColor = getRiskColor(residualRiskLevel);

            return (
              <GlassCard key={opScenario.id} className="overflow-hidden">
                {/* Scenario Header */}
                <div
                  onClick={() => setExpandedScenario(isExpanded ? null : opScenario.id)}
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/50 -m-4 p-4 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Risk Badge */}
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold",
                        `bg-${initialRiskColor}-100 dark:bg-${initialRiskColor}-900/30`,
                        `text-${initialRiskColor}-700 dark:text-${initialRiskColor}-400`
                      )}>
                        R{opScenario.riskLevel}
                      </span>
                      {residualRisk && (
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-medium",
                          `bg-${residualRiskColor}-100 dark:bg-${residualRiskColor}-900/30`,
                          `text-${residualRiskColor}-700 dark:text-${residualRiskColor}-400`
                        )}>
                          → R{residualRisk.residualRiskLevel}
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {opScenario.name}
                      </h4>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {strategicScenario?.name} · G{gravity} × V{opScenario.likelihood}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Treatment Status */}
                    {treatment ? (
                      <div className="flex items-center gap-2">
                        {TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy) && (
                          <span className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium",
                            `bg-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-100`,
                            `text-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-700`,
                            `dark:bg-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-900/30`,
                            `dark:text-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-400`
                          )}>
                            {React.createElement(
                              TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.icon || ShieldCheck,
                              { className: 'w-3.5 h-3.5' }
                            )}
                            {TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.label[locale]}
                          </span>
                        )}
                        {residualRisk?.acceptedBy && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">{t('ebios.workshop5.notTreated')}</span>
                    )}

                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 space-y-6">
                    {/* Treatment Strategy Selection */}
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        {t('ebios.workshop5.treatmentStrategy')}
                      </h5>

                      {!treatment ? (
                        <button
                          onClick={() => handleCreateTreatment(opScenario.id)}
                          disabled={readOnly}
                          className="w-full py-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600"
                        >
                          <Plus className="w-5 h-5" />
                          {t('ebios.workshop5.defineTreatment')}
                        </button>
                      ) : (
                        <div className="space-y-4">
                          {/* Strategy Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {TREATMENT_STRATEGIES.map((strategy) => {
                              const isSelected = treatment.strategy === strategy.value;
                              const StrategyIcon = strategy.icon;
                              return (
                                <button
                                  key={strategy.value}
                                  onClick={() => !readOnly && handleUpdateTreatment(opScenario.id, { strategy: strategy.value })}
                                  disabled={readOnly}
                                  className={cn(
                                    "p-4 rounded-xl border-2 transition-all text-left",
                                    isSelected
                                      ? `border-${strategy.color}-500 bg-${strategy.color}-50 dark:bg-${strategy.color}-900/20`
                                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                  )}
                                >
                                  <StrategyIcon className={cn(
                                    "w-6 h-6 mb-2",
                                    isSelected
                                      ? `text-${strategy.color}-600 dark:text-${strategy.color}-400`
                                      : "text-gray-400"
                                  )} />
                                  <p className={cn(
                                    "font-medium text-sm",
                                    isSelected
                                      ? `text-${strategy.color}-700 dark:text-${strategy.color}-300`
                                      : "text-gray-700 dark:text-gray-300"
                                  )}>
                                    {strategy.label[locale]}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {strategy.description[locale]}
                                  </p>
                                </button>
                              );
                            })}
                          </div>

                          {/* Strategy Justification */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {t('ebios.workshop5.strategyJustification')}
                            </label>
                            {!readOnly ? (
                              <textarea
                                value={treatment.strategyJustification || ''}
                                onChange={(e) => handleUpdateTreatment(opScenario.id, { strategyJustification: e.target.value })}
                                placeholder={t('ebios.workshop5.justificationPlaceholder')}
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-none"
                              />
                            ) : (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {treatment.strategyJustification || '-'}
                              </p>
                            )}
                          </div>

                          {/* Implementation Details (for mitigate/transfer strategies) */}
                          {(treatment.strategy === 'mitigate' || treatment.strategy === 'transfer') && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <UserCircle className="w-4 h-4" />
                                    {t('ebios.workshop5.responsible')}
                                  </label>
                                  {!readOnly ? (
                                    <input
                                      type="text"
                                      value={treatment.responsibleId || ''}
                                      onChange={(e) => handleUpdateTreatment(opScenario.id, { responsibleId: e.target.value })}
                                      placeholder={t('ebios.workshop5.responsiblePlaceholder')}
                                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                                    />
                                  ) : (
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {treatment.responsibleId || '-'}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {t('ebios.workshop5.deadline')}
                                  </label>
                                  {!readOnly ? (
                                    <input
                                      type="date"
                                      value={treatment.deadline || ''}
                                      onChange={(e) => handleUpdateTreatment(opScenario.id, { deadline: e.target.value })}
                                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                                    />
                                  ) : (
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {treatment.deadline || '-'}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* ISO 27002 Control Selection - Story 19.2 */}
                              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center justify-between mb-3">
                                  <label className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    {t('ebios.workshop5.selectedControls')}
                                  </label>
                                  {!readOnly && (
                                    <button
                                      onClick={() => setShowControlSelector(opScenario.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                                    >
                                      <Plus className="w-4 h-4" />
                                      {t('ebios.workshop5.selectControls')}
                                    </button>
                                  )}
                                </div>

                                {/* Suggested controls hint */}
                                {getSuggestedControls(opScenario.id).length > 0 && treatment.selectedControlIds.length === 0 && (
                                  <div className="flex items-center gap-2 mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                    <Sparkles className="w-4 h-4 text-purple-500" />
                                    <span className="text-xs text-purple-700 dark:text-purple-400">
                                      {t('ebios.workshop5.controlSuggestionsAvailable', { count: getSuggestedControls(opScenario.id).length })}
                                    </span>
                                  </div>
                                )}

                                {/* Selected controls list */}
                                {treatment.selectedControlIds.length > 0 ? (
                                  <div className="space-y-2">
                                    {treatment.selectedControlIds.map((code) => (
                                      <div
                                        key={code}
                                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-800"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{code}</span>
                                          <span className="text-sm text-gray-700 dark:text-gray-300">{getControlName(code)}</span>
                                        </div>
                                        {!readOnly && (
                                          <button
                                            onClick={() => handleUpdateControls(opScenario.id, treatment.selectedControlIds.filter(c => c !== code))}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                          >
                                            <XCircle className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                                      {treatment.selectedControlIds.length} {locale === 'fr' ? 'contrôle(s) sélectionné(s)' : 'control(s) selected'}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-blue-600 dark:text-blue-400 italic">
                                    {t('ebios.workshop5.noControlsSelected')}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Status */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {t('ebios.workshop5.implementationStatus')}
                            </label>
                            <div className="flex gap-2">
                              {TREATMENT_STATUS_OPTIONS.map((status) => (
                                <button
                                  key={status.value}
                                  onClick={() => !readOnly && handleUpdateTreatment(opScenario.id, { status: status.value })}
                                  disabled={readOnly}
                                  className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                    treatment.status === status.value
                                      ? `bg-${status.color}-500 text-white`
                                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                                  )}
                                >
                                  {status.label[locale]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Residual Risk Assessment */}
                    {treatment && treatment.strategy !== 'accept' && (
                      <div className="pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          {t('ebios.workshop5.residualRiskAssessment')}
                        </h5>

                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-4">
                          {/* Control Effectiveness Slider */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm text-gray-600 dark:text-gray-400">
                                {t('ebios.workshop5.controlEffectiveness')}
                              </label>
                              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {residualRisk?.controlEffectiveness || 0}%
                              </span>
                            </div>
                            {!readOnly ? (
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={residualRisk?.controlEffectiveness || 0}
                                onChange={(e) => handleUpdateResidualRisk(opScenario.id, Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                              />
                            ) : (
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full"
                                  style={{ width: `${residualRisk?.controlEffectiveness || 0}%` }}
                                />
                              </div>
                            )}
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                              <span>0%</span>
                              <span>25%</span>
                              <span>50%</span>
                              <span>75%</span>
                              <span>100%</span>
                            </div>
                          </div>

                          {/* Risk Comparison */}
                          <div className="flex items-center justify-center gap-8 py-4">
                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">{t('ebios.workshop5.initialRisk')}</p>
                              <span className={cn(
                                "inline-block px-4 py-2 rounded-xl text-lg font-bold",
                                `bg-${initialRiskColor}-100 dark:bg-${initialRiskColor}-900/30`,
                                `text-${initialRiskColor}-700 dark:text-${initialRiskColor}-400`
                              )}>
                                R{opScenario.riskLevel}
                              </span>
                            </div>
                            <TrendingDown className="w-6 h-6 text-gray-400" />
                            <div className="text-center">
                              <p className="text-xs text-gray-500 mb-1">{t('ebios.workshop5.residualRisk')}</p>
                              <span className={cn(
                                "inline-block px-4 py-2 rounded-xl text-lg font-bold",
                                residualRisk
                                  ? `bg-${residualRiskColor}-100 dark:bg-${residualRiskColor}-900/30 text-${residualRiskColor}-700 dark:text-${residualRiskColor}-400`
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                              )}>
                                R{residualRisk?.residualRiskLevel || opScenario.riskLevel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Risk Acceptance */}
                    {treatment && residualRisk && (
                      <div className="pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4" />
                          {t('ebios.workshop5.riskAcceptance')}
                        </h5>

                        {residualRisk.acceptedBy ? (
                          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <div className="flex items-center gap-3">
                              <CheckCircle className="w-8 h-8 text-green-500" />
                              <div>
                                <p className="font-medium text-green-700 dark:text-green-400">
                                  {t('ebios.workshop5.riskAccepted')}
                                </p>
                                <p className="text-sm text-green-600 dark:text-green-500">
                                  {residualRisk.acceptanceDate && new Date(residualRisk.acceptanceDate).toLocaleDateString(locale)}
                                </p>
                              </div>
                            </div>
                            {residualRisk.acceptanceJustification && (
                              <p className="mt-3 text-sm text-green-600 dark:text-green-500 italic">
                                "{residualRisk.acceptanceJustification}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                            <div className="flex items-center gap-3">
                              <AlertTriangle className="w-6 h-6 text-amber-500" />
                              <p className="text-sm text-amber-700 dark:text-amber-400">
                                {t('ebios.workshop5.pendingAcceptance')}
                              </p>
                            </div>
                            {!readOnly && (
                              <button
                                onClick={() => setShowAcceptanceModal(opScenario.id)}
                                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
                              >
                                {t('ebios.workshop5.acceptRisk')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {!readOnly && treatment && (
                      <div className="flex justify-end pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                        <button
                          onClick={() => handleDeleteTreatment(opScenario.id)}
                          className="px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('ebios.workshop5.removeTreatment')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Control Selector Modal - Story 19.2 */}
      {showControlSelector && (
        <ControlSelectorModal
          isOpen={!!showControlSelector}
          onClose={() => setShowControlSelector(null)}
          onSelect={(controlIds) => handleUpdateControls(showControlSelector, controlIds)}
          selectedControlIds={getTreatmentPlan(showControlSelector)?.selectedControlIds || []}
          suggestedControlCodes={getSuggestedControls(showControlSelector)}
          scenarioName={operationalScenarios.find(s => s.id === showControlSelector)?.name}
        />
      )}

      {/* Acceptance Modal */}
      {showAcceptanceModal && (
        <AcceptanceModal
          isOpen={!!showAcceptanceModal}
          onClose={() => setShowAcceptanceModal(null)}
          onAccept={(justification) => handleAcceptRisk(showAcceptanceModal, justification)}
          scenarioName={operationalScenarios.find(s => s.id === showAcceptanceModal)?.name || ''}
          residualRisk={data.residualRisks.find(rr => rr.operationalScenarioId === showAcceptanceModal)?.residualRiskLevel || 0}
        />
      )}
    </div>
  );
};

// Acceptance Modal Component
interface AcceptanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (justification: string) => void;
  scenarioName: string;
  residualRisk: number;
}

const AcceptanceModal: React.FC<AcceptanceModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  scenarioName,
  residualRisk,
}) => {
  const { t } = useTranslation();
  const [justification, setJustification] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('ebios.workshop5.acceptRiskTitle')}
        </h3>

        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('ebios.workshop5.acceptRiskDescription')}
          </p>

          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <p className="text-sm font-medium text-gray-900 dark:text-white">{scenarioName}</p>
            <p className="text-sm text-gray-500 mt-1">
              {t('ebios.workshop5.residualRisk')}: <span className="font-bold">R{residualRisk}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ebios.workshop5.acceptanceJustification')} *
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={t('ebios.workshop5.acceptanceJustificationPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onAccept(justification)}
            disabled={!justification.trim()}
            className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {t('ebios.workshop5.confirmAcceptance')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Workshop5Content;
