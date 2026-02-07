/**
 * Color scheme utilities for dashboard widgets
 * 
 * Extracted from hook files to satisfy the convention that
 * only hooks (use*) are exported from /hooks/ directory.
 * 
 * @module utils/colorSchemes
 */

import type { Criticality } from '../types/common';
import { RISK_THRESHOLDS } from '../constants/complianceConfig';
import i18n from '../i18n';

// ============================================================================
// Severity Color Scheme (from useActiveIncidents)
// ============================================================================

/**
 * Get severity color scheme
 */
export function getSeverityColorScheme(
 severity: Criticality
): 'danger' | 'warning' | 'caution' | 'success' {
 switch (severity) {
 case 'Critique':
 return 'danger';
 case 'Elevee':
 return 'warning';
 case 'Moyenne':
 return 'caution';
 case 'Faible':
 default:
 return 'success';
 }
}

/**
 * Get Tailwind classes for severity color
 */
export const SEVERITY_COLOR_CLASSES = {
 danger: {
 bg: 'bg-red-100 dark:bg-red-900/30',
 text: 'text-red-800 dark:text-red-200',
 border: 'border-red-200 dark:border-red-800',
 badge: 'bg-red-500 text-white',
 },
 warning: {
 bg: 'bg-orange-100 dark:bg-orange-900/30',
 text: 'text-orange-800 dark:text-orange-200',
 border: 'border-orange-200 dark:border-orange-800',
 badge: 'bg-orange-500 text-white',
 },
 caution: {
 bg: 'bg-yellow-100 dark:bg-yellow-900/30',
 text: 'text-yellow-800 dark:text-yellow-200',
 border: 'border-yellow-200 dark:border-yellow-800',
 badge: 'bg-warning text-warning-foreground',
 },
 success: {
 bg: 'bg-green-100 dark:bg-green-900/30',
 text: 'text-green-800 dark:text-green-200',
 border: 'border-green-200 dark:border-green-800',
 badge: 'bg-green-500 text-white',
 },
} as const;

// ============================================================================
// Due Status Color Scheme (from useAssignedActions)
// ============================================================================

/**
 * Get due status color scheme
 */
export function getDueStatusColorScheme(
 isOverdue: boolean,
 isDueSoon: boolean
): 'danger' | 'warning' | 'neutral' {
 if (isOverdue) return 'danger';
 if (isDueSoon) return 'warning';
 return 'neutral';
}

/**
 * Get Tailwind classes for due status color
 */
export const DUE_STATUS_COLOR_CLASSES = {
 danger: {
 bg: 'bg-red-100 dark:bg-red-900/30',
 text: 'text-red-600 dark:text-red-400',
 border: 'border-red-200 dark:border-red-800',
 badge: 'bg-red-500 text-white',
 },
 warning: {
 bg: 'bg-orange-100 dark:bg-orange-900/30',
 text: 'text-orange-600 dark:text-orange-400',
 border: 'border-orange-200 dark:border-orange-800',
 badge: 'bg-orange-500 text-white',
 },
 neutral: {
 bg: 'bg-muted',
 text: 'text-muted-foreground',
 border: 'border-border',
 badge: 'bg-muted/500 text-white',
 },
} as const;

// ============================================================================
// Overdue Severity Color Scheme (from useOverdueActions)
// ============================================================================

/**
 * Get overdue severity color scheme
 */
export function getOverdueSeverityColorScheme(
 daysOverdue: number
): 'critical' | 'high' | 'medium' {
 if (daysOverdue >= 14) return 'critical';
 if (daysOverdue >= 7) return 'high';
 return 'medium';
}

/**
 * Get Tailwind classes for overdue severity
 */
export const OVERDUE_SEVERITY_COLOR_CLASSES = {
 critical: {
 bg: 'bg-red-100 dark:bg-red-900/30',
 text: 'text-red-700 dark:text-red-300',
 border: 'border-red-300 dark:border-red-700',
 badge: 'bg-red-600 text-white',
 },
 high: {
 bg: 'bg-red-50 dark:bg-red-900/20',
 text: 'text-red-600 dark:text-red-400',
 border: 'border-red-200 dark:border-red-800',
 badge: 'bg-red-500 text-white',
 },
 medium: {
 bg: 'bg-orange-50 dark:bg-orange-900/20',
 text: 'text-orange-600 dark:text-orange-400',
 border: 'border-orange-200 dark:border-orange-800',
 badge: 'bg-orange-500 text-white',
 },
} as const;

// ============================================================================
// Criticality Color Scheme (from useCriticalRisksList)
// ============================================================================

/**
 * Get criticality color scheme based on criticality score
 */
export function getCriticalityColorScheme(
 criticality: number
): 'danger' | 'warning' | 'caution' | 'success' {
 if (criticality >= RISK_THRESHOLDS.CRITICAL) return 'danger';
 if (criticality >= RISK_THRESHOLDS.HIGH) return 'warning';
 if (criticality >= RISK_THRESHOLDS.MEDIUM) return 'caution';
 return 'success';
}

