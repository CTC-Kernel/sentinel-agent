/**
 * Workshop 5: Traitement du Risque
 * Main content component for EBIOS RM Workshop 5
 *
 * Sections:
 * 1. Treatment Plan - Strategy selection for each operational scenario
 * 2. Residual Risk Assessment - Evaluate risk after controls
 * 3. Risk Acceptance Workflow - Formal acceptance of residual risks
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  FileCheck,
  BarChart3,
  Plus,
  ChevronDown,
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
} from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { PremiumCard } from '../../ui/PremiumCard';
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
        <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-border/40 rounded-3xl">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{operationalScenarios.length}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{t('ebios.workshop5.totalRisks')}</p>
        </PremiumCard>

        <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-border/40 rounded-3xl">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-info-bg flex items-center justify-center text-info group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-info mb-1">{treatedCount}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{t('ebios.workshop5.treatedRisks')}</p>
        </PremiumCard>

        <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-border/40 rounded-3xl">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-success-bg flex items-center justify-center text-success group-hover:scale-110 transition-transform">
            <CheckCircle className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-success mb-1">{acceptedCount}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{t('ebios.workshop5.acceptedRisks')}</p>
        </PremiumCard>

        <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-border/40 rounded-3xl">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-violet-600 dark:text-violet-400 mb-1">{averageEffectiveness}%</p>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{t('ebios.workshop5.avgEffectiveness')}</p>
        </PremiumCard>
      </div>

      {/* Treatment Overview Progress */}
      <PremiumCard glass className="animate-fade-in-up delay-100 border-border/40 rounded-3xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-info-bg text-info">
              <FileCheck className="w-4 h-4" />
            </div>
            {t('ebios.workshop5.treatmentProgress')}
          </h3>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-muted-foreground">
            {treatedCount}/{operationalScenarios.length} {t('ebios.workshop5.scenarios')}
          </span>
        </div>

        <div className="w-full bg-slate-100/50 dark:bg-slate-800 rounded-full h-4 overflow-hidden border border-border/40 p-0.5">
          <div
            className="bg-gradient-primary h-full rounded-full transition-all duration-700 ease-out shadow-sm relative group"
            style={{ width: `${operationalScenarios.length > 0 ? (treatedCount / operationalScenarios.length) * 100 : 0}%` }}
          >
            <div className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors animate-pulse-slow"></div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('ebios.workshop5.strategyDistribution')}</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TREATMENT_STRATEGIES.map((strategy) => {
              const count = data.treatmentPlan.filter(tp => tp.strategy === strategy.value).length;
              return (
                <div
                  key={strategy.value || 'unknown'}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-3xl border transition-all duration-300 hover:shadow-md",
                    `bg-${strategy.color}-50/50 dark:bg-${strategy.color}-900/10`,
                    `border-${strategy.color}-100 dark:border-${strategy.color}-800/30`,
                    `hover:border-${strategy.color}-200 dark:hover:border-${strategy.color}-700`
                  )}
                >
                  <span className={cn("text-2xl font-bold mb-1", `text-${strategy.color}-600 dark:text-${strategy.color}-400`)}>
                    {count}
                  </span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide">{strategy.label[locale]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </PremiumCard>

      {/* Risk Treatment List */}
      <div className="space-y-6">
        {operationalScenarios.length === 0 ? (
          <PremiumCard glass className="animate-fade-in-up delay-200">
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-slate-300 dark:text-slate-300" />
              </div>
              <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {t('ebios.workshop5.noOperationalScenarios')}
              </h4>
              <p className="text-slate-600 dark:text-slate-600">{t('ebios.workshop5.completeWorkshop4First')}</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 border border-border/40 animate-fade-in-up delay-200">
              <Sparkles className="w-5 h-5 text-info flex-shrink-0" />
              <p className="text-sm text-info-text">
                {t('ebios.workshop5.helpText', 'Définissez la stratégie de traitement pour chaque risque. L\'objectif est de ramener le risque résiduel à un niveau acceptable.')}
              </p>
            </div>

            {operationalScenarios.map((opScenario, index) => {
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
                <div key={opScenario.id || 'unknown'} className={`animate-fade-in-up delay-${(index + 3) * 100}`}>
                  <PremiumCard glass className={cn(
                    "overflow-hidden transition-all duration-300 hover:shadow-lg border-border/40 rounded-3xl",
                    isExpanded ? "ring-1 ring-brand-300" : ""
                  )}>
                    {/* Scenario Header */}
                    <div
                      onClick={() => setExpandedScenario(isExpanded ? null : opScenario.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedScenario(isExpanded ? null : opScenario.id);
                        }
                      }}
                      className="flex items-center justify-between cursor-pointer hover:bg-muted/30/50 dark:hover:bg-slate-800/50 -m-6 p-6 transition-colors"
                      role="button"
                      aria-label={`Scénario: ${opScenario.name}`}
                      tabIndex={0}
                    >
                      <div className="flex items-center gap-5">
                        {/* Risk Badge Transition */}
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex flex-col items-center justify-center w-14 h-14 rounded-3xl shadow-sm border transition-all",
                            `bg-${initialRiskColor}-50 dark:bg-${initialRiskColor}-900/20`,
                            `border-${initialRiskColor}-100 dark:border-${initialRiskColor}-800`,
                            `text-${initialRiskColor}-700 dark:text-${initialRiskColor}-400`
                          )}>
                            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">Initial</span>
                            <span className="text-xl font-bold leading-none">R{opScenario.riskLevel}</span>
                          </div>

                          {residualRisk && (
                            <>
                              <div className="text-slate-300 dark:text-slate-300">
                                <TrendingDown className="w-5 h-5 -rotate-90" />
                              </div>
                              <div className={cn(
                                "flex flex-col items-center justify-center w-14 h-14 rounded-3xl shadow-sm border transition-all",
                                `bg-${residualRiskColor}-50 dark:bg-${residualRiskColor}-900/20`,
                                `border-${residualRiskColor}-100 dark:border-${residualRiskColor}-800`,
                                `text-${residualRiskColor}-700 dark:text-${residualRiskColor}-400`
                              )}>
                                <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">Resid.</span>
                                <span className="text-xl font-bold leading-none">R{residualRisk.residualRiskLevel}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <div>
                          <h4 className={cn(
                            "text-lg font-bold transition-colors",
                            isExpanded ? "text-brand-600 dark:text-brand-400" : "text-slate-900 dark:text-white"
                          )}>
                            {opScenario.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                            <span className="font-medium text-slate-700 dark:text-muted-foreground">
                              {strategicScenario?.name}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                            <span>G{gravity} × V{opScenario.likelihood}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Treatment Status Badge */}
                        {treatment ? (
                          <div className="flex items-center gap-3">
                            {TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy) && (
                              <span className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border shadow-sm",
                                `bg-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-50`,
                                `text-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-700`,
                                `border-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-200`,
                                `dark:bg-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-900/30`,
                                `dark:text-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-400`,
                                `dark:border-${TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color}-800`
                              )}>
                                {React.createElement(
                                  TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.icon || ShieldCheck,
                                  { className: 'w-3.5 h-3.5' }
                                )}
                                {TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.label[locale]}
                              </span>
                            )}

                            {residualRisk?.acceptedBy ? (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success-bg text-success border border-success-border" title={t('ebios.workshop5.riskAccepted')}>
                                <CheckCircle className="w-5 h-5" />
                              </div>
                            ) : treatment.status === 'completed' ? (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-info-bg text-info border border-info-border" title={t('ebios.workshop5.treatmentCompleted')}>
                                <CheckCircle className="w-5 h-5" />
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wide border border-border/40 dark:border-slate-700">
                            {t('ebios.workshop5.notTreated')}
                          </span>
                        )}

                        <div className={cn(
                          "p-2 rounded-full transition-all duration-300",
                          isExpanded
                            ? "bg-brand-100 dark:bg-brand-900 text-brand-600 rotate-180"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                        )}>
                          <ChevronDown className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-border/40 animate-accordion-down">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                          {/* Left Column: Treatment Strategy */}
                          <div className="lg:col-span-7 space-y-6">
                            <div>
                              <h5 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                                <ShieldCheck className="w-4 h-4 text-info" />
                                {t('ebios.workshop5.treatmentStrategy')}
                              </h5>

                              {!treatment ? (
                                <button
                                  onClick={() => handleCreateTreatment(opScenario.id)}
                                  disabled={readOnly}
                                  className="w-full py-8 rounded-3xl border-2 border-dashed border-border/40 hover:border-brand-400 hover:bg-brand-100 dark:hover:bg-brand-50 dark:bg-brand-900 transition-all group/add flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300 hover:text-brand-600"
                                >
                                  <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 group-hover/add:bg-brand-100 dark:group-hover/add:bg-brand-900 transition-colors">
                                    <Plus className="w-6 h-6" />
                                  </div>
                                  <span className="font-medium">{t('ebios.workshop5.defineTreatment')}</span>
                                </button>
                              ) : (
                                <div className="space-y-6">
                                  {/* Strategy Cards */}
                                  <div className="grid grid-cols-2 gap-3">
                                    {TREATMENT_STRATEGIES.map((strategy) => {
                                      const isSelected = treatment.strategy === strategy.value;
                                      const StrategyIcon = strategy.icon;
                                      return (
                                        <button
                                          key={strategy.value || 'unknown'}
                                          onClick={() => !readOnly && handleUpdateTreatment(opScenario.id, { strategy: strategy.value })}
                                          disabled={readOnly}
                                          className={cn(
                                            "relative p-4 rounded-3xl border-2 transition-all text-left overflow-hidden group/card",
                                            isSelected
                                              ? `border-${strategy.color}-500 bg-${strategy.color}-50 dark:bg-${strategy.color}-900/20 shadow-md`
                                              : "border-border/40 bg-slate-50/50 dark:hover:bg-slate-800/50 hover:bg-muted/30 dark:hover:bg-slate-800/50"
                                          )}
                                        >
                                          {isSelected && (
                                            <div className={cn("absolute top-0 right-0 p-1 rounded-bl-lg text-white", `bg-${strategy.color}-500`)}>
                                              <CheckCircle className="w-3.5 h-3.5" />
                                            </div>
                                          )}
                                          <StrategyIcon className={cn(
                                            "w-6 h-6 mb-2 transition-transform group-hover/card:scale-110",
                                            isSelected
                                              ? `text-${strategy.color}-600 dark:text-${strategy.color}-400`
                                              : "text-slate-600 group-hover/card:text-slate-600 dark:group-hover/card:text-slate-300"
                                          )} />
                                          <p className={cn(
                                            "font-bold text-sm mb-0.5",
                                            isSelected
                                              ? `text-${strategy.color}-700 dark:text-${strategy.color}-300`
                                              : "text-slate-700 dark:text-slate-300"
                                          )}>
                                            {strategy.label[locale]}
                                          </p>
                                          <p className="text-[11px] leading-tight text-slate-600 dark:text-slate-300 line-clamp-2">
                                            {strategy.description[locale]}
                                          </p>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Strategy Details Form */}
                                  <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-5 border border-border/40 space-y-4">
                                    {/* Justification */}
                                    <div>
                                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                                        {t('ebios.workshop5.strategyJustification')}
                                      </label>
                                      {!readOnly ? (
                                        <textarea
                                          value={treatment.strategyJustification || ''}
                                          onChange={(e) => handleUpdateTreatment(opScenario.id, { strategyJustification: e.target.value })}
                                          placeholder={t('ebios.workshop5.justificationPlaceholder')}
                                          rows={2}
                                          className="w-full px-4 py-2.5 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-900 focus-visible:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 transition-all text-sm resize-none"
                                        />
                                      ) : (
                                        <p className="text-sm text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-900 p-3 rounded-2xl border border-border/40 italic">
                                          {treatment.strategyJustification || '-'}
                                        </p>
                                      )}
                                    </div>

                                    {/* Implementation Details */}
                                    {(treatment.strategy === 'mitigate' || treatment.strategy === 'transfer') && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                            <UserCircle className="w-3.5 h-3.5" />
                                            {t('ebios.workshop5.responsible')}
                                          </label>
                                          {!readOnly ? (
                                            <input
                                              type="text"
                                              value={treatment.responsibleId || ''}
                                              onChange={(e) => handleUpdateTreatment(opScenario.id, { responsibleId: e.target.value })}
                                              placeholder={t('ebios.workshop5.responsiblePlaceholder')}
                                              className="w-full px-4 py-2.5 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-900 focus-visible:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 transition-all text-sm"
                                            />
                                          ) : (
                                            <p className="text-sm font-medium text-slate-700 dark:text-muted-foreground">
                                              {treatment.responsibleId || '-'}
                                            </p>
                                          )}
                                        </div>
                                        <div>
                                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {t('ebios.workshop5.deadline')}
                                          </label>
                                          {!readOnly ? (
                                            <input
                                              type="date"
                                              value={treatment.deadline || ''}
                                              onChange={(e) => handleUpdateTreatment(opScenario.id, { deadline: e.target.value })}
                                              className="w-full px-4 py-2.5 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-900 focus-visible:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 transition-all text-sm"
                                            />
                                          ) : (
                                            <p className="text-sm font-medium text-slate-700 dark:text-muted-foreground">
                                              {treatment.deadline || '-'}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Controls Selection */}
                                    {(treatment.strategy === 'mitigate' || treatment.strategy === 'transfer') && (
                                      <div className="mt-4 pt-4 border-t border-border/40 dark:border-slate-700/50">
                                        <div className="flex items-center justify-between mb-3">
                                          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5 text-info" />
                                            {t('ebios.workshop5.selectedControls')}
                                          </label>
                                          {!readOnly && (
                                            <button
                                              onClick={() => setShowControlSelector(opScenario.id)}
                                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-400 text-xs font-bold hover:bg-brand-200 dark:hover:bg-brand-900 transition-colors"
                                            >
                                              <Plus className="w-3.5 h-3.5" />
                                              {t('ebios.workshop5.selectControls')}
                                            </button>
                                          )}
                                        </div>

                                        {/* Suggested controls hint */}
                                        {getSuggestedControls(opScenario.id).length > 0 && treatment.selectedControlIds.length === 0 && (
                                          <div className="flex items-center gap-2 mb-3 p-2.5 bg-gradient-to-r from-violet-50 to-brand-100 dark:from-violet-900/20 dark:to-brand-900/20 rounded-lg border border-violet-100 dark:border-violet-800/30">
                                            <Sparkles className="w-4 h-4 text-violet-500" />
                                            <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                                              {t('ebios.workshop5.controlSuggestionsAvailable', { count: getSuggestedControls(opScenario.id).length })}
                                            </span>
                                          </div>
                                        )}

                                        {/* Selected controls list */}
                                        {treatment.selectedControlIds.length > 0 ? (
                                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                            {treatment.selectedControlIds.map((code) => (
                                              <div
                                                key={code || 'unknown'}
                                                className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-3xl border border-border/40 dark:border-slate-700 shadow-sm"
                                              >
                                                <div className="flex items-center gap-3">
                                                  <div className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold">
                                                    {code}
                                                  </div>
                                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-1">{getControlName(code)}</span>
                                                </div>
                                                {!readOnly && (
                                                  <button
                                                    onClick={() => handleUpdateControls(opScenario.id, treatment.selectedControlIds.filter(c => c !== code))}
                                                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                  >
                                                    <XCircle className="w-4 h-4" />
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="text-center py-6 border-2 border-dashed border-border/40 dark:border-slate-700 rounded-3xl bg-muted/30/50 dark:bg-slate-800/50">
                                            <p className="text-sm text-muted-foreground dark:text-slate-600 italic">
                                              {t('ebios.workshop5.noControlsSelected')}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Action buttons */}
                                    {!readOnly && (
                                      <div className="flex justify-between items-center pt-2">
                                        <div className="flex gap-2">
                                          {TREATMENT_STATUS_OPTIONS.map((status) => (
                                            <button
                                              key={status.value || 'unknown'}
                                              onClick={() => !readOnly && handleUpdateTreatment(opScenario.id, { status: status.value })}
                                              disabled={readOnly}
                                              className={cn(
                                                "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all border",
                                                treatment.status === status.value
                                                  ? `bg-${status.color}-500 text-white border-${status.color}-500 shadow-sm`
                                                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-border/40 dark:border-slate-700 hover:bg-muted/30 dark:hover:bg-slate-800"
                                              )}
                                            >
                                              {status.label[locale]}
                                            </button>
                                          ))}
                                        </div>
                                        <button
                                          onClick={() => handleDeleteTreatment(opScenario.id)}
                                          className="text-xs font-medium text-red-500 hover:text-red-600 hover:underline flex items-center gap-1"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          {t('ebios.workshop5.removeTreatment')}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Column: Residual Risk & Acceptance */}
                          <div className="lg:col-span-5 space-y-6">
                            {(treatment && treatment.strategy !== 'accept') && (
                              <div className="h-full flex flex-col">
                                <h5 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                                  <BarChart3 className="w-4 h-4 text-violet-500" />
                                  {t('ebios.workshop5.residualRiskAssessment')}
                                </h5>

                                <div className="flex-1 p-6 bg-slate-50/50 dark:bg-slate-800/50 rounded-3xl border border-border/40 flex flex-col gap-6">
                                  {/* Risk Comparison Visualization */}
                                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-3xl border border-border/40 dark:border-slate-700 shadow-sm">
                                    <div className="text-center">
                                      <span className="caption block mb-1">{t('ebios.workshop5.initialRisk')}</span>
                                      <span className={cn(
                                        "inline-block px-3 py-1 rounded-lg text-lg font-bold",
                                        `bg-${initialRiskColor}-100 dark:bg-${initialRiskColor}-900/30`,
                                        `text-${initialRiskColor}-700 dark:text-${initialRiskColor}-400`
                                      )}>
                                        R{opScenario.riskLevel}
                                      </span>
                                    </div>

                                    <div className="flex flex-col items-center px-4">
                                      <TrendingDown className="w-6 h-6 text-slate-300 dark:text-slate-300 animate-bounce" />
                                      <span className="text-xs font-bold text-success-text">-{Math.round((residualRisk?.controlEffectiveness || 0))}%</span>
                                    </div>

                                    <div className="text-center">
                                      <span className="caption block mb-1">{t('ebios.workshop5.residualRisk')}</span>
                                      <span className={cn(
                                        "inline-block px-3 py-1 rounded-lg text-lg font-bold transition-all duration-500",
                                        residualRisk
                                          ? `bg-${residualRiskColor}-100 dark:bg-${residualRiskColor}-900/30 text-${residualRiskColor}-700 dark:text-${residualRiskColor}-400 ring-2 ring-${residualRiskColor}-500/20`
                                          : "bg-slate-100 dark:bg-slate-800 text-slate-600"
                                      )}>
                                        R{residualRisk?.residualRiskLevel || opScenario.riskLevel}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Effectiveness Control */}
                                  <div className="flex-1 flex flex-col justify-center">
                                    <div className="flex items-end justify-between mb-4">
                                      <label className="text-sm font-medium text-slate-700 dark:text-muted-foreground">
                                        {t('ebios.workshop5.controlEffectiveness')}
                                      </label>
                                      <span className="text-2xl font-bold text-brand-600 dark:text-brand-400 font-mono">
                                        {residualRisk?.controlEffectiveness || 0}<span className="text-sm text-muted-foreground">%</span>
                                      </span>
                                    </div>

                                    <div className="relative h-10 flex items-center">
                                      {/* Track background */}
                                      <div className="absolute w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-primary transition-all duration-300"
                                          style={{ width: `${residualRisk?.controlEffectiveness || 0}%` }}
                                        ></div>
                                      </div>

                                      {!readOnly ? (
                                        <input
                                          type="range"
                                          min="0"
                                          max="100"
                                          step="5"
                                          value={residualRisk?.controlEffectiveness || 0}
                                          onChange={(e) => handleUpdateResidualRisk(opScenario.id, Number(e.target.value))}
                                          className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                      ) : null}

                                      {/* Thumb (Visual Only if readOnly) */}
                                      <div
                                        className="absolute h-6 w-6 bg-white dark:bg-slate-800 rounded-full shadow-md border-2 border-brand-500 pointer-events-none transition-all duration-300 flex items-center justify-center transform -translate-x-1/2"
                                        style={{ left: `${residualRisk?.controlEffectiveness || 0}%` }}
                                      >
                                        <div className="w-2 h-2 bg-brand-500 rounded-full"></div>
                                      </div>
                                    </div>

                                    <div className="flex justify-between caption mt-2">
                                      <span>Ineffective</span>
                                      <span>Effective</span>
                                    </div>
                                  </div>

                                  {/* Acceptance Status */}
                                  <div className="pt-6 border-t border-border/40 dark:border-slate-700">
                                    <h6 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                                      <ClipboardCheck className="w-3.5 h-3.5" />
                                      {t('ebios.workshop5.riskAcceptance')}
                                    </h6>

                                    {residualRisk?.acceptedBy ? (
                                      <div className="p-4 bg-success-bg rounded-3xl border border-success-border">
                                        <div className="flex items-start gap-3">
                                          <div className="p-1 rounded-full bg-success-bg text-success mt-0.5">
                                            <CheckCircle className="w-5 h-5" />
                                          </div>
                                          <div>
                                            <p className="font-bold text-success-text text-sm">
                                              {t('ebios.workshop5.riskAccepted')}
                                            </p>
                                            <p className="text-xs text-success-text/80 mt-0.5">
                                              {residualRisk.acceptanceDate && new Date(residualRisk.acceptanceDate).toLocaleDateString(locale)}
                                            </p>
                                            {residualRisk.acceptanceJustification && (
                                              <p className="mt-2 text-xs text-success-text/70 italic pl-2 border-l-2 border-success-border">
                                                "{residualRisk.acceptanceJustification}"
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="p-4 bg-warning-bg rounded-3xl border border-warning-border">
                                        <div className="flex flex-col gap-3">
                                          <div className="flex items-center gap-2 text-warning-text">
                                            <AlertTriangle className="w-5 h-5" />
                                            <span className="text-sm font-bold">{t('ebios.workshop5.pendingAcceptance')}</span>
                                          </div>
                                          {!readOnly && (
                                            <button
                                              onClick={() => setShowAcceptanceModal(opScenario.id)}
                                              className="w-full py-2 rounded-lg bg-success hover:bg-success/90 text-success-foreground text-sm font-bold shadow-sm shadow-success transition-all active:scale-95"
                                            >
                                              {t('ebios.workshop5.acceptRisk')}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </PremiumCard>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      <button
        className="absolute inset-0 w-full h-full bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] border-0 cursor-pointer"
        onClick={onClose}
        aria-label="Fermer la boîte de dialogue"
      />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {t('ebios.workshop5.acceptRiskTitle')}
        </h3>

        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-muted-foreground">
            {t('ebios.workshop5.acceptRiskDescription')}
          </p>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl">
            <p className="text-sm font-medium text-slate-900 dark:text-white">{scenarioName}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {t('ebios.workshop5.residualRisk')}: <span className="font-bold">R{residualRisk}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('ebios.workshop5.acceptanceJustification')} *
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={t('ebios.workshop5.acceptanceJustificationPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border/40 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border/40 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onAccept(justification)}
            disabled={!justification.trim()}
            className="px-4 py-2 rounded-lg bg-success hover:bg-success/90 disabled:bg-slate-300 disabled:cursor-not-allowed text-success-foreground text-sm font-medium transition-colors"
          >
            {t('ebios.workshop5.confirmAcceptance')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Workshop5Content;
