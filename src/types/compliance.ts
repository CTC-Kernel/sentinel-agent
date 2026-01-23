/**
 * Compliance Scoring Types
 *
 * Types for the Compliance Dashboard & Scoring Engine.
 * Supports real-time score calculation with weighted criticality.
 *
 * @see ADR-003 in architecture-european-leader-2026-01-22.md
 */

import type { Timestamp } from 'firebase/firestore';
import type { RegulatoryFrameworkCode, CriticalityLevel } from './framework';

// ============================================================================
// Score Status & Thresholds
// ============================================================================

/**
 * Score status based on thresholds
 * green: >= 75, orange: 50-74, red: < 50
 */
export const SCORE_STATUSES = ['green', 'orange', 'red'] as const;
export type ScoreStatus = (typeof SCORE_STATUSES)[number];

/**
 * Score thresholds for status determination
 */
export const SCORE_THRESHOLDS = {
  green: 75,
  orange: 50,
} as const;

/**
 * Get score status from numeric score
 */
export function getScoreStatus(score: number): ScoreStatus {
  if (score >= SCORE_THRESHOLDS.green) return 'green';
  if (score >= SCORE_THRESHOLDS.orange) return 'orange';
  return 'red';
}

// ============================================================================
// Compliance Score Entity
// ============================================================================

/**
 * Compliance Score for a framework
 * Stored in Firestore: `complianceScores/{orgId}_{frameworkId}`
 *
 * Scores are denormalized for fast reads and recalculated via Cloud Function
 * triggers when assessments are updated.
 */
export interface ComplianceScore {
  /** Firestore document ID (format: orgId_frameworkId) */
  id: string;

  /** Organization ID */
  organizationId: string;

  /** Framework ID */
  frameworkId: string;

  /** Framework code (denormalized) */
  frameworkCode: RegulatoryFrameworkCode;

  /** Overall compliance score (0-100) */
  score: number;

  /** Score status based on thresholds */
  status: ScoreStatus;

  /** Breakdown by requirement category */
  categoryBreakdown: CategoryScore[];

  /** Breakdown by criticality level */
  criticalityBreakdown: CriticalityBreakdown;

  /** Total requirements in this framework */
  totalRequirements: number;

  /** Requirements with full coverage */
  fullyCompliant: number;

  /** Requirements with partial coverage */
  partiallyCompliant: number;

  /** Requirements with no coverage */
  nonCompliant: number;

  /** Requirements not yet assessed */
  notAssessed: number;

  /** Score trend (change from previous period) */
  trend?: ScoreTrend;

  /** When the score was last calculated */
  calculatedAt: Timestamp | string;

  /** Last updated timestamp */
  updatedAt?: Timestamp | string;
}

/**
 * Score breakdown by requirement category
 */
export interface CategoryScore {
  /** Category identifier */
  category: string;

  /** Category display label */
  categoryLabel: string;

  /** Score for this category (0-100) */
  score: number;

  /** Score status */
  status: ScoreStatus;

  /** Number of requirements in category */
  requirementCount: number;

  /** Number of compliant requirements */
  compliantCount: number;
}

/**
 * Score breakdown by criticality level
 */
export interface CriticalityBreakdown {
  high: {
    total: number;
    compliant: number;
    score: number;
  };
  medium: {
    total: number;
    compliant: number;
    score: number;
  };
  low: {
    total: number;
    compliant: number;
    score: number;
  };
}

/**
 * Score trend information
 */
export interface ScoreTrend {
  /** Change from previous period */
  change: number;

  /** Direction of change */
  direction: 'up' | 'down' | 'stable';

  /** Previous score */
  previousScore: number;

  /** When the previous score was recorded */
  previousDate: Timestamp | string;

  /** Period for comparison (e.g., '30d', '7d') */
  period: string;
}

// ============================================================================
// Score History
// ============================================================================

/**
 * Historical score snapshot for trend charts
 * Stored in Firestore: `complianceScores/{scoreId}/history/{snapshotId}`
 */
export interface ScoreSnapshot {
  /** Snapshot ID */
  id: string;

  /** Score at this point in time */
  score: number;

  /** Score status */
  status: ScoreStatus;

  /** When the snapshot was taken */
  snapshotAt: Timestamp | string;

  /** Category scores at this time */
  categoryScores?: Record<string, number>;
}

/**
 * Score history for a framework (aggregated)
 */
export interface ScoreHistory {
  /** Framework ID */
  frameworkId: string;

  /** Data points for chart */
  dataPoints: {
    date: string;
    score: number;
    status: ScoreStatus;
  }[];

  /** Period covered */
  period: '7d' | '30d' | '90d' | '1y';

  /** Min/max/avg for the period */
  stats: {
    min: number;
    max: number;
    avg: number;
    current: number;
  };
}

// ============================================================================
// Overall Compliance Status
// ============================================================================

/**
 * Overall compliance status across all active frameworks
 */
export interface OverallComplianceStatus {
  /** Organization ID */
  organizationId: string;

  /** Overall weighted score across all frameworks */
  overallScore: number;

