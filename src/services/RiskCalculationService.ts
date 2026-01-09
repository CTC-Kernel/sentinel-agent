/**
 * Service de calcul de risques selon ISO 27005
 *
 * Centralise toute la logique métier de calcul des risques:
 * - Calcul du score de risque (probabilité × impact)
 * - Détermination du niveau de risque
 * - Calcul du risque résiduel
 * - Évaluation de l'efficacité des contrôles
 *
 * @module RiskCalculationService
 */

import { Risk, Control } from '../types';

/**
 * Niveaux de risque selon ISO 27005
 */
export enum RiskLevel {
  VERY_LOW = 'Très faible',
  LOW = 'Faible',
  MEDIUM = 'Moyen',
  HIGH = 'Élevé',
  CRITICAL = 'Critique'
}

/**
 * Configuration des seuils de risque (personnalisable par organisation)
 */
export interface RiskThresholds {
  veryLow: number;    // <= 4
  low: number;        // <= 8
  medium: number;     // <= 12
  high: number;       // <= 16
  critical: number;   // > 16
}

/**
 * Résultat de l'évaluation du risque
 */
export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  color: string;
  priority: number;
  requiresAction: boolean;
}

/**
 * Service de calcul de risques
 */
export class RiskCalculationService {
  /**
   * Seuils par défaut (ISO 27005)
   */
  private static readonly DEFAULT_THRESHOLDS: RiskThresholds = {
    veryLow: 4,
    low: 8,
    medium: 12,
    high: 16,
    critical: 25
  };

  /**
   * Calcule le score de risque brut
   *
   * @param probability - Probabilité d'occurrence (1-5)
   * @param impact - Impact potentiel (1-5)
   * @returns Score de risque (1-25)
   *
   * @example
   * ```typescript
   * const score = RiskCalculationService.calculateScore(4, 5);
   * // score = 20
   * ```
   */
  static calculateScore(probability: number, impact: number): number {
    this.validateProbability(probability);
    this.validateImpact(impact);
    return probability * impact;
  }

