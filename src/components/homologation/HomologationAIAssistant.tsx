/**
 * ANSSI Homologation AI Assistant Component
 * Provides AI-powered assistance for the French ANSSI homologation process.
 *
 * Supports level determination, document generation, and readiness assessment.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiService } from '../../services/aiService';
import { ErrorLogger } from '../../services/errorLogger';
import {
  Sparkles,
  Bot,
  Loader2,
  FileText,
  Shield,
  CheckCircle,
  AlertTriangle,
  ListChecks,
  X
} from '../ui/Icons';
import type {
  HomologationDossier,
  HomologationLevel
} from '../../types/homologation';

// ============================================================================
// Types
// ============================================================================

type AIAction =
  | 'analyze_level'
  | 'generate_strategy'
  | 'analyze_risks'
  | 'suggest_actions'
  | 'assess_readiness';

interface HomologationAIAssistantProps {
  dossier: HomologationDossier;
  onUpdate?: (updates: Partial<HomologationDossier>) => void;
}

interface AIResponse {
  levelAnalysis?: {
    recommendedLevel: HomologationLevel;
    justification: string;
    keyFactors: string[];
    missingInfo?: string[];
  };
  strategyOutline?: {
    sections: Array<{
      title: string;
      description: string;
      keyPoints: string[];
    }>;
    recommendations: string[];
  };
  riskAnalysis?: {
    coveredRisks: string[];
    gaps: string[];
    recommendations: string[];
    ebiosSyncStatus?: string;
  };
  actionPlan?: {
    items: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      category: string;
      estimatedEffort?: string;
    }>;
    timeline?: string;
  };
  readinessAssessment?: {
    score: number;
    status: 'ready' | 'almost_ready' | 'not_ready';
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    blockers?: string[];
  };
  text?: string;
}

// ============================================================================
// Constants
// ============================================================================

const LEVEL_LABELS: Record<HomologationLevel, string> = {
  etoile: 'Étoile',
  simple: 'Simple',
  standard: 'Standard',
  renforce: 'Renforcé'
};

const ACTIONS: Array<{ action: AIAction; label: string; icon: React.ReactNode; description: string }> = [
  {
    action: 'analyze_level',
    label: 'Analyser niveau',
    icon: <Shield className="h-3.5 w-3.5" />,
    description: "Évaluer le niveau d'homologation approprié"
  },
  {
    action: 'generate_strategy',
    label: 'Générer stratégie',
    icon: <FileText className="h-3.5 w-3.5" />,
    description: "Proposer un plan pour la stratégie d'homologation"
  },
  {
    action: 'analyze_risks',
    label: 'Analyser risques',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    description: 'Analyser la couverture des risques'
  },
  {
    action: 'suggest_actions',
    label: "Plan d'action",
    icon: <ListChecks className="h-3.5 w-3.5" />,
    description: 'Suggérer des actions prioritaires'
  },
  {
    action: 'assess_readiness',
    label: 'Évaluer préparation',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    description: "Évaluer la préparation pour l'homologation"
  }
];

// ============================================================================
// Component
// ============================================================================

export const HomologationAIAssistant: React.FC<HomologationAIAssistantProps> = ({
  dossier,
  onUpdate
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [activeAction, setActiveAction] = useState<AIAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Build context from dossier data
  const buildContext = (): string => {
    let context = `Dossier d'homologation ANSSI: "${dossier.name}"\n`;
    context += `Périmètre système: ${dossier.systemScope}\n`;
    context += `Niveau actuel: ${LEVEL_LABELS[dossier.level]}\n`;
    context += `Statut: ${dossier.status}\n\n`;

    if (dossier.description) {
      context += `Description: ${dossier.description}\n\n`;
    }

    // Level determination answers
    if (dossier.determinationAnswers.length > 0) {
      context += `Score de détermination: ${dossier.recommendationScore}/100\n`;
      context += `Justification niveau: ${dossier.levelJustification}\n\n`;
    }

    // Documents status
    const completedDocs = dossier.documents.filter(d => d.status === 'completed' || d.status === 'validated');
    const pendingDocs = dossier.documents.filter(d => d.status === 'in_progress');
    const notStartedDocs = dossier.documents.filter(d => d.status === 'not_started');

    context += `Documents complétés: ${completedDocs.length}\n`;
    context += `Documents en cours: ${pendingDocs.length}\n`;
    context += `Documents non commencés: ${notStartedDocs.length}\n\n`;

    // EBIOS link
    if (dossier.linkedEbiosAnalysisId) {
      context += `Analyse EBIOS liée: Oui\n`;
      if (dossier.ebiosSnapshot) {
        context += `- Événements redoutés: ${dossier.ebiosSnapshot.fearedEventsCount}\n`;
        context += `- Sources de risque: ${dossier.ebiosSnapshot.riskSourcesCount}\n`;
        context += `- Scénarios stratégiques: ${dossier.ebiosSnapshot.strategicScenariosCount}\n`;
        context += `- Scénarios opérationnels: ${dossier.ebiosSnapshot.operationalScenariosCount}\n`;
        context += `- Mesures de traitement: ${dossier.ebiosSnapshot.treatmentItemsCount}\n`;
      }
      if (dossier.ebiosReviewRequired) {
        context += `⚠️ Revue EBIOS requise (modifications détectées)\n`;
      }
    } else {
      context += `Analyse EBIOS liée: Non\n`;
    }

    // Validity
    if (dossier.validityEndDate) {
      context += `\nDate de fin de validité: ${dossier.validityEndDate}\n`;
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
        case 'analyze_level':
          prompt = `
            ${context}

            En tant qu'expert ANSSI en homologation de sécurité, analyse si le niveau d'homologation
            actuel est approprié pour ce système d'information.

            Les niveaux ANSSI sont:
            - Étoile: systèmes non sensibles, processus minimal
            - Simple: sensibilité limitée, processus allégé
            - Standard: systèmes sensibles, processus complet
            - Renforcé: systèmes critiques, processus avec audits techniques

            Format de réponse JSON attendu:
            {
              "levelAnalysis": {
                "recommendedLevel": "etoile" | "simple" | "standard" | "renforce",
                "justification": "string (justification détaillée)",
                "keyFactors": ["facteur1", "facteur2", ...],
                "missingInfo": ["info manquante 1", ...] (optionnel)
              }
            }
          `;
          break;

        case 'generate_strategy':
          prompt = `
            ${context}

            En tant qu'expert ANSSI, génère un plan de stratégie d'homologation adapté à ce dossier.
            La stratégie doit inclure le périmètre, les objectifs, le calendrier et les responsabilités.

            Format de réponse JSON attendu:
            {
              "strategyOutline": {
                "sections": [
                  {
                    "title": "string (titre de section)",
                    "description": "string (description)",
                    "keyPoints": ["point1", "point2", ...]
                  }
                ],
                "recommendations": ["recommandation1", "recommandation2", ...]
              }
            }
          `;
          break;

        case 'analyze_risks':
          prompt = `
            ${context}

            En tant qu'expert ANSSI, analyse la couverture des risques de sécurité pour ce dossier.
            ${dossier.linkedEbiosAnalysisId
              ? "Considère les données de l'analyse EBIOS liée."
              : "Note qu'aucune analyse EBIOS n'est liée."}

            Format de réponse JSON attendu:
            {
              "riskAnalysis": {
                "coveredRisks": ["risque couvert 1", "risque couvert 2", ...],
                "gaps": ["lacune 1", "lacune 2", ...],
                "recommendations": ["recommandation 1", ...],
                "ebiosSyncStatus": "string (état de la synchronisation EBIOS)" (optionnel)
              }
            }
          `;
          break;

        case 'suggest_actions':
          prompt = `
            ${context}

            En tant qu'expert ANSSI, suggère un plan d'action priorisé pour compléter ce dossier
            d'homologation. Considère les documents manquants et les exigences du niveau ${LEVEL_LABELS[dossier.level]}.

            Format de réponse JSON attendu:
            {
              "actionPlan": {
                "items": [
                  {
                    "action": "string (description de l'action)",
                    "priority": "high" | "medium" | "low",
                    "category": "string (catégorie: documentation, technique, organisationnel)",
                    "estimatedEffort": "string (effort estimé)" (optionnel)
                  }
                ],
                "timeline": "string (calendrier suggéré)" (optionnel)
              }
            }
          `;
          break;

        case 'assess_readiness':
          prompt = `
            ${context}

            En tant qu'expert ANSSI, évalue la préparation de ce dossier pour la décision d'homologation.
            Identifie les points forts, les faiblesses et les bloquants éventuels.

            Format de réponse JSON attendu:
            {
              "readinessAssessment": {
                "score": number (0-100),
                "status": "ready" | "almost_ready" | "not_ready",
                "strengths": ["point fort 1", "point fort 2", ...],
                "weaknesses": ["faiblesse 1", ...],
                "recommendations": ["recommandation 1", ...],
                "blockers": ["bloquant 1", ...] (optionnel, si status = not_ready)
              }
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
        ErrorLogger.warn('Failed to parse Homologation AI response', 'HomologationAIAssistant.handleAction');
        setResponse({ text: resultText });
      }

    } catch (err) {
      ErrorLogger.handleErrorWithToast(err, 'HomologationAIAssistant.handleAction', 'AI_ERROR');
      setError(t('homologation.ai.error', "Une erreur est survenue lors de l'analyse IA."));
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setResponse(null);
    setActiveAction(null);
  };

  const handleApplyLevel = () => {
    if (!onUpdate || !response?.levelAnalysis) return;

    onUpdate({
      level: response.levelAnalysis.recommendedLevel,
      levelJustification: response.levelAnalysis.justification,
      levelOverridden: dossier.level !== response.levelAnalysis.recommendedLevel,
      originalRecommendation: dossier.level
    });
  };

  const renderResponse = () => {
    if (!response) return null;

    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-indigo-100 dark:border-indigo-500/20 shadow-sm animate-fade-in">
        <div className="flex justify-between items-start mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center">
            <Bot className="h-3.5 w-3.5 mr-1.5" />
            {t('homologation.ai.response', 'Analyse IA')}
          </h4>
          <button
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-600 focus:outline-none"
            aria-label={t('common.close', 'Fermer')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-3">
          {/* Level Analysis */}
          {response.levelAnalysis && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <span className="font-medium">{t('homologation.ai.recommendedLevel', 'Niveau recommandé')}</span>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  response.levelAnalysis.recommendedLevel === 'etoile' ? 'bg-green-100 text-green-700' :
                  response.levelAnalysis.recommendedLevel === 'simple' ? 'bg-blue-100 text-blue-700' :
                  response.levelAnalysis.recommendedLevel === 'standard' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {LEVEL_LABELS[response.levelAnalysis.recommendedLevel]}
                </span>
              </div>
              <p className="text-xs">{response.levelAnalysis.justification}</p>
              <div>
                <span className="text-xs font-medium">{t('homologation.ai.keyFactors', 'Facteurs clés')}:</span>
                <ul className="list-disc pl-4 text-xs mt-1">
                  {response.levelAnalysis.keyFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
              {response.levelAnalysis.missingInfo && response.levelAnalysis.missingInfo.length > 0 && (
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    {t('homologation.ai.missingInfo', 'Informations manquantes')}:
                  </span>
                  <ul className="list-disc pl-4 text-xs mt-1 text-amber-600 dark:text-amber-300">
                    {response.levelAnalysis.missingInfo.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {onUpdate && response.levelAnalysis.recommendedLevel !== dossier.level && (
                <button
                  onClick={handleApplyLevel}
                  className="w-full flex items-center justify-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  <Shield className="h-3.5 w-3.5 mr-2" />
                  {t('homologation.ai.applyLevel', 'Appliquer le niveau recommandé')}
                </button>
              )}
            </div>
          )}

          {/* Strategy Outline */}
          {response.strategyOutline && (
            <div className="space-y-3">
              {response.strategyOutline.sections.map((section, i) => (
                <div key={i} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <span className="font-medium">{section.title}</span>
                  <p className="text-xs text-muted-foreground mt-1">{section.description}</p>
                  <ul className="list-disc pl-4 text-xs mt-2">
                    {section.keyPoints.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {response.strategyOutline.recommendations.length > 0 && (
                <div>
                  <span className="text-xs font-medium">{t('homologation.ai.recommendations', 'Recommandations')}:</span>
                  <ul className="list-disc pl-4 text-xs mt-1 text-indigo-600 dark:text-indigo-400">
                    {response.strategyOutline.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Risk Analysis */}
          {response.riskAnalysis && (
            <div className="space-y-3">
              {response.riskAnalysis.coveredRisks.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-green-600">{t('homologation.ai.coveredRisks', 'Risques couverts')}:</span>
                  <ul className="list-disc pl-4 text-xs mt-1">
                    {response.riskAnalysis.coveredRisks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {response.riskAnalysis.gaps.length > 0 && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">{t('homologation.ai.gaps', 'Lacunes identifiées')}:</span>
                  <ul className="list-disc pl-4 text-xs mt-1 text-red-600 dark:text-red-300">
                    {response.riskAnalysis.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {response.riskAnalysis.recommendations.length > 0 && (
                <div>
                  <span className="text-xs font-medium">{t('homologation.ai.recommendations', 'Recommandations')}:</span>
                  <ul className="list-disc pl-4 text-xs mt-1">
                    {response.riskAnalysis.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {response.riskAnalysis.ebiosSyncStatus && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400">
                  {response.riskAnalysis.ebiosSyncStatus}
                </p>
              )}
            </div>
          )}

          {/* Action Plan */}
          {response.actionPlan && (
            <div className="space-y-2">
              {response.actionPlan.items.map((item, i) => (
                <div key={i} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg flex items-start gap-2">
                  <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    item.priority === 'high' ? 'bg-red-500' :
                    item.priority === 'medium' ? 'bg-amber-500' :
                    'bg-green-500'
                  }`} />
                  <div className="flex-1">
                    <span className="font-medium text-xs">{item.action}</span>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 rounded">
                        {item.category}
                      </span>
                      {item.estimatedEffort && (
                        <span className="text-xs text-muted-foreground">
                          {item.estimatedEffort}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {response.actionPlan.timeline && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                  {t('homologation.ai.timeline', 'Calendrier')}: {response.actionPlan.timeline}
                </p>
              )}
            </div>
          )}

          {/* Readiness Assessment */}
          {response.readinessAssessment && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div>
                  <span className="font-medium">{t('homologation.ai.readinessScore', 'Score de préparation')}</span>
                  <div className="w-24 h-2 bg-slate-200 dark:bg-slate-600 rounded-full mt-1">
                    <div
                      className={`h-full rounded-full transition-all ${
                        response.readinessAssessment.score >= 80 ? 'bg-green-500' :
                        response.readinessAssessment.score >= 50 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${response.readinessAssessment.score}%` }}
                    />
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  response.readinessAssessment.status === 'ready' ? 'bg-green-100 text-green-700' :
                  response.readinessAssessment.status === 'almost_ready' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {response.readinessAssessment.score}%
                </span>
              </div>

              {response.readinessAssessment.strengths.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-green-600">{t('homologation.ai.strengths', 'Points forts')}:</span>
                  <ul className="list-disc pl-4 text-xs mt-1">
                    {response.readinessAssessment.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {response.readinessAssessment.weaknesses.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-amber-600">{t('homologation.ai.weaknesses', 'Points à améliorer')}:</span>
                  <ul className="list-disc pl-4 text-xs mt-1">
                    {response.readinessAssessment.weaknesses.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {response.readinessAssessment.blockers && response.readinessAssessment.blockers.length > 0 && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">{t('homologation.ai.blockers', 'Bloquants')}:</span>
                  <ul className="list-disc pl-4 text-xs mt-1 text-red-600 dark:text-red-300">
                    {response.readinessAssessment.blockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {response.readinessAssessment.recommendations.length > 0 && (
                <div>
                  <span className="text-xs font-medium">{t('homologation.ai.recommendations', 'Recommandations')}:</span>
                  <ul className="list-disc pl-4 text-xs mt-1">
                    {response.readinessAssessment.recommendations.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Plain text fallback */}
          {response.text && (
            <p className="whitespace-pre-wrap">{response.text}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-500/30">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white dark:bg-slate-900/50 rounded-xl shadow-sm">
          <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            {t('homologation.ai.title', 'Assistant IA Homologation')}
          </h3>
          <p className="text-xs text-slate-600 dark:text-muted-foreground">
            {t('homologation.ai.subtitle', 'Conformité ANSSI')}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {ACTIONS.map(({ action, label, icon }) => (
          <button
            key={action}
            onClick={() => handleAction(action)}
            disabled={loading}
            className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              activeAction === action
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'
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
        <div className="text-xs text-red-500 mb-2">{error}</div>
      )}

      {/* Response */}
      {renderResponse()}
    </div>
  );
};

export default HomologationAIAssistant;