  /** Overall status */
  overallStatus: ScoreStatus;

  /** Number of active frameworks */
  activeFrameworks: number;

  /** Scores per framework */
  frameworkScores: {
    frameworkId: string;
    frameworkCode: RegulatoryFrameworkCode;
    frameworkName: string;
    score: number;
    status: ScoreStatus;
  }[];

  /** Overall trend */
  trend?: ScoreTrend;

  /** When this status was calculated */
  calculatedAt: Timestamp | string;
}

// ============================================================================
// Priority Actions
// ============================================================================

/**
 * Action impact level
 */
export const ACTION_IMPACTS = ['high', 'medium', 'low'] as const;
export type ActionImpact = (typeof ACTION_IMPACTS)[number];

/**
 * Suggested action for improving compliance
 */
export interface ComplianceAction {
  /** Action ID */
  id: string;

  /** Action title */
  title: string;

  /** Action description */
  description: string;

  /** Affected framework */
  frameworkId: string;

  /** Framework code */
  frameworkCode: RegulatoryFrameworkCode;

  /** Affected requirement (if specific) */
  requirementId?: string;

  /** Related control (if exists) */
  controlId?: string;

  /** Impact on score if completed */
  impact: ActionImpact;

  /** Estimated score improvement (points) */
  scoreImprovement: number;

  /** Priority order */
  priority: number;

  /** Action type */
  actionType: 'create_control' | 'update_assessment' | 'add_evidence' | 'complete_mapping';

  /** Navigation link */
  link: string;

  /** Criticality of affected requirement */
  criticality: CriticalityLevel;
}

/**
 * Priority actions list for dashboard
 */
export interface PriorityActionsList {
  /** Organization ID */
  organizationId: string;

  /** List of prioritized actions */
  actions: ComplianceAction[];

  /** When this list was generated */
  generatedAt: Timestamp | string;

  /** Total potential score improvement */
  totalPotentialImprovement: number;
}

// ============================================================================
// Assessment Types
// ============================================================================

/**
 * Assessment status for a control against a requirement
 */
export const ASSESSMENT_STATUSES = [
  'not_started',
  'in_progress',
  'compliant',
  'partially_compliant',
  'non_compliant',
  'not_applicable',
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

/**
 * Assessment score mapping
 */
export const ASSESSMENT_SCORES: Record<AssessmentStatus, number> = {
  not_started: 0,
  in_progress: 25,
  partially_compliant: 50,
  compliant: 100,
  non_compliant: 0,
  not_applicable: -1, // Excluded from calculation
};

/**
 * Control Assessment against a requirement
 * Used for score calculation
 */
export interface ControlAssessment {
  /** Assessment ID */
  id: string;

  /** Organization ID */
  organizationId: string;

  /** Control ID */
  controlId: string;

  /** Requirement ID */
  requirementId: string;

  /** Framework ID */
  frameworkId: string;

  /** Assessment status */
  status: AssessmentStatus;

  /** Score derived from status (0-100, or -1 for N/A) */
  score: number;

  /** Criticality of the requirement (denormalized) */
  criticality: CriticalityLevel;

  /** Evidence supporting this assessment */
  evidenceIds?: string[];

  /** Notes about the assessment */
  notes?: string;

  /** Who performed the assessment */
  assessedBy?: string;

  /** When the assessment was performed */
  assessedAt?: Timestamp | string;

  /** Next review date */
  nextReviewDate?: Timestamp | string;

  /** Last updated */
  updatedAt?: Timestamp | string;

  /** Created timestamp */
  createdAt?: Timestamp | string;
}

// ============================================================================
// Scoring Engine Types
// ============================================================================

/**
 * Input for score calculation
 */
export interface ScoreCalculationInput {
  /** Framework ID to calculate for */
  frameworkId: string;

  /** Organization ID */
  organizationId: string;

  /** Assessments for this framework */
  assessments: ControlAssessment[];

  /** Requirements with their criticality */
  requirements: {
    id: string;
    criticality: CriticalityLevel;
    category: string;
  }[];
}

/**
 * Output from score calculation
 */
export interface ScoreCalculationResult {
  /** Overall score (0-100) */
  score: number;

  /** Status based on thresholds */
  status: ScoreStatus;

  /** Category breakdown */
  categoryBreakdown: CategoryScore[];

  /** Criticality breakdown */
  criticalityBreakdown: CriticalityBreakdown;

  /** Counts */
  counts: {
    total: number;
    fullyCompliant: number;
    partiallyCompliant: number;
    nonCompliant: number;
    notAssessed: number;
    notApplicable: number;
  };

  /** Calculation timestamp */
  calculatedAt: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid score status
 */
export function isScoreStatus(value: unknown): value is ScoreStatus {
  return typeof value === 'string' && SCORE_STATUSES.includes(value as ScoreStatus);
}

/**
 * Check if a string is a valid assessment status
 */
export function isAssessmentStatus(value: unknown): value is AssessmentStatus {
  return typeof value === 'string' && ASSESSMENT_STATUSES.includes(value as AssessmentStatus);
}
