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
import { useLocale } from '../../../hooks/useLocale';
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

// Color mapping for dynamic classes (Tailwind cannot purge dynamic class names)
const STRATEGY_COLOR_MAP: Record<string, {
  container: string;
  containerSelected: string;
  badge: string;
  badgeCorner: string;
  icon: string;
  iconHover: string;
  title: string;
  text: string;
}> = {
  blue: {
    container: 'bg-info-bg border-info-border',
    containerSelected: 'border-info bg-info-bg shadow-md',
    badge: 'bg-info-bg text-info-text border-info-border',
    badgeCorner: 'bg-info text-primary-foreground',
    icon: 'text-info',
    iconHover: 'text-info',
    title: 'text-info-text',
    text: 'text-info',
  },
  purple: {
    container: 'bg-violet-50 dark:bg-violet-900/10 border-violet-100 dark:border-violet-800/30',
    containerSelected: 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 shadow-md',
    badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
    badgeCorner: 'bg-violet-500 text-primary-foreground',
    icon: 'text-violet-600 dark:text-violet-400',
    iconHover: 'text-violet-600 dark:text-violet-400',
    title: 'text-violet-700 dark:text-violet-300',
    text: 'text-violet-600 dark:text-violet-400',
  },
  orange: {
    container: 'bg-warning-bg border-warning-border',
    containerSelected: 'border-warning bg-warning-bg shadow-md',
    badge: 'bg-warning-bg text-warning-text border-warning-border',
    badgeCorner: 'bg-warning text-primary-foreground',
    icon: 'text-warning-text',
    iconHover: 'text-warning-text',
    title: 'text-warning-text',
    text: 'text-warning-text',
  },
  green: {
    container: 'bg-success-bg border-success-border',
    containerSelected: 'border-success bg-success-bg shadow-md',
    badge: 'bg-success-bg text-success-text border-success-border',
    badgeCorner: 'bg-success text-primary-foreground',
    icon: 'text-success-text',
    iconHover: 'text-success-text',
    title: 'text-success-text',
    text: 'text-success-text',
  },
  gray: {
    container: 'bg-muted border-border',
    containerSelected: 'border-muted-foreground bg-muted shadow-md',
    badge: 'bg-muted text-muted-foreground border-border',
    badgeCorner: 'bg-muted-foreground text-primary-foreground',
    icon: 'text-muted-foreground',
    iconHover: 'text-muted-foreground',
    title: 'text-foreground',
    text: 'text-muted-foreground',
  },
};

const STATUS_COLOR_MAP: Record<string, { active: string }> = {
  gray: { active: 'bg-muted text-muted-foreground border-muted shadow-sm' },
  blue: { active: 'bg-info text-primary-foreground border-info shadow-sm' },
  green: { active: 'bg-success text-primary-foreground border-success shadow-sm' },
};

