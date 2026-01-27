/**
 * Workshop 4: Scénarios Opérationnels
 * Main content component for EBIOS RM Workshop 4
 *
 * Sections:
 * 1. Operational Scenarios derived from Strategic Scenarios
 * 2. Attack Sequences with MITRE ATT&CK references
 * 3. Likelihood Assessment
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Cpu,
  List,
  Plus,
  ChevronDown,
  Trash2,
  AlertTriangle,
  Link2,
  Shield,
  Edit2,
  FileCheck,
  Loader2,
  ExternalLink,
  Info,
} from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { PremiumCard } from '../../ui/PremiumCard';
import type {
  Workshop4Data,
  Workshop3Data,
  OperationalScenario,
  AttackStep,
  MitreReference,
} from '../../../types/ebios';
import { GRAVITY_SCALE, LIKELIHOOD_SCALE, RISK_MATRIX_CONFIG } from '../../../data/ebiosLibrary';
import { v4 as uuidv4 } from 'uuid';
import { OperationalScenarioForm } from '../workshop4/OperationalScenarioForm';
import { MitreSearchModal } from '../workshop4/MitreSearchModal';

interface Workshop4ContentProps {
  data: Workshop4Data;
  workshop3Data: Workshop3Data;
  onDataChange: (data: Partial<Workshop4Data>) => void;
  readOnly?: boolean;
  // EBIOS Analysis context for risk creation
  analysisId?: string;
  analysisName?: string;
  onCreateRisk?: (scenarioId: string, riskData: CreateRiskFromEbiosData) => Promise<string | null>;
}

// Data structure for creating a risk from EBIOS
export interface CreateRiskFromEbiosData {
  threat: string;
  scenario: string;
  probability: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  mitreTechniques: Array<{ id: string; name: string; description: string }>;
  ebiosReference: {
    analysisId: string;
    analysisName: string;
    scenarioId: string;
    scenarioCode?: string;
    scenarioType: 'operational';
  };
}

export const Workshop4Content: React.FC<Workshop4ContentProps> = ({
  data,
  workshop3Data,
  onDataChange,
  readOnly = false,
  analysisId,
  analysisName,
  onCreateRisk,
}) => {
  const { t } = useTranslation();

  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [editingScenario, setEditingScenario] = useState<OperationalScenario | null>(null);
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [showMitreModal, setShowMitreModal] = useState(false);
  const [mitreTargetStep, setMitreTargetStep] = useState<{ scenarioId: string; stepId: string } | null>(null);
  const [creatingRiskForScenario, setCreatingRiskForScenario] = useState<string | null>(null);

  // Get strategic scenarios from Workshop 3
  const strategicScenarios = workshop3Data.strategicScenarios;

  // Risk level calculation
  const getRiskLevel = (gravity: number, likelihood: number) => {
    return RISK_MATRIX_CONFIG.getRiskLevel(gravity, likelihood);
  };

  const getRiskColor = (level: string) => {
    return RISK_MATRIX_CONFIG.levels[level as keyof typeof RISK_MATRIX_CONFIG.levels]?.color || 'gray';
  };

  // Handlers
  const handleAddScenario = useCallback((strategicScenarioId: string) => {
    const strategicScenario = strategicScenarios.find(s => s.id === strategicScenarioId);
    if (!strategicScenario) return;

    // Pre-fill with strategic scenario info but don't set ID (will be created on save)
    const newScenario: OperationalScenario = {
      id: '', // Empty = new scenario
      name: `${strategicScenario.name} - Opérationnel`,
      description: '',
      strategicScenarioId,
      attackSequence: [],
      likelihood: 2,
      likelihoodJustification: '',
      riskLevel: strategicScenario.gravity * 2,
    };
    setEditingScenario(newScenario);
    setShowScenarioForm(true);
  }, [strategicScenarios]);

  const handleDeleteScenario = useCallback((id: string) => {
    const operationalScenarios = data.operationalScenarios.filter(s => s.id !== id);
    onDataChange({ operationalScenarios });
  }, [data.operationalScenarios, onDataChange]);

  const handleUpdateLikelihood = useCallback((scenarioId: string, likelihood: 1 | 2 | 3 | 4) => {
    const scenario = data.operationalScenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    const strategicScenario = strategicScenarios.find(s => s.id === scenario.strategicScenarioId);
    const gravity = strategicScenario?.gravity || 2;
    const riskLevel = gravity * likelihood;

    const operationalScenarios = data.operationalScenarios.map(s =>
      s.id === scenarioId ? { ...s, likelihood, riskLevel } : s
    );
    onDataChange({ operationalScenarios });
  }, [data.operationalScenarios, strategicScenarios, onDataChange]);

  const handleAddAttackStep = useCallback((scenarioId: string) => {
    const scenario = data.operationalScenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    const newStep: AttackStep = {
      id: uuidv4(),
      order: scenario.attackSequence.length + 1,
      description: '',
    };

    const operationalScenarios = data.operationalScenarios.map(s =>
      s.id === scenarioId
        ? { ...s, attackSequence: [...s.attackSequence, newStep] }
        : s
    );
    onDataChange({ operationalScenarios });
  }, [data.operationalScenarios, onDataChange]);

  const handleUpdateAttackStep = useCallback((scenarioId: string, stepId: string, updates: Partial<AttackStep>) => {
    const operationalScenarios = data.operationalScenarios.map(s =>
      s.id === scenarioId
        ? {
          ...s,
          attackSequence: s.attackSequence.map(step =>
            step.id === stepId ? { ...step, ...updates } : step
          ),
        }
        : s
    );
    onDataChange({ operationalScenarios });
  }, [data.operationalScenarios, onDataChange]);

  const handleDeleteAttackStep = useCallback((scenarioId: string, stepId: string) => {
    const operationalScenarios = data.operationalScenarios.map(s =>
      s.id === scenarioId
        ? {
          ...s,
          attackSequence: s.attackSequence
            .filter(step => step.id !== stepId)
            .map((step, idx) => ({ ...step, order: idx + 1 })),
        }
        : s
    );
    onDataChange({ operationalScenarios });
  }, [data.operationalScenarios, onDataChange]);

  // Handle saving scenario from form
  const handleSaveScenario = useCallback((scenarioData: Partial<OperationalScenario>) => {
    if (editingScenario?.id) {
      // Update existing scenario
      const operationalScenarios = data.operationalScenarios.map(s =>
        s.id === editingScenario.id ? { ...s, ...scenarioData } : s
      );
      onDataChange({ operationalScenarios });
    } else {
      // Create new scenario
      const strategicScenario = strategicScenarios.find(s => s.id === scenarioData.strategicScenarioId);
      const newScenario: OperationalScenario = {
        id: uuidv4(),
        name: scenarioData.name || '',
        description: scenarioData.description || '',
        strategicScenarioId: scenarioData.strategicScenarioId || '',
        attackSequence: [],
        likelihood: 2,
        likelihoodJustification: '',
        riskLevel: (strategicScenario?.gravity || 2) * 2,
        ...scenarioData,
      };
      onDataChange({ operationalScenarios: [...data.operationalScenarios, newScenario] });
    }
    setShowScenarioForm(false);
    setEditingScenario(null);
  }, [data.operationalScenarios, editingScenario, strategicScenarios, onDataChange]);

  // Handle editing an existing scenario
  const handleEditScenario = useCallback((scenario: OperationalScenario) => {
    setEditingScenario(scenario);
    setShowScenarioForm(true);
  }, []);

  // Handle opening MITRE modal for a step
  const handleOpenMitreModal = useCallback((scenarioId: string, stepId: string) => {
    setMitreTargetStep({ scenarioId, stepId });
    setShowMitreModal(true);
  }, []);

  // Handle selecting a MITRE technique
  const handleSelectMitre = useCallback((reference: MitreReference) => {
    if (!mitreTargetStep) return;

    const operationalScenarios = data.operationalScenarios.map(s =>
      s.id === mitreTargetStep.scenarioId
        ? {
          ...s,
          attackSequence: s.attackSequence.map(step =>
            step.id === mitreTargetStep.stepId
              ? { ...step, mitreReference: reference }
              : step
          ),
        }
        : s
    );
    onDataChange({ operationalScenarios });
    setShowMitreModal(false);
    setMitreTargetStep(null);
  }, [data.operationalScenarios, mitreTargetStep, onDataChange]);

  // Handle creating a risk from an operational scenario (Story 18.5)
  const handleCreateRiskFromScenario = useCallback(async (opScenario: OperationalScenario) => {
    if (!onCreateRisk || !analysisId || !analysisName) return;

    const strategicScenario = strategicScenarios.find(s => s.id === opScenario.strategicScenarioId);
    if (!strategicScenario) return;

    setCreatingRiskForScenario(opScenario.id);

    try {
      // Map EBIOS 1-4 scale to Risk 1-5 scale
      const mapScale = (value: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 | 5 => Math.min(5, value + 1) as 1 | 2 | 3 | 4 | 5;

      // Extract MITRE techniques from attack steps
      const mitreTechniques = opScenario.attackSequence
        .filter(step => step.mitreReference)
        .map(step => ({
          id: step.mitreReference!.techniqueId,
          name: step.mitreReference!.techniqueName,
          description: `${step.mitreReference!.tacticName} - ${step.description}`,
        }));

      // Build scenario description
      const attackStepsDescription = opScenario.attackSequence
        .map((step, idx) => `${idx + 1}. ${step.description}${step.mitreReference ? ` (${step.mitreReference.techniqueId})` : ''}`)
        .join('\n');

      const riskData: CreateRiskFromEbiosData = {
        threat: `[EBIOS] ${opScenario.name}`,
        scenario: `**Scénario stratégique:** ${strategicScenario.name}\n\n**Mode opératoire:**\n${opScenario.description || 'Non spécifié'}\n\n**Séquence d'attaque:**\n${attackStepsDescription || 'Non définie'}`,
        probability: mapScale(opScenario.likelihood),
        impact: mapScale(strategicScenario.gravity),
        mitreTechniques,
        ebiosReference: {
          analysisId,
          analysisName,
          scenarioId: opScenario.id,
          scenarioCode: opScenario.code,
          scenarioType: 'operational',
        },
      };

      const riskId = await onCreateRisk(opScenario.id, riskData);

      if (riskId) {
        // Link the scenario to the created risk
        const operationalScenarios = data.operationalScenarios.map(s =>
          s.id === opScenario.id ? { ...s, linkedRiskId: riskId } : s
        );
        onDataChange({ operationalScenarios });
      }
    } finally {
      setCreatingRiskForScenario(null);
    }
  }, [analysisId, analysisName, data.operationalScenarios, onCreateRisk, onDataChange, strategicScenarios]);

  // Stats
  const totalScenarios = data.operationalScenarios.length;
  const criticalScenarios = data.operationalScenarios.filter(
    s => getRiskLevel(strategicScenarios.find(ss => ss.id === s.strategicScenarioId)?.gravity || 2, s.likelihood) === 'critical'
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
        <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-brand-200 dark:border-brand-700">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform">
            <Cpu className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{totalScenarios}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{t('ebios.workshop4.totalScenarios')}</p>
        </PremiumCard>

        <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-red-200 dark:border-red-800">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-red-100 dark:bg-amber-900/30 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">{criticalScenarios}</p>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{t('ebios.workshop4.criticalScenarios')}</p>
        </PremiumCard>

        <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-orange-200/50 dark:border-orange-800/50">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-100 dark:bg-amber-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
            <List className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
            {data.operationalScenarios.reduce((sum, s) => sum + s.attackSequence.length, 0)}
          </p>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{t('ebios.workshop4.totalSteps')}</p>
        </PremiumCard>

        <PremiumCard glass className="text-center group hover:scale-[1.02] transition-transform duration-300 border-violet-200/50 dark:border-violet-800/50">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
            <Shield className="w-5 h-5" />
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
            {strategicScenarios.length}
          </p>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">{t('ebios.workshop4.sourceScenarios')}</p>
        </PremiumCard>
      </div>

      {/* Strategic Scenarios List */}
      <div className="space-y-6">
        {strategicScenarios.length === 0 ? (
          <PremiumCard glass className="animate-fade-in-up delay-100">
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-slate-300 dark:text-slate-300" />
              </div>
              <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {t('ebios.workshop4.noStrategicScenarios')}
              </h4>
              <p className="text-slate-500 dark:text-slate-400">{t('ebios.workshop4.completeWorkshop3First')}</p>
            </div>
          </PremiumCard>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-info-bg border border-info-border animate-fade-in-up delay-100">
              <Info className="w-5 h-5 text-info flex-shrink-0" />
              <p className="text-sm text-info-text">
                {t('ebios.workshop4.helpText', 'Déclinaison des scénarios stratégiques en scénarios opérationnels. Pour chaque scénario, définissez la séquence d\'attaque technique (mode opératoire) et évaluez la vraisemblance.')}
              </p>
            </div>

            {strategicScenarios.map((strategicScenario, index) => {
              const relatedOps = data.operationalScenarios.filter(
                op => op.strategicScenarioId === strategicScenario.id
              );
              const gravityScale = GRAVITY_SCALE.find(g => g.level === strategicScenario.gravity);

              return (
                <div key={strategicScenario.id} className={`animate-fade-in-up delay-${(index + 2) * 100}`}>
                  <PremiumCard glass className="overflow-visible hover:shadow-lg transition-shadow duration-300">
                    {/* Strategic Scenario Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-3 rounded-2xl shadow-sm",
                          `bg-${gravityScale?.color || 'gray'}-100 dark:bg-${gravityScale?.color || 'gray'}-900/30`,
                          `text-${gravityScale?.color || 'gray'}-600 dark:text-${gravityScale?.color || 'gray'}-400`
                        )}>
                          <Cpu className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                            {strategicScenario.name}
                          </h3>
                          <div className="flex items-center gap-3 text-sm">
                            <span className={cn(
                              "font-bold",
                              `text-${gravityScale?.color || 'gray'}-600 dark:text-${gravityScale?.color || 'gray'}-400`
                            )}>
                              Gravité G{strategicScenario.gravity}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                            <span className="text-slate-500 dark:text-slate-400">
                              {relatedOps.length} {t('ebios.workshop4.operationalScenarios')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!readOnly && (
                        <button
                          onClick={() => handleAddScenario(strategicScenario.id)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium shadow-lg shadow-brand hover:shadow-brand transition-all transform hover:-translate-y-0.5"
                        >
                          <Plus className="w-4 h-4" />
                          {t('ebios.workshop4.addOperational')}
                        </button>
                      )}
                    </div>

                    {/* Operational Scenarios List */}
                    <div className="mt-6 space-y-4">
                      {relatedOps.length === 0 ? (
                        <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                          <p className="text-slate-500 font-medium mb-1">
                            {t('ebios.workshop4.noOperationalYet')}
                          </p>
                          {!readOnly && (
                            <button
                              onClick={() => handleAddScenario(strategicScenario.id)}
                              className="text-sm text-info hover:text-brand-600 font-medium hover:underline"
                            >
                              {t('ebios.workshop4.clickToAdd', 'Cliquez pour commencer')}
                            </button>
                          )}
                        </div>
                      ) : (
                        relatedOps.map((opScenario) => {
                          const isExpanded = expandedScenario === opScenario.id;
                          const riskLevel = getRiskLevel(strategicScenario.gravity, opScenario.likelihood);
                          const riskColor = getRiskColor(riskLevel);
                          const likelihoodScale = LIKELIHOOD_SCALE.find(l => l.level === opScenario.likelihood);

                          return (
                            <div
                              key={opScenario.id}
                              className={cn(
                                "rounded-2xl border transition-all duration-300 overflow-hidden",
                                isExpanded
                                  ? "bg-white/60 dark:bg-slate-800/60 border-brand-200 dark:border-brand-800 shadow-md ring-1 ring-brand-200"
                                  : "bg-white/40 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md"
                              )}
                            >
                              {/* Scenario Item Header */}
                              <div
                                onClick={() => setExpandedScenario(isExpanded ? null : opScenario.id)}
                                className="flex items-center justify-between p-5 cursor-pointer group"
                              >
                                <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "flex flex-col items-center justify-center w-12 h-12 rounded-xl shadow-sm border",
                                    `bg-${riskColor}-50 dark:bg-${riskColor}-900/20`,
                                    `border-${riskColor}-200 dark:border-${riskColor}-800`,
                                    `text-${riskColor}-700 dark:text-${riskColor}-400`
                                  )}>
                                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">Risk</span>
                                    <span className="text-lg font-bold leading-none">R{opScenario.riskLevel}</span>
                                  </div>

                                  <div>
                                    <h4 className={cn(
                                      "font-bold text-base transition-colors",
                                      isExpanded ? "text-brand-600 dark:text-brand-400" : "text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400"
                                    )}>
                                      {opScenario.name}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                                        <List className="w-3 h-3" />
                                        {opScenario.attackSequence.length} {t('ebios.workshop4.attackSteps')}
                                      </span>
                                      {opScenario.linkedRiskId && (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-success-bg text-success-text border border-success-border">
                                          <FileCheck className="w-3 h-3" />
                                          {t('ebios.workshop4.riskCreated')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-6">
                                  {/* Likelihood Selector (Compact) */}
                                  <div className="flex flex-col items-end mr-4">
                                    <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-300 tracking-wider mb-1">{t('ebios.workshop4.likelihood')}</span>
                                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                                      {!readOnly ? (
                                        LIKELIHOOD_SCALE.map((level) => (
                                          <button
                                            key={level.level}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateLikelihood(opScenario.id, level.level as 1 | 2 | 3 | 4);
                                            }}
                                            className={cn(
                                              "w-8 h-8 rounded-md text-xs font-bold transition-all relative z-10",
                                              opScenario.likelihood === level.level
                                                ? `bg-${level.color}-500 text-white shadow-sm scale-110`
                                                : "text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                            )}
                                            title={t(`ebios.likelihood.${level.level}`)}
                                          >
                                            {level.level}
                                          </button>
                                        ))
                                      ) : (
                                        <div className={cn(
                                          "px-3 py-1.5 rounded-md text-sm font-bold",
                                          `bg-${likelihoodScale?.color || 'gray'}-500 text-white`
                                        )}>
                                          V{opScenario.likelihood}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className={cn(
                                    "p-2 rounded-full transition-all duration-300",
                                    isExpanded
                                      ? "bg-brand-100 dark:bg-brand-900 text-brand-600 rotate-180"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                                  )}>
                                    <ChevronDown className="w-5 h-5" />
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Content - Attack Sequence */}
                              {isExpanded && (
                                <div className="px-5 pb-5 pt-0 animate-accordion-down">
                                  <div className="p-5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50">
                                    <div className="flex items-center justify-between mb-5">
                                      <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400">
                                          <List className="w-4 h-4" />
                                        </div>
                                        {t('ebios.workshop4.attackSequence')}
                                      </h4>
                                      {!readOnly && (
                                        <button
                                          onClick={() => handleAddAttackStep(opScenario.id)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-all shadow-sm"
                                        >
                                          <Plus className="w-4 h-4" />
                                          {t('ebios.workshop4.addStep')}
                                        </button>
                                      )}
                                    </div>

                                    <div className="space-y-0 relative pl-4">
                                      {/* Vertical Line */}
                                      <div className="absolute top-4 bottom-4 left-[27px] w-px bg-slate-200 dark:bg-slate-700"></div>

                                      {opScenario.attackSequence.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground italic bg-white dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                          {t('ebios.workshop4.noStepsYet')}
                                        </div>
                                      ) : (
                                        opScenario.attackSequence.map((step) => (
                                          <div key={step.id} className="relative flex items-start group/step">
                                            {/* Step Number Bubble */}
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center relative z-10 shadow-sm mt-2.5 mr-4 ring-4 ring-slate-50 dark:ring-slate-800/80">
                                              {step.order}
                                            </div>

                                            {/* Step Content */}
                                            <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-3 transition-all hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md">
                                              <div className="flex items-start gap-4">
                                                <div className="flex-1">
                                                  {!readOnly ? (
                                                    <textarea
                                                      value={step.description}
                                                      onChange={(e) => handleUpdateAttackStep(opScenario.id, step.id, { description: e.target.value })}
                                                      placeholder={t('ebios.workshop4.stepDescriptionPlaceholder')}
                                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus-visible:ring-2 focus-visible:ring-brand-300 focus:border-brand-500 transition-all text-sm resize-none min-h-[60px]"
                                                    />
                                                  ) : (
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                      {step.description}
                                                    </p>
                                                  )}

                                                  {/* MITRE Reference */}
                                                  {step.mitreReference ? (
                                                    <div className="flex items-center flex-wrap gap-2 mt-3">
                                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50 text-xs font-medium text-orange-700 dark:text-orange-400 group/mitre relative">
                                                        <Shield className="w-3 h-3" />
                                                        <span className="font-mono font-bold">{step.mitreReference.techniqueId}</span>
                                                        <span className="w-px h-3 bg-orange-200 dark:bg-orange-800"></span>
                                                        <span className="truncate max-w-[200px]">{step.mitreReference.techniqueName}</span>

                                                        {!readOnly && (
                                                          <button
                                                            onClick={() => handleOpenMitreModal(opScenario.id, step.id)}
                                                            className="ml-1.5 p-0.5 rounded hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors"
                                                            title={t('common.change')}
                                                          >
                                                            <Edit2 className="w-3 h-3" />
                                                          </button>
                                                        )}
                                                      </div>
                                                    </div>
                                                  ) : !readOnly && (
                                                    <button
                                                      onClick={() => handleOpenMitreModal(opScenario.id, step.id)}
                                                      className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-brand-600 transition-colors py-1 px-2 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-800 border border-transparent hover:border-brand-100 dark:hover:border-brand-800"
                                                    >
                                                      <Link2 className="w-3 h-3" />
                                                      {t('ebios.workshop4.addMitreRef')}
                                                    </button>
                                                  )}
                                                </div>

                                                {!readOnly && (
                                                  <button
                                                    onClick={() => handleDeleteAttackStep(opScenario.id, step.id)}
                                                    className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover/step:opacity-70"
                                                    title={t('common.delete')}
                                                  >
                                                    <Trash2 className="w-4 h-4" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-200/50 dark:border-slate-700/50">
                                      {/* Risk creation */}
                                      <div>
                                        {opScenario.linkedRiskId ? (
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              // Navigate or open risk
                                            }}
                                            className="group flex items-center gap-3 px-4 py-2 rounded-xl bg-success-bg border border-success-border text-success-text hover:shadow-md transition-all"
                                          >
                                            <div className="p-1 rounded-full bg-success-bg">
                                              <FileCheck className="w-4 h-4" />
                                            </div>
                                            <div className="text-left">
                                              <p className="text-xs font-bold uppercase tracking-wider opacity-70">{t('ebios.workshop4.riskCreated')}</p>
                                              <div className="flex items-center gap-1 font-bold text-sm">
                                                {t('ebios.workshop4.viewRisk')}
                                                <ExternalLink className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                              </div>
                                            </div>
                                          </button>
                                        ) : onCreateRisk && analysisId ? (
                                          <button
                                            onClick={() => handleCreateRiskFromScenario(opScenario)}
                                            disabled={creatingRiskForScenario === opScenario.id}
                                            className={cn(
                                              "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all shadow-sm hover:shadow-md active:scale-95 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-400 dark:disabled:border-slate-600",
                                              "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 dark:hover:bg-slate-800"
                                            )}
                                          >
                                            {creatingRiskForScenario === opScenario.id ? (
                                              <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {t('ebios.workshop4.creatingRisk')}
                                              </>
                                            ) : (
                                              <>
                                                <FileCheck className="w-4 h-4" />
                                                {t('ebios.workshop4.createRisk')}
                                              </>
                                            )}
                                          </button>
                                        ) : null}
                                      </div>

                                      {/* Edit/Delete Scenario */}
                                      {!readOnly && (
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleEditScenario(opScenario)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                            {t('common.edit')}
                                          </button>
                                          <button
                                            onClick={() => handleDeleteScenario(opScenario.id)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 transition-colors"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                            {t('common.delete')}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </PremiumCard>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Operational Scenario Form Modal */}
      <OperationalScenarioForm
        isOpen={showScenarioForm}
        onClose={() => {
          setShowScenarioForm(false);
          setEditingScenario(null);
        }}
        onSave={handleSaveScenario}
        scenario={editingScenario}
        strategicScenarios={strategicScenarios}
        existingScenarios={data.operationalScenarios}
      />

      {/* MITRE Search Modal */}
      <MitreSearchModal
        isOpen={showMitreModal}
        onClose={() => {
          setShowMitreModal(false);
          setMitreTargetStep(null);
        }}
        onSelect={handleSelectMitre}
        previousSteps={
          mitreTargetStep
            ? data.operationalScenarios.find(s => s.id === mitreTargetStep.scenarioId)?.attackSequence || []
            : []
        }
      />
    </div>
  );
};

export default Workshop4Content;
