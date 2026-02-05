/**
 * EBIOS RM AI Assistant Component
 * Provides AI-powered assistance for EBIOS Risk Manager workshops.
 *
 * Supports all 5 workshops with context-aware suggestions.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiService } from '../../services/aiService';
import { ErrorLogger } from '../../services/errorLogger';
import {
  Sparkles,
  Bot,
  Loader2,
  Target,
  Shield,
  GitBranch,
  Crosshair,
  CheckSquare,
  X
} from '../ui/Icons';
import type {
  EbiosAnalysis,
  EbiosWorkshopNumber,
  FearedEvent,
  StrategicScenario,
  OperationalScenario,
  TreatmentPlanItem
} from '../../types/ebios';

// ============================================================================
// Types
// ============================================================================

type AIAction =
  | 'suggest_feared_events'
  | 'analyze_risk_sources'
  | 'generate_strategic_scenarios'
  | 'generate_operational_scenarios'
  | 'suggest_treatment';

interface EbiosAIAssistantProps {
  analysis: EbiosAnalysis;
  currentWorkshop: EbiosWorkshopNumber;
  onUpdate?: (updates: Partial<EbiosAnalysis>) => void;
}

interface AIResponse {
  fearedEvents?: Array<{
    name: string;
    description: string;
    impactType: 'confidentiality' | 'integrity' | 'availability';
    gravity: 1 | 2 | 3 | 4;
  }>;
  riskSourceAnalysis?: {
    relevantSources: string[];
    irrelevantSources: string[];
    recommendations: string[];
  };
  strategicScenarios?: Array<{
    name: string;
    description: string;
    attackPath: string;
    gravity: 1 | 2 | 3 | 4;
  }>;
  operationalScenarios?: Array<{
    name: string;
    description: string;
    attackSteps: Array<{
      description: string;
      mitreId?: string;
      mitreName?: string;
    }>;
    likelihood: 1 | 2 | 3 | 4;
  }>;
  treatmentSuggestions?: Array<{
    scenarioName: string;
    strategy: 'accept' | 'mitigate' | 'transfer' | 'avoid';
    justification: string;
    suggestedControls: string[];
  }>;
  text?: string;
}

// ============================================================================
// Action Configuration
// ============================================================================

const WORKSHOP_ACTIONS: Record<EbiosWorkshopNumber, { action: AIAction; label: string; icon: React.ReactNode }[]> = {
  1: [
    { action: 'suggest_feared_events', label: 'Suggérer événements redoutés', icon: <Target className="h-3.5 w-3.5" /> }
  ],
  2: [
    { action: 'analyze_risk_sources', label: 'Analyser sources de risque', icon: <Crosshair className="h-3.5 w-3.5" /> }
  ],
  3: [
    { action: 'generate_strategic_scenarios', label: 'Générer scénarios stratégiques', icon: <GitBranch className="h-3.5 w-3.5" /> }
  ],
  4: [
    { action: 'generate_operational_scenarios', label: 'Générer scénarios opérationnels', icon: <Shield className="h-3.5 w-3.5" /> }
  ],
  5: [
    { action: 'suggest_treatment', label: 'Suggérer traitement', icon: <CheckSquare className="h-3.5 w-3.5" /> }
  ]
};

// ============================================================================
// Component
// ============================================================================

export const EbiosAIAssistant: React.FC<EbiosAIAssistantProps> = ({
  analysis,
  currentWorkshop,
  onUpdate
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = WORKSHOP_ACTIONS[currentWorkshop] || [];

  // Build context from analysis data
  const buildContext = (): string => {
    const workshop1 = analysis.workshops[1].data;
    const workshop2 = analysis.workshops[2].data;
    const workshop3 = analysis.workshops[3].data;
    const workshop4 = analysis.workshops[4].data;

    let context = `Analyse EBIOS RM: "${analysis.name}"\n`;
    context += `Secteur: ${analysis.sector || 'Non spécifié'}\n\n`;

    // Workshop 1 context
    if (workshop1.scope.missions.length > 0) {
      context += `Missions:\n${workshop1.scope.missions.map(m => `- ${m.name} (criticité: ${m.criticality})`).join('\n')}\n\n`;
    }
    if (workshop1.scope.essentialAssets.length > 0) {
      context += `Actifs essentiels:\n${workshop1.scope.essentialAssets.map(a => `- ${a.name} (${a.type})`).join('\n')}\n\n`;
    }
    if (workshop1.fearedEvents.length > 0) {
      context += `Événements redoutés existants:\n${workshop1.fearedEvents.map(e => `- ${e.name} (gravité: ${e.gravity})`).join('\n')}\n\n`;
    }

    // Workshop 2 context
    if (workshop2.selectedRiskSources.length > 0) {
      context += `Sources de risque sélectionnées: ${workshop2.selectedRiskSources.length}\n`;
    }
    if (workshop2.srOvPairs.length > 0) {
      context += `Couples SR/OV retenus: ${workshop2.srOvPairs.filter(p => p.retainedForAnalysis).length}\n\n`;
    }

    // Workshop 3 context
    if (workshop3.strategicScenarios.length > 0) {
      context += `Scénarios stratégiques:\n${workshop3.strategicScenarios.map(s => `- ${s.name} (gravité: ${s.gravity})`).join('\n')}\n\n`;
    }
    if (workshop3.ecosystem.length > 0) {
      context += `Parties prenantes écosystème: ${workshop3.ecosystem.length}\n\n`;
    }

    // Workshop 4 context
    if (workshop4.operationalScenarios.length > 0) {
      context += `Scénarios opérationnels:\n${workshop4.operationalScenarios.map(s => `- ${s.name} (vraisemblance: ${s.likelihood})`).join('\n')}\n\n`;
    }

    return context;
  };

  const handleAction = async (action: AIAction) => {
    setLoading(true);
    setActiveAction(action);
    setResponse(null);
    setError(null);

    try {
      const context = buildContext();
      let prompt = '';

      switch (action) {
        case 'suggest_feared_events':
          prompt = `
            ${context}

            En tant qu'expert EBIOS RM, suggère 3 à 5 événements redoutés pertinents pour cette analyse.
            Chaque événement doit être lié aux missions et actifs essentiels identifiés.

            Format de réponse JSON attendu:
            {
              "fearedEvents": [
                {
                  "name": "string (titre court)",
                  "description": "string (description de l'événement)",
                  "impactType": "confidentiality" | "integrity" | "availability",
                  "gravity": 1 | 2 | 3 | 4
                }
              ]
            }
          `;
          break;

        case 'analyze_risk_sources':
          prompt = `
            ${context}

            En tant qu'expert EBIOS RM, analyse les sources de risque les plus pertinentes pour cette organisation.
            Considère le secteur d'activité et les actifs critiques identifiés.

            Format de réponse JSON attendu:
            {
              "riskSourceAnalysis": {
                "relevantSources": ["source1", "source2", ...],
                "irrelevantSources": ["source1", ...],
                "recommendations": ["recommandation1", "recommandation2", ...]
              }
            }
          `;
          break;

        case 'generate_strategic_scenarios':
          prompt = `
            ${context}

            En tant qu'expert EBIOS RM, génère 2 à 4 scénarios stratégiques pertinents.
            Chaque scénario doit combiner une source de risque, un objectif visé et des chemins d'attaque.

            Format de réponse JSON attendu:
            {
              "strategicScenarios": [
                {
                  "name": "string (titre court)",
                  "description": "string (description du scénario)",
                  "attackPath": "string (description du chemin d'attaque)",
                  "gravity": 1 | 2 | 3 | 4
                }
              ]
            }
          `;
          break;

        case 'generate_operational_scenarios':
          prompt = `
            ${context}

            En tant qu'expert EBIOS RM et cybersécurité, génère 2 à 3 scénarios opérationnels détaillés.
            Chaque scénario doit décrire une séquence d'attaque technique avec références MITRE ATT&CK.

            Format de réponse JSON attendu:
            {
              "operationalScenarios": [
                {
                  "name": "string (titre court)",
                  "description": "string (description du scénario)",
                  "attackSteps": [
                    {
                      "description": "string (description de l'étape)",
                      "mitreId": "string (ex: T1566)",
                      "mitreName": "string (ex: Phishing)"
                    }
                  ],
                  "likelihood": 1 | 2 | 3 | 4
                }
              ]
            }
          `;
          break;

        case 'suggest_treatment':
          prompt = `
            ${context}

            En tant qu'expert EBIOS RM, suggère des stratégies de traitement pour les scénarios identifiés.
            Propose des mesures de sécurité concrètes alignées ISO 27002.

            Format de réponse JSON attendu:
            {
              "treatmentSuggestions": [
                {
                  "scenarioName": "string (nom du scénario concerné)",
                  "strategy": "accept" | "mitigate" | "transfer" | "avoid",
                  "justification": "string (justification de la stratégie)",
                  "suggestedControls": ["contrôle1", "contrôle2", ...]
                }
              ]
            }
          `;
          break;
      }

      const resultText = await aiService.generateText(prompt);

      // Parse JSON response
      try {
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedResponse = JSON.parse(jsonMatch[0]) as AIResponse;
          setResponse(parsedResponse);
        } else {
          setResponse({ text: resultText });
        }
      } catch {
        ErrorLogger.warn('Failed to parse EBIOS AI response', 'EbiosAIAssistant.handleAction');
        setResponse({ text: resultText });
      }

    } catch (err) {
      ErrorLogger.handleErrorWithToast(err, 'EbiosAIAssistant.handleAction', 'AI_ERROR');
      setError(t('ebios.ai.error', "Une erreur est survenue lors de l'analyse IA."));
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setResponse(null);
    setActiveAction(null);
  };

  const handleApplyFearedEvents = () => {
    if (!onUpdate || !response?.fearedEvents) return;

    const existingEvents = analysis.workshops[1].data.fearedEvents;
    const newEvents: FearedEvent[] = response.fearedEvents.map((e, idx) => ({
      id: `ai-fe-${Date.now()}-${idx}`,
      name: e.name,
      description: e.description,
      impactType: e.impactType,
      gravity: e.gravity,
      linkedMissionIds: [],
      linkedEssentialAssetIds: []
    }));

    onUpdate({
      workshops: {
        ...analysis.workshops,
        1: {
          ...analysis.workshops[1],
          data: {
            ...analysis.workshops[1].data,
            fearedEvents: [...existingEvents, ...newEvents]
          }
        }
      }
    });
  };

  const handleApplyStrategicScenarios = () => {
    if (!onUpdate || !response?.strategicScenarios) return;

    const existing = analysis.workshops[3].data.strategicScenarios;
    const newScenarios: StrategicScenario[] = response.strategicScenarios.map((s, idx) => ({
      id: `ai-ss-${Date.now()}-${idx}`,
      name: s.name,
      description: s.description,
      srOvPairId: '',
      attackPathIds: [],
      fearedEventIds: [],
      gravity: s.gravity,
      gravityJustification: s.attackPath
    }));

    onUpdate({
      workshops: {
        ...analysis.workshops,
        3: {
          ...analysis.workshops[3],
          data: {
            ...analysis.workshops[3].data,
            strategicScenarios: [...existing, ...newScenarios]
          }
        }
      }
    });
  };

  const handleApplyOperationalScenarios = () => {
    if (!onUpdate || !response?.operationalScenarios) return;

    const existing = analysis.workshops[4].data.operationalScenarios;
    const newScenarios: OperationalScenario[] = response.operationalScenarios.map((s, idx) => ({
      id: `ai-os-${Date.now()}-${idx}`,
      code: `SO-AI-${String(existing.length + idx + 1).padStart(3, '0')}`,
      name: s.name,
      description: s.description,
      strategicScenarioId: '',
      attackSequence: s.attackSteps.map((step, stepIdx) => ({
        id: `ai-step-${Date.now()}-${idx}-${stepIdx}`,
        order: stepIdx + 1,
        description: step.description,
        mitreReference: step.mitreId ? {
          tacticId: '',
          tacticName: '',
          techniqueId: step.mitreId,
          techniqueName: step.mitreName || ''
        } : undefined
      })),
      likelihood: s.likelihood,
      riskLevel: s.likelihood * 2 // Placeholder calculation
    }));

    onUpdate({
      workshops: {
        ...analysis.workshops,
        4: {
          ...analysis.workshops[4],
          data: {
            ...analysis.workshops[4].data,
            operationalScenarios: [...existing, ...newScenarios]
          }
        }
      }
    });
  };

  const handleApplyTreatment = () => {
    if (!onUpdate || !response?.treatmentSuggestions) return;

    const existing = analysis.workshops[5].data.treatmentPlan;
    const opScenarios = analysis.workshops[4].data.operationalScenarios;

    const newItems: TreatmentPlanItem[] = response.treatmentSuggestions.map((s, idx) => {
      // Try to find matching operational scenario
      const matchingScenario = opScenarios.find(os =>
        os.name.toLowerCase().includes(s.scenarioName.toLowerCase()) ||
        s.scenarioName.toLowerCase().includes(os.name.toLowerCase())
      );

      return {
        id: `ai-tp-${Date.now()}-${idx}`,
        operationalScenarioId: matchingScenario?.id || '',
        strategy: s.strategy,
        strategyJustification: s.justification,
        selectedControlIds: [],
        status: 'planned' as const
      };
    });

    onUpdate({
      workshops: {
        ...analysis.workshops,
        5: {
          ...analysis.workshops[5],
          data: {
            ...analysis.workshops[5].data,
            treatmentPlan: [...existing, ...newItems]
          }
        }
      }
    });
  };

  const renderApplyButton = () => {
    if (!response || response.text || !onUpdate) return null;

    let handler: (() => void) | null = null;
    let label = t('common.apply', 'Appliquer');

    switch (activeAction) {
      case 'suggest_feared_events':
        if (response.fearedEvents?.length) handler = handleApplyFearedEvents;
        label = t('ebios.ai.applyFearedEvents', 'Ajouter les événements');
        break;
      case 'generate_strategic_scenarios':
        if (response.strategicScenarios?.length) handler = handleApplyStrategicScenarios;
        label = t('ebios.ai.applyStrategic', 'Ajouter les scénarios');
        break;
      case 'generate_operational_scenarios':
        if (response.operationalScenarios?.length) handler = handleApplyOperationalScenarios;
        label = t('ebios.ai.applyOperational', 'Ajouter les scénarios');
        break;
      case 'suggest_treatment':
        if (response.treatmentSuggestions?.length) handler = handleApplyTreatment;
        label = t('ebios.ai.applyTreatment', 'Ajouter au plan de traitement');
        break;
    }

    if (!handler) return null;

    return (
      <button
        onClick={handler}
        className="mt-3 w-full flex items-center justify-center px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <CheckSquare className="h-3.5 w-3.5 mr-2" />
        {label}
      </button>
    );
  };

  const renderResponse = () => {
    if (!response) return null;

    return (
      <div className="bg-white/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-border/40 shadow-sm animate-fade-in backdrop-blur-md">
        <div className="flex justify-between items-start mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 flex items-center">
            <Bot className="h-3.5 w-3.5 mr-1.5" />
            {t('ebios.ai.response', 'Suggestions IA')}
          </h4>
          <button
            onClick={handleDismiss}
            className="text-slate-600 hover:text-slate-600 focus:outline-none"
            aria-label={t('common.close', 'Fermer')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-3">
          {/* Feared Events */}
          {response.fearedEvents && (
            <div className="space-y-2">
              {response.fearedEvents.map((e, i) => (
                <div key={i || 'unknown'} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-warning/10 text-warning rounded">
                      G{e.gravity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{e.description}</p>
                  <span className="text-xs text-brand-600 dark:text-brand-400">{e.impactType}</span>
                </div>
              ))}
            </div>
          )}

          {/* Risk Source Analysis */}
          {response.riskSourceAnalysis && (
            <div className="space-y-2">
              <div>
                <span className="font-medium text-success">{t('ebios.ai.relevant', 'Pertinentes')}:</span>
                <ul className="list-disc pl-4 text-xs mt-1">
                  {response.riskSourceAnalysis.relevantSources.map((s, i) => (
                    <li key={i || 'unknown'}>{s}</li>
                  ))}
                </ul>
              </div>
              {response.riskSourceAnalysis.recommendations.length > 0 && (
                <div>
                  <span className="font-medium">{t('ebios.ai.recommendations', 'Recommandations')}:</span>
                  <ul className="list-disc pl-4 text-xs mt-1">
                    {response.riskSourceAnalysis.recommendations.map((r, i) => (
                      <li key={i || 'unknown'}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Strategic Scenarios */}
          {response.strategicScenarios && (
            <div className="space-y-2">
              {response.strategicScenarios.map((s, i) => (
                <div key={i || 'unknown'} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-error/10 text-error rounded">
                      G{s.gravity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{s.description}</p>
                  <p className="text-xs text-brand-700 dark:text-brand-300 mt-1">
                    <GitBranch className="h-3 w-3 inline mr-1" />
                    {s.attackPath}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Operational Scenarios */}
          {response.operationalScenarios && (
            <div className="space-y-2">
              {response.operationalScenarios.map((s, i) => (
                <div key={i || 'unknown'} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-warning/10 text-warning rounded">
                      V{s.likelihood}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{s.description}</p>
                  <div className="mt-2 space-y-1">
                    {s.attackSteps.map((step, j) => (
                      <div key={j || 'unknown'} className="flex items-start gap-2 text-xs">
                        <span className="font-mono bg-slate-200 dark:bg-slate-600 px-1 rounded">{j + 1}</span>
                        <span>{step.description}</span>
                        {step.mitreId && (
                          <span className="text-violet-600 dark:text-violet-400 font-mono">
                            [{step.mitreId}]
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Treatment Suggestions */}
          {response.treatmentSuggestions && (
            <div className="space-y-2">
              {response.treatmentSuggestions.map((s, i) => (
                <div key={i || 'unknown'} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.scenarioName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${s.strategy === 'mitigate' ? 'bg-info/10 text-info' :
                        s.strategy === 'transfer' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400' :
                          s.strategy === 'avoid' ? 'bg-error/10 text-error' :
                            'bg-slate-100 dark:bg-slate-800 text-muted-foreground'
                      }`}>
                      {s.strategy}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{s.justification}</p>
                  {s.suggestedControls.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium">{t('ebios.ai.controls', 'Contrôles suggérés')}:</span>
                      <ul className="list-disc pl-4 text-xs">
                        {s.suggestedControls.map((c, j) => (
                          <li key={j || 'unknown'}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Plain text fallback */}
          {response.text && (
            <p className="whitespace-pre-wrap">{response.text}</p>
          )}
        </div>

        {renderApplyButton()}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-brand-50/50 to-violet-50/50 dark:from-brand-900/10 dark:to-violet-900/10 rounded-3xl p-6 border border-border/40 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white dark:bg-slate-900/50 rounded-3xl shadow-sm">
          <Sparkles className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            {t('ebios.ai.title', 'Assistant IA EBIOS RM')}
          </h3>
          <p className="text-xs text-slate-600 dark:text-muted-foreground">
            {t('ebios.ai.subtitle', 'Atelier')} {currentWorkshop}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {actions.map(({ action, label, icon }) => (
          <button
            key={action || 'unknown'}
            onClick={() => handleAction(action)}
            disabled={loading}
            className={`flex items-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${activeAction === action
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-muted-foreground hover:bg-brand-50 dark:hover:bg-brand-900 border border-transparent hover:border-brand-200'
              }`}
          >
            {loading && activeAction === action ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <span className="mr-2">{icon}</span>
            )}
            {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-error mb-2">{error}</div>
      )}

      {/* Response */}
      {renderResponse()}
    </div>
  );
};

export default EbiosAIAssistant;