const RISK_LEVEL_COLOR_MAP: Record<string, { container: string; text: string; ring?: string }> = {
  critical: { container: 'bg-error-bg', text: 'text-error-text', ring: 'ring-error/20' },
  high: { container: 'bg-error-bg', text: 'text-error-text', ring: 'ring-error/20' },
  medium: { container: 'bg-warning-bg', text: 'text-warning-text', ring: 'ring-warning/20' },
  low: { container: 'bg-success-bg', text: 'text-success-text', ring: 'ring-success/20' },
  negligible: { container: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-muted-foreground/20' },
};

const getStrategyStyles = (color: string) => {
  return STRATEGY_COLOR_MAP[color] || STRATEGY_COLOR_MAP.gray;
};

const getStatusStyles = (color: string) => {
  return STATUS_COLOR_MAP[color] || STATUS_COLOR_MAP.gray;
};

const getRiskStyles = (level: string) => {
  return RISK_LEVEL_COLOR_MAP[level] || RISK_LEVEL_COLOR_MAP.medium;
};

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
 label: { fr: 'Réduire', en: 'Mitigate', de: 'Mindern' },
 description: {
 fr: 'Mettre en place des mesures pour réduire le risque',
 en: 'Implement measures to reduce the risk',
 de: 'Maßnahmen zur Risikominderung implementieren',
 },
 },
 {
 value: 'transfer' as const,
 icon: TrendingDown,
 color: 'purple',
 label: { fr: 'Transférer', en: 'Transfer', de: 'Übertragen' },
 description: {
 fr: 'Transférer le risque à un tiers (assurance, sous-traitance)',
 en: 'Transfer risk to a third party (insurance, outsourcing)',
 de: 'Risiko auf Dritte übertragen (Versicherung, Outsourcing)',
 },
 },
 {
 value: 'avoid' as const,
 icon: XCircle,
 color: 'orange',
 label: { fr: 'Éviter', en: 'Avoid', de: 'Vermeiden' },
 description: {
 fr: 'Éviter l\'activité génératrice de risque',
 en: 'Avoid the risk-generating activity',
 de: 'Die risikoverursachende Aktivität vermeiden',
 },
 },
 {
 value: 'accept' as const,
 icon: CheckCircle,
 color: 'green',
 label: { fr: 'Accepter', en: 'Accept', de: 'Akzeptieren' },
 description: {
 fr: 'Accepter le risque en connaissance de cause',
 en: 'Accept the risk with full knowledge',
 de: 'Das Risiko wissentlich akzeptieren',
 },
 },
];

