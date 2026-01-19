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
  ChevronUp,
  Trash2,
  AlertTriangle,
  Link2,
  Shield,
  Edit2,
  FileCheck,
  Loader2,
  ExternalLink,
} from '../../ui/Icons';
import { cn } from '../../../utils/cn';
import { GlassCard } from '../../ui/GlassCard';
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalScenarios}</p>
          <p className="text-sm text-gray-500 mt-1">{t('ebios.workshop4.totalScenarios')}</p>
        </GlassCard>
        <GlassCard className="text-center">
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{criticalScenarios}</p>
          <p className="text-sm text-gray-500 mt-1">{t('ebios.workshop4.criticalScenarios')}</p>
        </GlassCard>
        <GlassCard className="text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {data.operationalScenarios.reduce((sum, s) => sum + s.attackSequence.length, 0)}
          </p>
          <p className="text-sm text-gray-500 mt-1">{t('ebios.workshop4.totalSteps')}</p>
        </GlassCard>
        <GlassCard className="text-center">
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {strategicScenarios.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">{t('ebios.workshop4.sourceScenarios')}</p>
        </GlassCard>
      </div>

      {/* Operational Scenarios by Strategic Scenario */}
      {strategicScenarios.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">{t('ebios.workshop4.noStrategicScenarios')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('ebios.workshop4.completeWorkshop3First')}</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {strategicScenarios.map((strategicScenario) => {
            const relatedOps = data.operationalScenarios.filter(
              op => op.strategicScenarioId === strategicScenario.id
            );
            const gravityScale = GRAVITY_SCALE.find(g => g.level === strategicScenario.gravity);

            return (
              <GlassCard key={strategicScenario.id}>
                {/* Strategic Scenario Header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-xl",
                      `bg-${gravityScale?.color || 'gray'}-100 dark:bg-${gravityScale?.color || 'gray'}-900/30`
                    )}>
                      <Cpu className={cn(
                        "w-5 h-5",
                        `text-${gravityScale?.color || 'gray'}-600 dark:text-${gravityScale?.color || 'gray'}-400`
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {strategicScenario.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {relatedOps.length} {t('ebios.workshop4.operationalScenarios')} · Gravité G{strategicScenario.gravity}
                      </p>
                    </div>
                  </div>

                  {!readOnly && (
                    <button
                      onClick={() => handleAddScenario(strategicScenario.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      {t('ebios.workshop4.addOperational')}
                    </button>
                  )}
                </div>

                {/* Operational Scenarios */}
                {relatedOps.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {t('ebios.workshop4.noOperationalYet')}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {relatedOps.map((opScenario) => {
                      const isExpanded = expandedScenario === opScenario.id;
                      const riskLevel = getRiskLevel(strategicScenario.gravity, opScenario.likelihood);
                      const riskColor = getRiskColor(riskLevel);
                      const likelihoodScale = LIKELIHOOD_SCALE.find(l => l.level === opScenario.likelihood);

                      return (
                        <div
                          key={opScenario.id}
                          className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                        >
                          {/* Scenario Header */}
                          <div
                            onClick={() => setExpandedScenario(isExpanded ? null : opScenario.id)}
                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <div className="flex items-center gap-3">
                              <span className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-bold",
                                `bg-${riskColor}-100 dark:bg-${riskColor}-900/30`,
                                `text-${riskColor}-700 dark:text-${riskColor}-400`
                              )}>
                                R{opScenario.riskLevel}
                              </span>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {opScenario.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {opScenario.attackSequence.length} {t('ebios.workshop4.attackSteps')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {/* Likelihood Selector */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{t('ebios.workshop4.likelihood')}:</span>
                                {!readOnly ? (
                                  <div className="flex gap-1">
                                    {LIKELIHOOD_SCALE.map((level) => (
                                      <button
                                        key={level.level}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateLikelihood(opScenario.id, level.level as 1 | 2 | 3 | 4);
                                        }}
                                        className={cn(
                                          "w-7 h-7 rounded text-xs font-bold transition-colors",
                                          opScenario.likelihood === level.level
                                            ? `bg-${level.color}-500 text-white`
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200"
                                        )}
                                      >
                                        {level.level}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <span className={cn(
                                    "px-2 py-1 rounded text-xs font-medium",
                                    `bg-${likelihoodScale?.color || 'gray'}-100`,
                                    `text-${likelihoodScale?.color || 'gray'}-700`
                                  )}>
                                    V{opScenario.likelihood}
                                  </span>
                                )}
                              </div>

                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </div>

                          {/* Expanded Content - Attack Sequence */}
                          {isExpanded && (
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                  <List className="w-4 h-4" />
                                  {t('ebios.workshop4.attackSequence')}
                                </h4>
                                {!readOnly && (
                                  <button
                                    onClick={() => handleAddAttackStep(opScenario.id)}
                                    className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                  >
                                    <Plus className="w-4 h-4" />
                                    {t('ebios.workshop4.addStep')}
                                  </button>
                                )}
                              </div>

                              {opScenario.attackSequence.length === 0 ? (
                                <p className="text-sm text-gray-500 italic py-4 text-center">
                                  {t('ebios.workshop4.noStepsYet')}
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {opScenario.attackSequence.map((step) => (
                                    <div
                                      key={step.id}
                                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                                    >
                                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400">
                                        {step.order}
                                      </div>
                                      <div className="flex-1">
                                        {!readOnly ? (
                                          <input
                                            type="text"
                                            value={step.description}
                                            onChange={(e) => handleUpdateAttackStep(opScenario.id, step.id, { description: e.target.value })}
                                            placeholder={t('ebios.workshop4.stepDescriptionPlaceholder')}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                                          />
                                        ) : (
                                          <p className="text-sm text-gray-700 dark:text-gray-300">
                                            {step.description}
                                          </p>
                                        )}
                                        {step.mitreReference ? (
                                          <div className="flex items-center gap-2 mt-2">
                                            <Link2 className="w-3 h-3 text-gray-400" />
                                            <span className="text-xs text-purple-600 dark:text-purple-400 font-mono">
                                              {step.mitreReference.techniqueId}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              {step.mitreReference.techniqueName}
                                            </span>
                                            {!readOnly && (
                                              <button
                                                onClick={() => handleOpenMitreModal(opScenario.id, step.id)}
                                                className="text-xs text-blue-500 hover:text-blue-600 ml-2"
                                              >
                                                {t('common.change')}
                                              </button>
                                            )}
                                          </div>
                                        ) : !readOnly && (
                                          <button
                                            onClick={() => handleOpenMitreModal(opScenario.id, step.id)}
                                            className="mt-2 flex items-center gap-1.5 text-xs text-purple-500 hover:text-purple-600"
                                          >
                                            <Shield className="w-3 h-3" />
                                            {t('ebios.workshop4.addMitreRef')}
                                          </button>
                                        )}
                                      </div>
                                      {!readOnly && (
                                        <button
                                          onClick={() => handleDeleteAttackStep(opScenario.id, step.id)}
                                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                          <Trash2 className="w-4 h-4 text-red-400" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                                {/* Risk link status */}
                                <div>
                                  {opScenario.linkedRiskId ? (
                                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                      <FileCheck className="w-4 h-4" />
                                      <span>{t('ebios.workshop4.riskCreated')}</span>
                                      <a
                                        href={`/risks/${opScenario.linkedRiskId}`}
                                        className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        {t('ebios.workshop4.viewRisk')}
                                      </a>
                                    </div>
                                  ) : onCreateRisk && analysisId ? (
                                    <button
                                      onClick={() => handleCreateRiskFromScenario(opScenario)}
                                      disabled={creatingRiskForScenario === opScenario.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                                    >
                                      {creatingRiskForScenario === opScenario.id ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          {t('ebios.workshop4.creatingRisk')}
                                        </>
                                      ) : (
                                        <>
                                          <FileCheck className="w-3.5 h-3.5" />
                                          {t('ebios.workshop4.createRisk')}
                                        </>
                                      )}
                                    </button>
                                  ) : null}
                                </div>

                                {/* Edit/Delete buttons */}
                                {!readOnly && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEditScenario(opScenario)}
                                      className="px-3 py-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm flex items-center gap-1"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                      {t('common.edit')}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteScenario(opScenario.id)}
                                      className="px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                                    >
                                      {t('common.delete')}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

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
