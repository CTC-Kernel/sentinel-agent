/**
 * Mobile App Theme Colors
 *
 * Consistent color palette used across all components.
 * Matches the design system from the SaaS platform.
 */

export const COLORS = {
    primary: '#6366f1',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    background: '#f8fafc',
    card: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
} as const;

export type ColorName = keyof typeof COLORS;

/**
 * Get score color based on compliance score value
 */
export function getScoreColor(score: number | null): string {
    if (score === null) return COLORS.textSecondary;
    if (score >= 80) return COLORS.success;
    if (score >= 60) return COLORS.warning;
    return COLORS.error;
}

/**
 * Get severity color based on severity level
 */
export function getSeverityColor(severity: 'critical' | 'high' | 'medium' | 'low'): string {
    switch (severity) {
        case 'critical':
            return COLORS.error;
        case 'high':
            return COLORS.warning;
        case 'medium':
            return COLORS.primary;
        default:
            return COLORS.textSecondary;
    }
}