const TREATMENT_STATUS_OPTIONS = [
 {
 value: 'planned' as const,
 label: { fr: 'Planifié', en: 'Planned', de: 'Geplant' },
 color: 'gray',
 },
 {
 value: 'in_progress' as const,
 label: { fr: 'En cours', en: 'In progress', de: 'In Bearbeitung' },
 color: 'blue',
 },
 {
 value: 'completed' as const,
 label: { fr: 'Terminé', en: 'Completed', de: 'Abgeschlossen' },
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
 const { t, locale } = useLocale();

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
 <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/15 dark:bg-primary flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
 <AlertTriangle className="w-5 h-5" />
 </div>
 <p className="text-3xl font-bold text-foreground mb-1 group-hover:text-primary dark:group-hover:text-primary/70 transition-colors">{operationalScenarios.length}</p>
 <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('ebios.workshop5.totalRisks')}</p>
 </PremiumCard>

 <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-border/40 rounded-3xl">
 <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-info-bg flex items-center justify-center text-info group-hover:scale-110 transition-transform">
 <ShieldCheck className="w-5 h-5" />
 </div>
 <p className="text-3xl font-bold text-info mb-1">{treatedCount}</p>
 <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('ebios.workshop5.treatedRisks')}</p>
 </PremiumCard>

 <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-border/40 rounded-3xl">
 <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-success-bg flex items-center justify-center text-success group-hover:scale-110 transition-transform">
 <CheckCircle className="w-5 h-5" />
 </div>
 <p className="text-3xl font-bold text-success mb-1">{acceptedCount}</p>
 <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('ebios.workshop5.acceptedRisks')}</p>
 </PremiumCard>

 <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-border/40 rounded-3xl">
 <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
 <BarChart3 className="w-5 h-5" />
 </div>
 <p className="text-3xl font-bold text-violet-600 dark:text-violet-400 mb-1">{averageEffectiveness}%</p>
 <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('ebios.workshop5.avgEffectiveness')}</p>
 </PremiumCard>
 </div>

 {/* Treatment Overview Progress */}
 <PremiumCard glass className="animate-fade-in-up delay-100 border-border/40 rounded-3xl">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-bold text-foreground flex items-center gap-2">
 <div className="p-1.5 rounded-lg bg-info-bg text-info">
 <FileCheck className="w-4 h-4" />
 </div>
 {t('ebios.workshop5.treatmentProgress')}
 </h3>
 <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
 {treatedCount}/{operationalScenarios.length} {t('ebios.workshop5.scenarios')}
 </span>
 </div>

 <div className="w-full bg-muted/50 rounded-full h-4 overflow-hidden border border-border/40 p-0.5">
 <div
 className="bg-gradient-primary h-full rounded-full transition-all duration-700 ease-out shadow-sm relative group"
 style={{ width: `${operationalScenarios.length > 0 ? (treatedCount / operationalScenarios.length) * 100 : 0}%` }}
 >
 <div className="absolute inset-0 bg-white/20 group-hover:bg-white/30 transition-colors animate-pulse-slow"></div>
 </div>
 </div>

 <div className="mt-6">
 <div className="flex items-center gap-2 mb-3">
 <div className="h-px flex-1 bg-muted"></div>
 <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('ebios.workshop5.strategyDistribution')}</span>
 <div className="h-px flex-1 bg-muted"></div>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {TREATMENT_STRATEGIES.map((strategy) => {
 const count = data.treatmentPlan.filter(tp => tp.strategy === strategy.value).length;
const strategyStyles = getStrategyStyles(strategy.color);
 return (
 <div
  key={strategy.value || 'unknown'}
  className={cn(
  "flex flex-col items-center p-3 rounded-3xl border transition-all duration-300 hover:shadow-md",
  strategyStyles.container
  )}
 >
  <span className={cn("text-2xl font-bold mb-1", strategyStyles.text)}>
  {count}
  </span>
  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{strategy.label[locale]}</span>
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
 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
 <AlertTriangle className="w-8 h-8 text-muted-foreground" />
 </div>
 <h4 className="text-lg font-medium text-foreground mb-2">
 {t('ebios.workshop5.noOperationalScenarios')}
 </h4>
 <p className="text-muted-foreground">{t('ebios.workshop5.completeWorkshop4First')}</p>
 </div>
 </PremiumCard>
 ) : (
 <div className="space-y-4">
 <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border/40 animate-fade-in-up delay-200">
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
 const initialRiskStyles = getRiskStyles(initialRiskLevel);

 const residualRiskLevel = residualRisk
 ? getRiskLevel(
  Math.ceil(residualRisk.residualRiskLevel / opScenario.likelihood),
  opScenario.likelihood
 )
 : initialRiskLevel;
 const residualRiskStyles = getRiskStyles(residualRiskLevel);

 return (
 <div key={opScenario.id || 'unknown'} className={`animate-fade-in-up delay-${(index + 3) * 100}`}>
  <PremiumCard glass className={cn(
  "overflow-hidden transition-all duration-300 hover:shadow-lg border-border/40 rounded-3xl",
  isExpanded ? "ring-1 ring-primary/60" : ""
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
  className="flex items-center justify-between cursor-pointer hover:bg-muted/30/50/50 -m-6 p-6 transition-colors"
  role="button"
  aria-label={`${t('ebios.scenario', { defaultValue: 'Scénario' })}: ${opScenario.name}`}
  tabIndex={0}
  >
  <div className="flex items-center gap-5">
  {/* Risk Badge Transition */}
  <div className="flex items-center gap-3">
  <div className={cn(
  "flex flex-col items-center justify-center w-14 h-14 rounded-3xl shadow-sm border transition-all",
  initialRiskStyles.container,
  "border-border",
  initialRiskStyles.text
  )}>
  <span className="text-xs font-bold uppercase tracking-wider opacity-70">Initial</span>
  <span className="text-xl font-bold leading-none">R{opScenario.riskLevel}</span>
  </div>

  {residualRisk && (
  <>
  <div className="text-muted-foreground">
  <TrendingDown className="w-5 h-5 -rotate-90" />
  </div>
  <div className={cn(
  "flex flex-col items-center justify-center w-14 h-14 rounded-3xl shadow-sm border transition-all",
  residualRiskStyles.container,
  "border-border",
  residualRiskStyles.text
  )}>
  <span className="text-xs font-bold uppercase tracking-wider opacity-70">Resid.</span>
  <span className="text-xl font-bold leading-none">R{residualRisk.residualRiskLevel}</span>
  </div>
  </>
  )}
  </div>

  <div>
  <h4 className={cn(
  "text-lg font-bold transition-colors",
  isExpanded ? "text-primary" : "text-foreground"
  )}>
  {opScenario.name}
  </h4>
  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
  <span className="font-medium text-foreground text-muted-foreground">
  {strategicScenario?.name}
  </span>
  <span className="w-1 h-1 rounded-full bg-muted" />
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
  getStrategyStyles(TREATMENT_STRATEGIES.find(s => s.value === treatment.strategy)?.color || 'gray').badge,
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
  <span className="px-3 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-bold uppercase tracking-wide border border-border/40">
  {t('ebios.workshop5.notTreated')}
  </span>
  )}

  <div className={cn(
  "p-2 rounded-full transition-all duration-300",
  isExpanded
  ? "bg-primary/15 dark:bg-primary text-primary rotate-180"
  : "bg-muted text-muted-foreground group-hover:bg-muted"
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
  <h5 className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-wider mb-4">
  <ShieldCheck className="w-4 h-4 text-info" />
  {t('ebios.workshop5.treatmentStrategy')}
  </h5>

  {!treatment ? (
  <button
   onClick={() => handleCreateTreatment(opScenario.id)}
   disabled={readOnly}
   className="w-full py-8 rounded-3xl border-2 border-dashed border-border/40 hover:border-primary/60 hover:bg-primary/15 dark:hover:bg-primary/10 transition-all group/add flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary"
  >
   <div className="p-3 rounded-full bg-muted group-hover/add:bg-primary/15 dark:group-hover/add:bg-primary transition-colors">
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
  const cardStyles = getStrategyStyles(strategy.color);
   return (
   <button
   key={strategy.value || 'unknown'}
   onClick={() => !readOnly && handleUpdateTreatment(opScenario.id, { strategy: strategy.value })}
   disabled={readOnly}
   className={cn(
   "relative p-4 rounded-3xl border-2 transition-all text-left overflow-hidden group/card",
   isSelected
   ? cardStyles.containerSelected
   : "border-border/40 bg-muted/50 hover:bg-muted/30/50"
   )}
   >
   {isSelected && (
   <div className={cn("absolute top-0 right-0 p-1 rounded-bl-lg", cardStyles.badgeCorner)}>
   <CheckCircle className="w-3.5 h-3.5" />
   </div>
   )}
   <StrategyIcon className={cn(
   "w-6 h-6 mb-2 transition-transform group-hover/card:scale-110",
   isSelected
   ? cardStyles.icon
   : "text-muted-foreground group-hover/card:text-muted-foreground dark:group-hover/card:text-muted-foreground"
   )} />
   <p className={cn(
   "font-bold text-sm mb-0.5",
   isSelected
   ? cardStyles.title
   : "text-foreground"
   )}>
   {strategy.label[locale]}
   </p>
   <p className="text-xs leading-tight text-muted-foreground line-clamp-2">
   {strategy.description[locale]}
   </p>
   </button>
   );
   })}
   </div>

   {/* Strategy Details Form */}
   <div className="bg-muted/30 rounded-2xl p-5 border border-border/40 space-y-4">
   {/* Justification */}
   <div>
   <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
   {t('ebios.workshop5.strategyJustification')}
   </label>
   {!readOnly ? (
   <textarea
   value={treatment.strategyJustification || ''}
   onChange={(e) => handleUpdateTreatment(opScenario.id, { strategyJustification: e.target.value })}
   placeholder={t('ebios.workshop5.justificationPlaceholder')}
   rows={2}
   className="w-full px-4 py-2.5 rounded-lg border border-border/40 bg-card focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all text-sm resize-none"
   />
   ) : (
   <p className="text-sm text-muted-foreground bg-white/50 p-3 rounded-2xl border border-border/40 italic">
   {treatment.strategyJustification || '-'}
   </p>
   )}
   </div>

   {/* Implementation Details */}
   {(treatment.strategy === 'mitigate' || treatment.strategy === 'transfer') && (
   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
   <div>
   <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
   <UserCircle className="w-3.5 h-3.5" />
   {t('ebios.workshop5.responsible')}
   </label>
   {!readOnly ? (
   <input
   type="text"
   value={treatment.responsibleId || ''}
   onChange={(e) => handleUpdateTreatment(opScenario.id, { responsibleId: e.target.value })}
   placeholder={t('ebios.workshop5.responsiblePlaceholder')}
   className="w-full px-4 py-2.5 rounded-lg border border-border/40 bg-card focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all text-sm"
   />
   ) : (
   <p className="text-sm font-medium text-foreground text-muted-foreground">
   {treatment.responsibleId || '-'}
   </p>
   )}
   </div>
   <div>
   <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
   <Calendar className="w-3.5 h-3.5" />
   {t('ebios.workshop5.deadline')}
   </label>
   {!readOnly ? (
   <input
   type="date"
   value={treatment.deadline || ''}
   onChange={(e) => handleUpdateTreatment(opScenario.id, { deadline: e.target.value })}
   className="w-full px-4 py-2.5 rounded-lg border border-border/40 bg-card focus-visible:ring-2 focus-visible:ring-primary focus:border-primary transition-all text-sm"
   />
   ) : (
   <p className="text-sm font-medium text-foreground text-muted-foreground">
   {treatment.deadline || '-'}
   </p>
   )}
   </div>
   </div>
   )}

   {/* Controls Selection */}
   {(treatment.strategy === 'mitigate' || treatment.strategy === 'transfer') && (
   <div className="mt-4 pt-4 border-t border-border/40/50">
   <div className="flex items-center justify-between mb-3">
   <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
   <Shield className="w-3.5 h-3.5 text-info" />
   {t('ebios.workshop5.selectedControls')}
   </label>
   {!readOnly && (
   <button
   onClick={() => setShowControlSelector(opScenario.id)}
   className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 dark:bg-primary text-primary text-xs font-bold hover:bg-primary/20 dark:hover:bg-primary transition-colors"
   >
   <Plus className="w-3.5 h-3.5" />
   {t('ebios.workshop5.selectControls')}
   </button>
   )}
   </div>

   {/* Suggested controls hint */}
   {getSuggestedControls(opScenario.id).length > 0 && treatment.selectedControlIds.length === 0 && (
   <div className="flex items-center gap-2 mb-3 p-2.5 bg-gradient-to-r from-violet-50 to-primary/15 dark:from-violet-900/20 dark:to-primary/20 rounded-lg border border-violet-100 dark:border-violet-800/30">
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
   className="flex items-center justify-between p-3 bg-card rounded-3xl border border-border/40 shadow-sm"
   >
   <div className="flex items-center gap-3">
    <div className="px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-mono font-bold">
    {code}
    </div>
    <span className="text-sm font-medium text-foreground line-clamp-1">{getControlName(code)}</span>
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
   <div className="text-center py-6 border-2 border-dashed border-border/40 rounded-3xl bg-muted/30/50">
   <p className="text-sm text-muted-foreground italic">
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
    ? getStatusStyles(status.color).active
    : "bg-card text-muted-foreground border-border/40 hover:bg-muted/30"
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
  <h5 className="flex items-center gap-2 text-sm font-bold text-foreground uppercase tracking-wider mb-4">
   <BarChart3 className="w-4 h-4 text-violet-500" />
   {t('ebios.workshop5.residualRiskAssessment')}
  </h5>

  <div className="flex-1 p-6 bg-muted/50 rounded-3xl border border-border/40 flex flex-col gap-6">
   {/* Risk Comparison Visualization */}
   <div className="flex items-center justify-between bg-card p-4 rounded-3xl border border-border/40 shadow-sm">
   <div className="text-center">
   <span className="caption block mb-1">{t('ebios.workshop5.initialRisk')}</span>
   <span className={cn(
   "inline-block px-3 py-1 rounded-lg text-lg font-bold",
   initialRiskStyles.container,
   initialRiskStyles.text
   )}>
   R{opScenario.riskLevel}
   </span>
   </div>

   <div className="flex flex-col items-center px-4">
   <TrendingDown className="w-6 h-6 text-muted-foreground animate-bounce" />
   <span className="text-xs font-bold text-success-text">-{Math.round((residualRisk?.controlEffectiveness || 0))}%</span>
   </div>

   <div className="text-center">
   <span className="caption block mb-1">{t('ebios.workshop5.residualRisk')}</span>
   <span className={cn(
   "inline-block px-3 py-1 rounded-lg text-lg font-bold transition-all duration-500",
   residualRisk
   ? `${residualRiskStyles.container} ${residualRiskStyles.text} ring-2 ${residualRiskStyles.ring || ''}`
   : "bg-muted text-muted-foreground"
   )}>
   R{residualRisk?.residualRiskLevel || opScenario.riskLevel}
   </span>
   </div>
   </div>

   {/* Effectiveness Control */}
   <div className="flex-1 flex flex-col justify-center">
   <div className="flex items-end justify-between mb-4">
   <label className="text-sm font-medium text-foreground text-muted-foreground">
   {t('ebios.workshop5.controlEffectiveness')}
   </label>
   <span className="text-2xl font-bold text-primary font-mono">
   {residualRisk?.controlEffectiveness || 0}<span className="text-sm text-muted-foreground">%</span>
   </span>
   </div>

   <div className="relative h-10 flex items-center">
   {/* Track background */}
   <div className="absolute w-full h-3 bg-muted rounded-full overflow-hidden">
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
   className="absolute w-full h-full opacity-0 cursor-pointer z-decorator"
   />
   ) : null}

   {/* Thumb (Visual Only if readOnly) */}
   <div
   className="absolute h-6 w-6 bg-card rounded-full shadow-md border-2 border-primary pointer-events-none transition-all duration-300 flex items-center justify-center transform -translate-x-1/2"
   style={{ left: `${residualRisk?.controlEffectiveness || 0}%` }}
   >
   <div className="w-2 h-2 bg-primary rounded-full"></div>
   </div>
   </div>

   <div className="flex justify-between caption mt-2">
   <span>{t('ebios.ineffective', { defaultValue: 'Ineffective' })}</span>
   <span>{t('ebios.effective', { defaultValue: 'Effective' })}</span>
   </div>
   </div>

   {/* Acceptance Status */}
   <div className="pt-6 border-t border-border/40">
   <h6 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
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
 const { t } = useLocale();
 const [justification, setJustification] = useState('');

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-modal flex items-center justify-center">
 <button
 className="absolute inset-0 w-full h-full bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] border-0 cursor-pointer"
 onClick={onClose}
 aria-label={t('common.closeDialog', { defaultValue: 'Fermer la boîte de dialogue' })}
 />
 <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
 <h3 className="text-lg font-semibold text-foreground mb-4">
 {t('ebios.workshop5.acceptRiskTitle')}
 </h3>

 <div className="space-y-4">
 <p className="text-sm text-muted-foreground">
 {t('ebios.workshop5.acceptRiskDescription')}
 </p>

 <div className="p-4 bg-muted/50 rounded-3xl">
 <p className="text-sm font-medium text-foreground">{scenarioName}</p>
 <p className="text-sm text-muted-foreground mt-1">
 {t('ebios.workshop5.residualRisk')}: <span className="font-bold">R{residualRisk}</span>
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 {t('ebios.workshop5.acceptanceJustification')} *
 </label>
 <textarea
 value={justification}
 onChange={(e) => setJustification(e.target.value)}
 placeholder={t('ebios.workshop5.acceptanceJustificationPlaceholder')}
 rows={3}
 className="w-full px-3 py-2 rounded-lg border border-border/40 bg-card text-sm resize-none"
 />
 </div>
 </div>

 <div className="flex justify-end gap-3 mt-6">
 <button
 onClick={onClose}
 className="px-4 py-2 rounded-lg border border-border/40 text-foreground text-sm font-medium hover:bg-muted"
 >
 {t('common.cancel')}
 </button>
 <button
 onClick={() => onAccept(justification)}
 disabled={!justification.trim()}
 className="px-4 py-2 rounded-lg bg-success hover:bg-success/90 disabled:bg-muted disabled:cursor-not-allowed text-success-foreground text-sm font-medium transition-colors"
 >
 {t('ebios.workshop5.confirmAcceptance')}
 </button>
 </div>
 </div>
 </div>
 );
};

export default Workshop5Content;
