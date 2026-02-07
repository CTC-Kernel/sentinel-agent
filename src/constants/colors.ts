/**
 * Centralized color constants for Sentinel GRC
 *
 * HARMONIZED PALETTE - Matches design-tokens.css
 * All colors use consistent hues and reduced saturation (62-72%)
 * for a professional, non-aggressive appearance.
 *
 * Hue Reference:
 * - Primary: 221° (Blue)
 * - Success: 152° (Teal-green)
 * - Warning: 38° (Amber)
 * - Error: 4° (True red)
 * - Info: 201° (Cyan-blue)
 *
 * Use these for JavaScript contexts (charts, canvas, PDF generation).
 * For React components, prefer Tailwind classes or CSS variables.
 */

import { RISK_THRESHOLDS } from './complianceConfig';

// ===== SEMANTIC STATUS COLORS (Harmonized) =====
export const STATUS_COLORS = {
 success: '#2d9d6a', // hsl(152 62% 38%) - Teal-green
 warning: '#c87f1a', // hsl(38 72% 48%) - Amber
 error: '#d64545', // hsl(4 68% 50%) - True red
 info: '#2a8ab8', // hsl(201 68% 44%) - Cyan-blue
} as const;

// Dark mode variants (higher luminosity)
export const STATUS_COLORS_DARK = {
 success: '#4db88a', // hsl(152 58% 52%)
 warning: '#d9a03d', // hsl(38 68% 55%)
 error: '#e06060', // hsl(4 65% 58%)
 info: '#4ba3cc', // hsl(201 65% 52%)
} as const;

// ===== RISK LEVEL COLORS (Harmonized severity scale) =====
export const RISK_COLORS = {
 critical: '#d64545', // hsl(4 68% 50%) - Same as error
 high: '#c87f1a', // hsl(38 72% 48%) - Same as warning
 medium: '#d4a820', // hsl(45 75% 48%) - Yellow-gold
 low: '#2d9d6a', // hsl(152 62% 38%) - Same as success
} as const;

// ===== SCORE COLORS (For gauges & progress) =====
export const SCORE_COLORS = {
 bad: '#d64545', // hsl(4 68% 50%) - Red (< SCORE_BAD_THRESHOLD%)
 warning: '#c87f1a', // hsl(38 72% 48%) - Amber (SCORE_BAD_THRESHOLD-SCORE_WARNING_THRESHOLD%)
 good: '#2d9d6a', // hsl(152 62% 38%) - Teal (> SCORE_WARNING_THRESHOLD%)
} as const;

// ===== CHART PALETTE (Harmonized data visualization) =====
// Ordered for visual distinction while maintaining harmony
export const CHART_COLORS = [
 '#4a7fc7', // Primary blue (hsl 221 55% 54%)
 '#2d9d6a', // Teal-green (success)
 '#9b6dd7', // Purple (hsl 270 55% 64%)
 '#2a8ab8', // Cyan-blue (info)
 '#c87f1a', // Amber (warning)
 '#d64545', // Red (error)
 '#6b8fa3', // Slate-blue (neutral)
 '#7c5cbd', // Violet
] as const;

// Extended palette for more data series
export const CHART_COLORS_EXTENDED = [
 ...CHART_COLORS,
 '#3d8b70', // Dark teal
 '#8c7853', // Bronze
 '#5a7d99', // Steel blue
 '#a85858', // Muted red
] as const;

// ===== SLATE/NEUTRAL COLORS =====
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

// ===== BRAND/PRIMARY COLORS =====
export const BRAND_COLORS = {
 50: '#eff4ff',
 100: '#dbe6fe',
 200: '#bfd3fe',
 300: '#93b8fd',
 400: '#6090f9',
 500: '#4a7fc7', // Primary (hsl 221 55% 54%)
 600: '#3b68b0',
 700: '#31548f',
 800: '#2b4575',
 900: '#273b62',
} as const;

// Utility function to get risk color by score
// Uses centralized thresholds from complianceConfig.ts
export function getRiskColorByScore(score: number): string {
 if (score >= RISK_THRESHOLDS.CRITICAL) return RISK_COLORS.critical;
 if (score >= RISK_THRESHOLDS.HIGH) return RISK_COLORS.high;
 if (score >= RISK_THRESHOLDS.MEDIUM) return RISK_COLORS.medium;
 return RISK_COLORS.low;
}

// Score percentage thresholds
const SCORE_BAD_THRESHOLD = 50;
const SCORE_WARNING_THRESHOLD = 80;

// Utility function to get score color by percentage
export function getScoreColorByPercentage(percentage: number): string {
 if (percentage < SCORE_BAD_THRESHOLD) return SCORE_COLORS.bad;
 if (percentage < SCORE_WARNING_THRESHOLD) return SCORE_COLORS.warning;
 return SCORE_COLORS.good;
}

// Export types for type safety
export type RiskColorKey = keyof typeof RISK_COLORS;
export type ScoreColorKey = keyof typeof SCORE_COLORS;
export type StatusColorKey = keyof typeof STATUS_COLORS;