/**
 * Get Tailwind classes for criticality color
 */
export const CRITICALITY_COLOR_CLASSES = {
 danger: {
 bg: 'bg-red-100 dark:bg-red-900/30',
 text: 'text-red-800 dark:text-red-200',
 border: 'border-red-200 dark:border-red-800',
 badge: 'bg-red-500 text-white',
 },
 warning: {
 bg: 'bg-orange-100 dark:bg-orange-900/30',
 text: 'text-orange-800 dark:text-orange-200',
 border: 'border-orange-200 dark:border-orange-800',
 badge: 'bg-orange-500 text-white',
 },
 caution: {
 bg: 'bg-yellow-100 dark:bg-yellow-900/30',
 text: 'text-yellow-800 dark:text-yellow-200',
 border: 'border-yellow-200 dark:border-yellow-800',
 badge: 'bg-warning text-warning-foreground',
 },
 success: {
 bg: 'bg-green-100 dark:bg-green-900/30',
 text: 'text-green-800 dark:text-green-200',
 border: 'border-green-200 dark:border-green-800',
 badge: 'bg-green-500 text-white',
 },
} as const;

// ============================================================================
// Progress Color Scheme (from useProjectProgress)
// ============================================================================

/**
 * Get progress color scheme based on percentage
 */
export function getProgressColorScheme(
 percentage: number
): 'excellent' | 'good' | 'warning' | 'critical' {
 if (percentage >= 80) return 'excellent';
 if (percentage >= 60) return 'good';
 if (percentage >= 40) return 'warning';
 return 'critical';
}

/**
 * Get Tailwind classes for progress color
 */
export const PROGRESS_COLOR_CLASSES = {
 excellent: {
 bg: 'bg-green-500',
 bgLight: 'bg-green-100 dark:bg-green-900/30',
 text: 'text-green-600 dark:text-green-400',
 border: 'border-green-200 dark:border-green-800',
 },
 good: {
 bg: 'bg-blue-500',
 bgLight: 'bg-blue-100 dark:bg-blue-900/30',
 text: 'text-blue-600 dark:text-blue-400',
 border: 'border-blue-200 dark:border-blue-800',
 },
 warning: {
 bg: 'bg-orange-500',
 bgLight: 'bg-orange-100 dark:bg-orange-900/30',
 text: 'text-orange-600 dark:text-orange-400',
 border: 'border-orange-200 dark:border-orange-800',
 },
 critical: {
 bg: 'bg-red-500',
 bgLight: 'bg-red-100 dark:bg-red-900/30',
 text: 'text-red-600 dark:text-red-400',
 border: 'border-red-200 dark:border-red-800',
 },
} as const;

// ============================================================================
// Urgency Color Scheme (from useUpcomingDeadlines)
// ============================================================================

/**
 * Get urgency color scheme based on days until due
 */
export function getUrgencyColorScheme(
 daysUntilDue: number,
 isOverdue: boolean
): 'danger' | 'warning' | 'normal' {
 if (isOverdue) return 'danger';
 if (daysUntilDue <= 7) return 'warning';
 return 'normal';
}

/**
 * Get Tailwind classes for urgency color
 */
export const URGENCY_COLOR_CLASSES = {
 danger: {
 bg: 'bg-red-100 dark:bg-red-900/30',
 text: 'text-red-600 dark:text-red-400',
 border: 'border-red-200 dark:border-red-800',
 badge: 'bg-red-500 text-white',
 dot: 'bg-red-500',
 },
 warning: {
 bg: 'bg-orange-100 dark:bg-orange-900/30',
 text: 'text-orange-600 dark:text-orange-400',
 border: 'border-orange-200 dark:border-orange-800',
 badge: 'bg-orange-500 text-white',
 dot: 'bg-orange-500',
 },
 normal: {
 bg: 'bg-blue-50 dark:bg-blue-900/20',
 text: 'text-blue-600 dark:text-blue-400',
 border: 'border-blue-200 dark:border-blue-800',
 badge: 'bg-blue-500 text-white',
 dot: 'bg-blue-500',
 },
} as const;

export type TimelineItemType = 'action' | 'milestone' | 'audit' | 'document';

/**
 * Get label for timeline item type
 */
export function getTimelineItemTypeLabel(type: TimelineItemType): string {
 switch (type) {
 case 'action':
 return i18n.t('deadlines.itemType.action', { defaultValue: 'Action' });
 case 'milestone':
 return i18n.t('deadlines.itemType.milestone', { defaultValue: 'Milestone' });
 case 'audit':
 return i18n.t('deadlines.itemType.audit', { defaultValue: 'Audit' });
 case 'document':
 return i18n.t('deadlines.itemType.document', { defaultValue: 'Document' });
 default:
 return i18n.t('deadlines.itemType.item', { defaultValue: 'Item' });
 }
}
