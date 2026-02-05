/**
 * Dashboard Default Layouts Configuration
 * Role-based default widget configurations per ADR-004
 *
 * Story 2-6: Configurable Dashboard Widgets
 */

import type { WidgetLayout } from '../hooks/useDashboardPreferences';
import type { UserRole } from '../utils/roleUtils';

/**
 * Widget category for organizing in AddWidgetModal
 */
export type WidgetCategory = 'scoreKpi' | 'risks' | 'actions' | 'audits' | 'other';

/**
 * Widget category mappings
 */
export const WIDGET_CATEGORIES: Record<string, WidgetCategory> = {
 // Score & KPI
 'compliance-score': 'scoreKpi',
 'executive-kpi': 'scoreKpi',
 'stats-overview': 'scoreKpi',
 'health-check': 'scoreKpi',
 'compliance-progress': 'scoreKpi',
 'compliance-evolution': 'scoreKpi',
 'maturity-radar': 'scoreKpi',
 'nis2-dora-kpi': 'scoreKpi',

 // Risks
 'rssi-critical-risks': 'risks',
 'priority-risks': 'risks',
 'risk-heatmap': 'risks',

 // Actions
 'rssi-actions': 'actions',
 'pm-actions-overdue': 'actions',
 'pm-timeline': 'actions',
 'pm-progress': 'actions',
 'my-workspace': 'actions',
 'project-tasks': 'actions',

 // Audits
 'audits-donut': 'audits',

 // Other
 'rssi-incidents': 'other',
 'incidents-stats': 'other',
 'documents-stats': 'other',
 'asset-stats': 'other',
 'suppliers-stats': 'other',
 'continuity-plans': 'other',
 'cyber-news': 'other',
 'recent-activity': 'other',
};

/**
 * Get widget category
 */
export function getWidgetCategory(widgetId: string): WidgetCategory {
 return WIDGET_CATEGORIES[widgetId] || 'other';
}

/**
 * Helper to create a widget layout entry
 */
function createWidget(widgetId: string, colSpan: 1 | 2 | 3 = 1): WidgetLayout {
 return {
 id: `${widgetId}-${Date.now()}-${crypto.randomUUID()}`,
 widgetId,
 colSpan,
 };
}

/**
 * Direction (Executive) default layout
 * Focus: High-level compliance score, KPIs, alerts
 * Per ADR-004: score-gauge, kpi-cards (3), alerts-critical
 */
export const DIRECTION_DEFAULT_LAYOUT: WidgetLayout[] = [
 createWidget('executive-kpi', 3),
 createWidget('compliance-score', 1),
 createWidget('health-check', 1),
 createWidget('compliance-progress', 1),
];

/**
 * RSSI (Security Officer) default layout
 * Focus: Risks, incidents, actions, controls
 * Per ADR-004: risks-critical, actions-overdue, incidents-recent, controls-status
 */
export const RSSI_DEFAULT_LAYOUT: WidgetLayout[] = [
 createWidget('rssi-critical-risks', 1),
 createWidget('rssi-incidents', 1),
 createWidget('rssi-actions', 1),
 createWidget('risk-heatmap', 1),
 createWidget('maturity-radar', 1),
 createWidget('compliance-score', 1),
 createWidget('cyber-news', 1),
 createWidget('priority-risks', 1),
];

/**
 * Project Manager default layout
 * Focus: Actions, timeline, progress, deadlines
 * Per ADR-004: actions-overdue, timeline, resources
 */
export const PROJECT_MANAGER_DEFAULT_LAYOUT: WidgetLayout[] = [
 createWidget('pm-actions-overdue', 1),
 createWidget('pm-timeline', 1),
 createWidget('pm-progress', 1),
 createWidget('my-workspace', 2),
 createWidget('compliance-progress', 1),
];

/**
 * Auditor default layout
 * Focus: Audit progress, documents, compliance checklist
 * Per ADR-004: audit-progress, document-expiring, checklist-summary
 */
export const AUDITOR_DEFAULT_LAYOUT: WidgetLayout[] = [
 createWidget('audits-donut', 1),
 createWidget('compliance-progress', 1),
 createWidget('documents-stats', 1),
 createWidget('compliance-score', 1),
 createWidget('my-workspace', 2),
];

/**
 * Admin default layout
 * Full access to all core widgets
 */
export const ADMIN_DEFAULT_LAYOUT: WidgetLayout[] = [
 createWidget('stats-overview', 3),
 createWidget('compliance-score', 1),
 createWidget('maturity-radar', 1),
 createWidget('health-check', 1),
 createWidget('risk-heatmap', 1),
 createWidget('cyber-news', 1),
 createWidget('my-workspace', 2),
 createWidget('recent-activity', 1),
];

/**
 * Default user layout
 * Basic widgets for general users
 */
export const USER_DEFAULT_LAYOUT: WidgetLayout[] = [
 createWidget('my-workspace', 2),
 createWidget('compliance-progress', 1),
 createWidget('recent-activity', 1),
 createWidget('compliance-score', 1),
 createWidget('health-check', 1),
];

/**
 * Role to default layout mapping
 */
export const ROLE_DEFAULT_LAYOUTS: Record<UserRole, WidgetLayout[]> = {
 super_admin: ADMIN_DEFAULT_LAYOUT,
 direction: DIRECTION_DEFAULT_LAYOUT,
 rssi: RSSI_DEFAULT_LAYOUT,
 project_manager: PROJECT_MANAGER_DEFAULT_LAYOUT,
 auditor: AUDITOR_DEFAULT_LAYOUT,
 admin: ADMIN_DEFAULT_LAYOUT,
 user: USER_DEFAULT_LAYOUT,
 certifier: USER_DEFAULT_LAYOUT,
};

/**
 * Get default layout for a given role
 *
 * @param role - The user role
 * @returns The default widget layout for that role
 *
 * @example
 * ```tsx
 * const defaultLayout = getDefaultLayoutForRole('rssi');
 * ```
 */
export function getDefaultLayoutForRole(role: UserRole | string): WidgetLayout[] {
 const normalizedRole = role as UserRole;

 // Return fresh copies to avoid mutation issues
 const layout = ROLE_DEFAULT_LAYOUTS[normalizedRole];
 if (layout) {
 return layout.map((widget) => ({
 ...widget,
 id: `${widget.widgetId}-${Date.now()}-${crypto.randomUUID()}`,
 }));
 }

 // Default to user layout if role not found
 return USER_DEFAULT_LAYOUT.map((widget) => ({
 ...widget,
 id: `${widget.widgetId}-${Date.now()}-${crypto.randomUUID()}`,
 }));
}

/**
 * Get dashboard role from user roles
 * Maps complex role logic to dashboard role
 */
export function getDashboardRole(userRole: UserRole | string): UserRole {
 const validRoles: UserRole[] = ['direction', 'rssi', 'project_manager', 'auditor', 'admin', 'user'];
 return validRoles.includes(userRole as UserRole) ? (userRole as UserRole) : 'user';
}
