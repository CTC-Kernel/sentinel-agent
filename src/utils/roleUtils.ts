/**
 * Role Utilities
 * Helper functions for role-based access and visibility
 * Implements Story 2.3: Executive KPI Cards (Role-based visibility)
 */

/**
 * Available user roles in the system (RBAC)
 * Based on EXIST-003: 6 roles already implemented
 */
export type UserRole =
 | 'super_admin'
 | 'admin'
 | 'rssi'
 | 'auditor'
 | 'project_manager'
 | 'direction'
 | 'user'
 | 'certifier';

/**
 * User object with role information
 */
export interface UserWithRole {
 id: string;
 role: UserRole;
 roles?: UserRole[]; // Some systems support multiple roles
}

/**
 * Check if user has a specific role
 *
 * @param user - The user object with role information
 * @param role - The role to check
 * @returns true if user has the specified role
 *
 * @example
 * ```tsx
 * if (hasRole(currentUser, 'direction')) {
 * return <ExecutiveKPIWidget />;
 * }
 * ```
 */
export function hasRole(
 user: UserWithRole | null | undefined,
 role: UserRole
): boolean {
 if (!user) return false;

 // Check primary role
 if (user.role === role) return true;

 // Check multiple roles if supported
 if (user.roles && user.roles.includes(role)) return true;

 return false;
}

/**
 * Check if user has any of the specified roles
 *
 * @param user - The user object with role information
 * @param roles - Array of roles to check
 * @returns true if user has any of the specified roles
 *
 * @example
 * ```tsx
 * if (hasAnyRole(currentUser, ['direction', 'admin'])) {
 * return <ExecutiveKPIWidget />;
 * }
 * ```
 */
export function hasAnyRole(
 user: UserWithRole | null | undefined,
 roles: UserRole[]
): boolean {
 if (!user) return false;

 return roles.some((role) => hasRole(user, role));
}

/**
 * Check if user has all of the specified roles
 *
 * @param user - The user object with role information
 * @param roles - Array of roles to check
 * @returns true if user has all of the specified roles
 */
export function hasAllRoles(
 user: UserWithRole | null | undefined,
 roles: UserRole[]
): boolean {
 if (!user) return false;

 return roles.every((role) => hasRole(user, role));
}

/**
 * Check if user is an executive (direction role)
 * Used for displaying executive-specific components like KPI cards
 *
 * @param user - The user object with role information
 * @returns true if user has direction role
 */
export function isExecutive(user: UserWithRole | null | undefined): boolean {
 return hasRole(user, 'direction');
}

/**
 * Check if user is a security officer (RSSI role)
 *
 * @param user - The user object with role information
 * @returns true if user has rssi role
 */
export function isRSSI(user: UserWithRole | null | undefined): boolean {
 return hasRole(user, 'rssi');
}

/**
 * Check if user is an administrator
 *
 * @param user - The user object with role information
 * @returns true if user has admin role
 */
export function isAdmin(user: UserWithRole | null | undefined): boolean {
 return hasRole(user, 'admin');
}

/**
 * Check if user is an auditor
 *
 * @param user - The user object with role information
 * @returns true if user has auditor role
 */
export function isAuditor(user: UserWithRole | null | undefined): boolean {
 return hasRole(user, 'auditor');
}

/**
 * Check if user is a project manager
 *
 * @param user - The user object with role information
 * @returns true if user has project_manager role
 */
export function isProjectManager(user: UserWithRole | null | undefined): boolean {
 return hasRole(user, 'project_manager');
}

/**
 * Get roles that have access to executive dashboard features
 * Per ADR-004: direction role gets kpi-cards (3)
 */
export const EXECUTIVE_DASHBOARD_ROLES: UserRole[] = ['direction', 'admin', 'super_admin'];

/**
 * Check if user has access to executive dashboard features
 *
 * @param user - The user object with role information
 * @returns true if user can view executive dashboard
 */
export function canViewExecutiveDashboard(
 user: UserWithRole | null | undefined
): boolean {
 return hasAnyRole(user, EXECUTIVE_DASHBOARD_ROLES);
}
