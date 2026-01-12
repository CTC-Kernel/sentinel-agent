/**
 * Centralized color constants for Sentinel GRC
 *
 * These values match the CSS variables in design-tokens.css.
 * Use these for JavaScript contexts (charts, canvas, PDF generation).
 * For React components, prefer Tailwind classes or CSS variables.
 */

// Risk Level Colors
export const RISK_COLORS = {
  critical: '#ef4444', // red-500
  high: '#f97316',     // orange-500
  medium: '#eab308',   // yellow-500
  low: '#22c55e',      // green-500
} as const;

// Score Colors (for compliance scores, gauges)
export const SCORE_COLORS = {
  bad: '#ef4444',      // red-500 (< 50%)
  warning: '#f97316',  // orange-500 (50-80%)
  good: '#22c55e',     // green-500 (> 80%)
} as const;

// Status Colors
export const STATUS_COLORS = {
  success: '#10b981',  // emerald-500
  error: '#ef4444',    // red-500
  warning: '#f59e0b',  // amber-500
  info: '#3b82f6',     // blue-500
} as const;

// Chart Colors (for data visualization palettes)
export const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#6366f1', // indigo-500
] as const;

// Slate/Neutral Colors
export const SLATE_COLORS = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
} as const;

// Brand Colors
export const BRAND_COLORS = {
  50: '#eef2ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
} as const;

// Utility function to get risk color by score
export function getRiskColorByScore(score: number): string {
  if (score >= 15) return RISK_COLORS.critical;
  if (score >= 10) return RISK_COLORS.high;
  if (score >= 5) return RISK_COLORS.medium;
  return RISK_COLORS.low;
}

// Utility function to get score color by percentage
export function getScoreColorByPercentage(percentage: number): string {
  if (percentage < 50) return SCORE_COLORS.bad;
  if (percentage < 80) return SCORE_COLORS.warning;
  return SCORE_COLORS.good;
}

// Export types for type safety
export type RiskColorKey = keyof typeof RISK_COLORS;
export type ScoreColorKey = keyof typeof SCORE_COLORS;
export type StatusColorKey = keyof typeof STATUS_COLORS;
