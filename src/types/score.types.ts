/**
 * Score de Conformité Global - Types (ADR-003)
 * Apple Health Style Score System
 */

/**
 * Type for trend direction based on 30-day average comparison
 * - 'up': current score > 30-day avg + 5%
 * - 'down': current score < 30-day avg - 5%
 * - 'stable': within ±5% of 30-day average
 */
export type TrendType = 'up' | 'down' | 'stable';

/**
 * Category score with its weight in the global calculation
 */
export interface CategoryScore {
  /** Score for this category (0-100) */
  score: number;
  /** Weight applied in global score calculation (0-1) */
  weight: number;
}

/**
 * Breakdown of scores by category
 * Updated weights (NIS2-TRN-011): controls 35%, risks 25%, audits 20%, docs 10%, training 10%
 */
export interface ScoreBreakdown {
  risks: CategoryScore;
  controls: CategoryScore;
  documents: CategoryScore;
  audits: CategoryScore;
  training?: CategoryScore; // NIS2 Art. 21.2(g) - Formation & Sensibilisation
}

/**
 * Scores by compliance framework
 */
export interface FrameworkScores {
  iso27001: number;
  nis2: number;
  dora: number;
  rgpd: number;
}

/**
 * Details of the calculation for transparency
 */
export interface CalculationDetails {
  totalRisks: number;
  criticalRisks: number;
  implementedControls: number;
  actionableControls: number;
  validDocuments: number;
  totalDocuments: number;
  compliantFindings: number;
  totalFindings: number;
  // NIS2 Art. 21.2(g) - Training & Awareness
  completedTrainings?: number;
  totalTrainings?: number;
}

/**
 * Main ComplianceScore interface (ADR-003)
 * Stored at: organizations/{organizationId}/complianceScores/current
 */
export interface ComplianceScore {
  /** Global compliance score (0-100) */
  global: number;
  /** Scores broken down by framework */
  byFramework: FrameworkScores;
  /** Trend direction based on 30-day comparison */
  trend: TrendType;
  /** Timestamp of last calculation */
  lastCalculated: Date | string;
  /** Breakdown by category with weights */
  breakdown: ScoreBreakdown;
  /** Raw calculation details for transparency */
  calculationDetails?: CalculationDetails;
}

/**
 * Historical score entry for trend tracking
 * Stored at: organizations/{organizationId}/complianceScores/current/history/{YYYY-MM-DD}
 */
export interface ScoreHistory {
  /** Date of this historical entry (YYYY-MM-DD format) */
  date: string;
  /** Global score at this date */
  global: number;
  /** Optional framework breakdown at this date */
  byFramework?: FrameworkScores;
  /** Optional category breakdown at this date */
  breakdown?: ScoreBreakdown;
}

/**
 * Result from useComplianceScore hook
 */
export interface ComplianceScoreHookResult {
  /** Current compliance score data */
  score: ComplianceScore | null;
  /** Category breakdown */
  breakdown: ScoreBreakdown | null;
  /** Current trend direction */
  trend: TrendType | null;
  /** Historical scores for charting */
  history: ScoreHistory[];
  /** Loading state */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Function to manually trigger a refetch */
  refetch: () => void;
}

/**
 * Default weights for score calculation
 * NIS2-TRN-011: Updated to include training (Art. 21.2g)
 */
export const DEFAULT_SCORE_WEIGHTS = {
  controls: 0.35,   // Was 0.40 - reduced to include training
  risks: 0.25,      // Was 0.30 - reduced to include training
  audits: 0.20,     // Unchanged
  documents: 0.10,  // Unchanged
  training: 0.10,   // NEW: NIS2 Article 21.2(g)
} as const;

/**
 * Trend threshold percentage
 */
export const TREND_THRESHOLD = 5;
