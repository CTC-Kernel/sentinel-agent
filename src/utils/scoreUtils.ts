/**
 * Score Utility Functions
 * Color coding and helper functions for compliance score display
 * Implements ADR-003: Score de Conformité Global
 */

export type ScoreLevel = 'critical' | 'warning' | 'good';

/**
 * Score thresholds for color coding
 */
export const SCORE_THRESHOLDS = {
  CRITICAL: 50,   // Below this is red
  WARNING: 75,    // Below this is orange, above is green
  PULSE: 30,      // Below this triggers pulse animation
} as const;

/**
 * Get the score level based on value
 * @param score - Score value (0-100)
 * @returns ScoreLevel classification
 */
export function getScoreLevel(score: number): ScoreLevel {
  if (score < SCORE_THRESHOLDS.CRITICAL) return 'critical';
  if (score <= SCORE_THRESHOLDS.WARNING) return 'warning';
  return 'good';
}

/**
 * Get Tailwind text color class for a score
 * @param score - Score value (0-100)
 * @returns Tailwind CSS class for text color
 */
export function getScoreTextColor(score: number): string {
  const level = getScoreLevel(score);
  switch (level) {
    case 'critical':
      return 'text-red-500';
    case 'warning':
      return 'text-orange-500';
    case 'good':
      return 'text-green-500';
  }
}

/**
 * Get Tailwind stroke color class for a score (SVG)
 * @param score - Score value (0-100)
 * @returns Tailwind CSS class for stroke color
 */
export function getScoreStrokeColor(score: number): string {
  const level = getScoreLevel(score);
  switch (level) {
    case 'critical':
      return 'stroke-red-500';
    case 'warning':
      return 'stroke-orange-500';
    case 'good':
      return 'stroke-green-500';
  }
}

/**
 * Get Tailwind background color class for a score
 * @param score - Score value (0-100)
 * @returns Tailwind CSS class for background color
 */
export function getScoreBgColor(score: number): string {
  const level = getScoreLevel(score);
  switch (level) {
    case 'critical':
      return 'bg-red-500';
    case 'warning':
      return 'bg-orange-500';
    case 'good':
      return 'bg-green-500';
  }
}

/**
 * Get Tailwind light background color class for a score (for cards/badges)
 * @param score - Score value (0-100)
 * @returns Tailwind CSS class for light background color
 */
export function getScoreBgLightColor(score: number): string {
  const level = getScoreLevel(score);
  switch (level) {
    case 'critical':
      return 'bg-red-50 dark:bg-red-950';
    case 'warning':
      return 'bg-orange-50 dark:bg-orange-950';
    case 'good':
      return 'bg-green-50 dark:bg-green-950';
  }
}

/**
 * Get hex color for a score (useful for charts)
 * @param score - Score value (0-100)
 * @returns Hex color string
 */
export function getScoreHexColor(score: number): string {
  const level = getScoreLevel(score);
  switch (level) {
    case 'critical':
      return '#ef4444'; // red-500
    case 'warning':
      return '#f97316'; // orange-500
    case 'good':
      return '#22c55e'; // green-500
  }
}

/**
 * Get human-readable status label for a score
 * @param score - Score value (0-100)
 * @param locale - Language code ('fr' or 'en')
 * @returns Human-readable status string
 */
export function getScoreStatusLabel(score: number, locale: 'fr' | 'en' = 'fr'): string {
  const level = getScoreLevel(score);

  const labels = {
    critical: { fr: 'Critique', en: 'Critical' },
    warning: { fr: 'À améliorer', en: 'Needs Improvement' },
    good: { fr: 'Bon', en: 'Good' },
  };

  return labels[level][locale];
}

/**
 * Check if score should trigger critical pulse animation
 * @param score - Score value (0-100)
 * @returns true if score is below pulse threshold
 */
export function isScoreCritical(score: number): boolean {
  return score < SCORE_THRESHOLDS.PULSE;
}

/**
 * Normalize score to 0-100 range
 * @param score - Raw score value
 * @returns Normalized score between 0 and 100
 */
export function normalizeScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

/**
 * Format score for display with optional decimal places
 * @param score - Score value
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted score string
 */
export function formatScore(score: number, decimals: number = 0): string {
  return normalizeScore(score).toFixed(decimals);
}
