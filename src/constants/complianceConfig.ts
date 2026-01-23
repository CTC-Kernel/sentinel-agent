/**
 * Compliance Configuration Constants
 * Centralized definitions for compliance score calculations
 * Used by both frontend and Cloud Functions (via shared export)
 *
 * @see ADR-003: Score de Conformité Global
 */

// ============================================================================
// CONTROL STATUSES
// ============================================================================

export const CONTROL_STATUS = {
  IMPLEMENTED: 'Implémenté',
  PARTIAL: 'Partiel',
  IN_PROGRESS: 'En cours',
  NOT_STARTED: 'Non commencé',
  PLANNED: 'Planifié',
  NOT_APPLICABLE: 'Non applicable',
  EXCLUDED: 'Exclu',
} as const;

export type ControlStatus = typeof CONTROL_STATUS[keyof typeof CONTROL_STATUS];

/**
 * Statuses that count toward actionable controls
 * Excludes: 'Non applicable' and 'Exclu'
 */
export const ACTIONABLE_STATUSES: ControlStatus[] = [
  CONTROL_STATUS.IMPLEMENTED,
  CONTROL_STATUS.PARTIAL,
  CONTROL_STATUS.IN_PROGRESS,
  CONTROL_STATUS.NOT_STARTED,
  CONTROL_STATUS.PLANNED,
];

/**
 * Statuses excluded from actionable controls count
 */
export const EXCLUDED_STATUSES: ControlStatus[] = [
  CONTROL_STATUS.NOT_APPLICABLE,
  CONTROL_STATUS.EXCLUDED,
];

// ============================================================================
// SCORE WEIGHTS
// ============================================================================

/**
 * Partial control weight for score calculation
 * A partial control counts as 50% of a fully implemented control
 */
export const PARTIAL_CONTROL_WEIGHT = 0.5;

/**
 * Category weights for global compliance score
 */
export const COMPLIANCE_WEIGHTS = {
  controls: 0.40,
  risks: 0.30,
  audits: 0.20,
  documents: 0.10,
} as const;

// ============================================================================
// RISK THRESHOLDS
// ============================================================================

/**
 * Risk score thresholds for criticality levels
 * Score = Probability × Impact (1-25 scale)
 */
export const RISK_THRESHOLDS = {
  CRITICAL: 15,  // score >= 15
  HIGH: 10,      // score >= 10 && < 15
  MEDIUM: 5,     // score >= 5 && < 10
  LOW: 0,        // score < 5
} as const;

/**
 * Get risk criticality level from score
 */
export function getRiskCriticality(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= RISK_THRESHOLDS.CRITICAL) return 'critical';
  if (score >= RISK_THRESHOLDS.HIGH) return 'high';
  if (score >= RISK_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

// ============================================================================
// TREND CONFIGURATION
// ============================================================================

/**
 * Threshold percentage for trend calculation
 * Difference must exceed this value to show up/down trend
 */
export const TREND_THRESHOLD = 5;

// ============================================================================
// SCORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate controls compliance score
 * Formula: (Implemented + (Partial × 0.5)) / Actionable × 100
 *
 * @param implemented - Number of implemented controls
 * @param partial - Number of partial controls
 * @param actionable - Total actionable controls (excludes N/A and Excluded)
 * @returns Score from 0-100 with 2 decimal precision
 */
export function calculateControlsScore(
  implemented: number,
  partial: number,
  actionable: number
): number {
  if (actionable === 0) return 100;
  const score = ((implemented + (partial * PARTIAL_CONTROL_WEIGHT)) / actionable) * 100;
  return Math.round(score * 100) / 100;
}

/**
 * Calculate risk score component for compliance
 * Formula: (1 - (Critical / Total)) × 100
 *
 * @param critical - Number of critical risks (score >= 15)
 * @param total - Total number of risks
 * @returns Score from 0-100 with 2 decimal precision
 */
export function calculateRiskScore(critical: number, total: number): number {
  if (total === 0) return 100;
  const score = (1 - (critical / total)) * 100;
  return Math.round(score * 100) / 100;
}

/**
 * Calculate global compliance score from breakdown
 */
export function calculateGlobalScore(breakdown: {
  controls: number;
  risks: number;
  audits: number;
  documents: number;
}): number {
  const score =
    breakdown.controls * COMPLIANCE_WEIGHTS.controls +
    breakdown.risks * COMPLIANCE_WEIGHTS.risks +
    breakdown.audits * COMPLIANCE_WEIGHTS.audits +
    breakdown.documents * COMPLIANCE_WEIGHTS.documents;
  return Math.round(score * 100) / 100;
}

/**
 * Check if a control status is actionable
 */
export function isActionableStatus(status: string): boolean {
  return ACTIONABLE_STATUSES.includes(status as ControlStatus);
}

/**
 * Check if a control status is excluded from calculations
 */
export function isExcludedStatus(status: string): boolean {
  return EXCLUDED_STATUSES.includes(status as ControlStatus);
}
