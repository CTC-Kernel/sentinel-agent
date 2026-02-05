import { hasAnyRole, type UserWithRole } from '../../utils/roleUtils';

/**
 * Roles that can view PM dashboard
 * Per ADR-004: project_manager role gets progress-global, timeline-next, actions-overdue
 */
export const PM_DASHBOARD_ROLES = ['project_manager', 'admin'] as const;

/**
 * Check if user can view PM dashboard
 */
export function canViewPMDashboard(user: UserWithRole | null | undefined): boolean {
 return hasAnyRole(user, [...PM_DASHBOARD_ROLES]);
}

/**
 * Roles that can view RSSI dashboard
 * Per ADR-004: rssi role gets risks-critical, actions-overdue, incidents-recent
 */
export const RSSI_DASHBOARD_ROLES = ['rssi', 'admin'] as const;

/**
 * Check if user can view RSSI dashboard
 */
export function canViewRSSIDashboard(user: UserWithRole | null | undefined): boolean {
 return hasAnyRole(user, [...RSSI_DASHBOARD_ROLES]);
}
