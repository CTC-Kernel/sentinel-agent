/**
 * KPI Configuration
 * Defines KPI cards for executive dashboard (ADR-004)
 * Uses simple French labels without technical/ISO jargon (FR7)
 */

import type { TrendType } from '../types/score.types';

/**
 * KPI types available for dashboard
 */
export type KPIType = 'score_global' | 'risques_critiques' | 'audits_en_cours';

/**
 * Color scheme for KPI cards based on status
 */
export type KPIColorScheme = 'success' | 'warning' | 'danger' | 'neutral';

/**
 * KPI configuration definition
 */
export interface KPIDefinition {
  /** Unique identifier */
  id: KPIType;
  /** Simple French label (no jargon) */
  title: string;
  /** Technical name for data fetching */
  technicalKey: string;
  /** Subtitle template with placeholder for dynamic value */
  subtitleTemplate: string;
  /** i18n key for future multilingual support */
  i18nKey: string;
  /** Icon name (optional) */
  icon?: string;
  /** Description for accessibility */
  description: string;
}

/**
 * KPI definitions with simple language labels
 * Per FR7: "Les dirigeants peuvent voir les 3 KPIs critiques sans jargon technique"
 */
export const KPI_DEFINITIONS: Record<KPIType, KPIDefinition> = {
  score_global: {
    id: 'score_global',
    title: 'Sante Conformite',
    technicalKey: 'complianceScore.global',
    subtitleTemplate: 'Score global de securite',
    i18nKey: 'kpi.score_global',
    icon: 'shield-check',
    description: 'Score de conformite global de 0 a 100',
  },
  risques_critiques: {
    id: 'risques_critiques',
    title: 'Points d\'Attention',
    technicalKey: 'risks.critical.count',
    subtitleTemplate: '{count} necessite(nt) votre attention',
    i18nKey: 'kpi.risques_critiques',
    icon: 'alert-triangle',
    description: 'Nombre de risques critiques a traiter',
  },
  audits_en_cours: {
    id: 'audits_en_cours',
    title: 'Controles Actifs',
    technicalKey: 'audits.in_progress.count',
    subtitleTemplate: '{count} verification(s) en cours',
    i18nKey: 'kpi.audits_en_cours',
    icon: 'clipboard-check',
    description: 'Nombre d\'audits actuellement en cours',
  },
};

/**
 * Thresholds for determining KPI color scheme
 */
export const KPI_THRESHOLDS = {
  score_global: {
    danger: 50,    // Below 50: danger (red)
    warning: 75,   // 50-75: warning (orange)
    // Above 75: success (green)
  },
  risques_critiques: {
    success: 0,    // 0: success (green)
    warning: 3,    // 1-3: warning (orange)
    // Above 3: danger (red)
  },
  audits_en_cours: {
    // No color coding for audits - always neutral
    neutral: true,
  },
} as const;

/**
 * Get color scheme for a KPI based on its value
 * @param kpiType - The type of KPI
 * @param value - The current value
 * @returns The appropriate color scheme
 */
export function getKPIColorScheme(kpiType: KPIType, value: number): KPIColorScheme {
  switch (kpiType) {
    case 'score_global':
      if (value < KPI_THRESHOLDS.score_global.danger) return 'danger';
      if (value <= KPI_THRESHOLDS.score_global.warning) return 'warning';
      return 'success';

    case 'risques_critiques':
      if (value === KPI_THRESHOLDS.risques_critiques.success) return 'success';
      if (value <= KPI_THRESHOLDS.risques_critiques.warning) return 'warning';
      return 'danger';

    case 'audits_en_cours':
      return 'neutral';

    default:
      return 'neutral';
  }
}

/**
 * Get Tailwind classes for KPI color scheme
 */
export const KPI_COLOR_CLASSES: Record<KPIColorScheme, {
  bg: string;
  bgLight: string;
  text: string;
  border: string;
  badge: string;
}> = {
  success: {
    bg: 'bg-green-500',
    bgLight: 'bg-green-50 dark:bg-green-950',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    badge: 'bg-green-500 text-white',
  },
  warning: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-50 dark:bg-orange-950',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-500 text-white',
  },
  danger: {
    bg: 'bg-red-500',
    bgLight: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-500 text-white',
  },
  neutral: {
    bg: 'bg-gray-500',
    bgLight: 'bg-gray-50 dark:bg-gray-900',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
    badge: 'bg-gray-500 text-white',
  },
};

/**
 * Get trend label for accessibility
 * @param trend - The trend direction
 * @param value - Optional percentage change
 * @returns Accessible label
 */
export function getTrendLabel(trend: TrendType, value?: number): string {
  const percentage = value !== undefined ? ` de ${Math.abs(value)}%` : '';

  switch (trend) {
    case 'up':
      return `En hausse${percentage}`;
    case 'down':
      return `En baisse${percentage}`;
    case 'stable':
      return 'Stable';
  }
}

/**
 * Executive KPIs in display order
 */
export const EXECUTIVE_KPIS: KPIType[] = [
  'score_global',
  'risques_critiques',
  'audits_en_cours',
];