  /**
   * Détermine le niveau de risque à partir du score
   *
   * @param score - Score de risque (1-25)
   * @param thresholds - Seuils personnalisés (optionnel)
   * @returns Niveau de risque
   *
   * @example
   * ```typescript
   * const level = RiskCalculationService.getRiskLevel(20);
   * // level = RiskLevel.CRITICAL
   * ```
   */
  static getRiskLevel(
    score: number,
    thresholds: RiskThresholds = this.DEFAULT_THRESHOLDS
  ): RiskLevel {
    if (score <= thresholds.veryLow) return RiskLevel.VERY_LOW;
    if (score <= thresholds.low) return RiskLevel.LOW;
    if (score <= thresholds.medium) return RiskLevel.MEDIUM;
    if (score <= thresholds.high) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  /**
   * Évaluation complète du risque
   *
   * @param probability - Probabilité (1-5)
   * @param impact - Impact (1-5)
   * @param thresholds - Seuils personnalisés (optionnel)
   * @returns Évaluation détaillée
   *
   * @example
   * ```typescript
   * const assessment = RiskCalculationService.assessRisk(4, 5);
   * // {
   * //   score: 20,
   * //   level: RiskLevel.CRITICAL,
   * //   color: '#dc2626',
   * //   priority: 1,
   * //   requiresAction: true
   * // }
   * ```
   */
  static assessRisk(
    probability: number,
    impact: number,
    thresholds?: RiskThresholds
  ): RiskAssessment {
    const score = this.calculateScore(probability, impact);
    const level = this.getRiskLevel(score, thresholds);

    return {
      score,
      level,
      color: this.getRiskColor(level),
      priority: this.getRiskPriority(level),
      requiresAction: this.requiresImmediateAction(level)
    };
  }

  /**
   * Calcule le risque résiduel après application des contrôles
   *
   * Méthode: Réduction basée sur l'efficacité des contrôles
   *
   * @param initialRisk - Risque initial
   * @param controls - Contrôles appliqués
   * @returns Risque résiduel
   *
   * @example
   * ```typescript
   * const residual = RiskCalculationService.calculateResidualRisk(
   *   { probability: 5, impact: 5, riskLevel: 25 },
   *   [
   *     { effectiveness: 'Élevée', implementationStatus: 'Implémenté' },
   *     { effectiveness: 'Moyenne', implementationStatus: 'Implémenté' }
   *   ]
   * );
   * // { probability: 2, impact: 3, score: 6 }
   * ```
   */
  static calculateResidualRisk(
    initialRisk: Risk,
    controls: Control[]
  ): {
    probability: number;
    impact: number;
    score: number;
    reduction: number;
  } {
    const implementedControls = controls.filter(
      c => c.implementationStatus === 'Implémenté' || c.implementationStatus === 'En place'
    );

    if (implementedControls.length === 0) {
      return {
        probability: initialRisk.probability,
        impact: initialRisk.impact,
        score: initialRisk.riskLevel,
        reduction: 0
      };
    }

    // Calculer le facteur de réduction total
    const reductionFactor = this.calculateControlEffectiveness(implementedControls);

    // Appliquer la réduction (mais jamais en dessous de 1)
    const residualProbability = Math.max(
      1,
      Math.round(initialRisk.probability * (1 - reductionFactor))
    );

    const residualImpact = Math.max(
      1,
      Math.round(initialRisk.impact * (1 - reductionFactor * 0.5)) // Impact réduit de moitié
    );

    const residualScore = this.calculateScore(residualProbability, residualImpact);
    const reduction = ((initialRisk.riskLevel - residualScore) / initialRisk.riskLevel) * 100;

    return {
      probability: residualProbability,
      impact: residualImpact,
      score: residualScore,
      reduction: Math.round(reduction)
    };
  }

  /**
   * Calcule l'efficacité combinée des contrôles
   *
   * @param controls - Liste des contrôles
   * @returns Facteur de réduction (0-0.95)
   */
  private static calculateControlEffectiveness(controls: Control[]): number {
    const effectivenessMap: Record<string, number> = {
      'Élevée': 0.7,
      'Moyenne': 0.4,
      'Faible': 0.2,
      'Non testé': 0.1,
      'Inefficace': 0
    };

    let totalEffectiveness = 0;

    for (const control of controls) {
      const effectiveness = effectivenessMap[control.effectiveness || 'Moyenne'] || 0.4;
      // Diminution marginale pour chaque contrôle additionnel
      totalEffectiveness += effectiveness * (1 - totalEffectiveness);
    }

    // Plafond à 95% de réduction maximum
    return Math.min(totalEffectiveness, 0.95);
  }

  /**
   * Détermine la couleur associée au niveau de risque
   */
  private static getRiskColor(level: RiskLevel): string {
    const colorMap: Record<RiskLevel, string> = {
      [RiskLevel.VERY_LOW]: '#10b981',  // green-500
      [RiskLevel.LOW]: '#3b82f6',       // blue-500
      [RiskLevel.MEDIUM]: '#f59e0b',    // amber-500
      [RiskLevel.HIGH]: '#f97316',      // orange-500
      [RiskLevel.CRITICAL]: '#dc2626'   // red-600
    };

    return colorMap[level];
  }

  /**
   * Détermine la priorité (1 = plus élevée)
   */
  private static getRiskPriority(level: RiskLevel): number {
    const priorityMap: Record<RiskLevel, number> = {
      [RiskLevel.CRITICAL]: 1,
      [RiskLevel.HIGH]: 2,
      [RiskLevel.MEDIUM]: 3,
      [RiskLevel.LOW]: 4,
      [RiskLevel.VERY_LOW]: 5
    };

    return priorityMap[level];
  }

  /**
   * Détermine si le risque nécessite une action immédiate
   */
  private static requiresImmediateAction(level: RiskLevel): boolean {
    return level === RiskLevel.CRITICAL || level === RiskLevel.HIGH;
  }

  /**
   * Valide la probabilité
   */
  private static validateProbability(probability: number): void {
    if (!Number.isInteger(probability) || probability < 1 || probability > 5) {
      throw new Error('La probabilité doit être un entier entre 1 et 5');
    }
  }

  /**
   * Valide l'impact
   */
  private static validateImpact(impact: number): void {
    if (!Number.isInteger(impact) || impact < 1 || impact > 5) {
      throw new Error('L\'impact doit être un entier entre 1 et 5');
    }
  }

  /**
   * Calcule la matrice de risques pour une organisation
   *
   * @param risks - Liste des risques
   * @returns Matrice 5x5 avec comptage des risques
   *
   * @example
   * ```typescript
   * const matrix = RiskCalculationService.calculateRiskMatrix(allRisks);
   * // [[0, 1, 2, 0, 1], [1, 3, 2, 1, 0], ...]
   * ```
   */
  static calculateRiskMatrix(risks: Risk[]): number[][] {
    // Initialiser une matrice 5x5
    const matrix: number[][] = Array(5).fill(0).map(() => Array(5).fill(0));

    // Compter les risques par cellule
    for (const risk of risks) {
      const probIndex = risk.probability - 1; // 0-indexed
      const impactIndex = risk.impact - 1;    // 0-indexed

      if (probIndex >= 0 && probIndex < 5 && impactIndex >= 0 && impactIndex < 5) {
        matrix[probIndex][impactIndex]++;
      }
    }

    return matrix;
  }

  /**
   * Calcule les statistiques des risques
   *
   * @param risks - Liste des risques
   * @returns Statistiques détaillées
   */
  static calculateRiskStatistics(risks: Risk[]): {
    total: number;
    byLevel: Record<RiskLevel, number>;
    byStatus: Record<string, number>;
    averageScore: number;
    topRisks: Risk[];
  } {
    const byLevel: Record<RiskLevel, number> = {
      [RiskLevel.VERY_LOW]: 0,
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.CRITICAL]: 0
    };

    const byStatus: Record<string, number> = {};
    let totalScore = 0;

    for (const risk of risks) {
      const level = this.getRiskLevel(risk.riskLevel);
      byLevel[level]++;

      const status = risk.status || 'Non défini';
      byStatus[status] = (byStatus[status] || 0) + 1;

      totalScore += risk.riskLevel;
    }

    // Top 10 risques
    const topRisks = [...risks]
      .sort((a, b) => b.riskLevel - a.riskLevel)
      .slice(0, 10);

    return {
      total: risks.length,
      byLevel,
      byStatus,
      averageScore: risks.length > 0 ? Math.round(totalScore / risks.length) : 0,
      topRisks
    };
  }

  /**
   * Recommande une stratégie de traitement basée sur le niveau de risque
   *
   * @param level - Niveau de risque
   * @returns Stratégies recommandées
   */
  static recommendTreatmentStrategy(level: RiskLevel): string[] {
    const strategies: Record<RiskLevel, string[]> = {
      [RiskLevel.CRITICAL]: [
        'Atténuer',
        'Traitement immédiat requis',
        'Considérer l\'arrêt de l\'activité si non maîtrisable'
      ],
      [RiskLevel.HIGH]: [
        'Atténuer',
        'Transférer',
        'Traitement prioritaire'
      ],
      [RiskLevel.MEDIUM]: [
        'Atténuer',
        'Accepter avec surveillance',
        'Transférer si coût acceptable'
      ],
      [RiskLevel.LOW]: [
        'Accepter',
        'Surveiller',
        'Atténuer si coût faible'
      ],
      [RiskLevel.VERY_LOW]: [
        'Accepter',
        'Surveillance périodique suffisante'
      ]
    };

    return strategies[level];
  }
}
