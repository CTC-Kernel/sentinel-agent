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
 * Default weights: controls 40%, risks 30%, audits 20%, docs 10%
 */
export interface ScoreBreakdown {
  risks: CategoryScore;
  controls: CategoryScore;
  documents: CategoryScore;
  audits: CategoryScore;
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
}

/**
 * Default weights for score calculation
 */
export const DEFAULT_SCORE_WEIGHTS = {
  controls: 0.40,
  risks: 0.30,
  audits: 0.20,
  documents: 0.10,
} as const;

/**
 * Trend threshold percentage
 */
export const TREND_THRESHOLD = 5;
