export interface Permission {
    resource: string; // 'assets', 'risks', 'audits', etc.
    action: 'read' | 'create' | 'update' | 'delete' | 'export' | 'approve';
}

export type Role = 'admin' | 'rssi' | 'auditor' | 'project_manager' | 'direction' | 'user';

/**
 * Permission matrix: Role → Resource → Actions
 */
export const PERMISSIONS: Record<Role, Permission[]> = {
    // Admin: Full access to everything
    admin: [
        { resource: '*', action: 'read' },
        { resource: '*', action: 'create' },
        { resource: '*', action: 'update' },
        { resource: '*', action: 'delete' },
        { resource: '*', action: 'export' },
        { resource: '*', action: 'approve' },
    ],

    // RSSI (Chief Information Security Officer): Full security management
    rssi: [
        { resource: '*', action: 'read' },
        { resource: 'assets', action: 'create' },
        { resource: 'assets', action: 'update' },
        { resource: 'risks', action: 'create' },
        { resource: 'risks', action: 'update' },
        { resource: 'risks', action: 'delete' },
        { resource: 'controls', action: 'create' },
        { resource: 'controls', action: 'update' },
        { resource: 'incidents', action: 'create' },
        { resource: 'incidents', action: 'update' },
        { resource: 'incidents', action: 'delete' },
        { resource: 'documents', action: 'create' },
        { resource: 'documents', action: 'update' },
        { resource: 'documents', action: 'approve' },
        { resource: 'suppliers', action: 'create' },
        { resource: 'suppliers', action: 'update' },
        { resource: '*', action: 'export' },
    ],

    // Auditor: Audit and compliance management
    auditor: [
        { resource: '*', action: 'read' },
        { resource: 'audits', action: 'create' },
        { resource: 'audits', action: 'update' },
        { resource: 'audits', action: 'delete' },
        { resource: 'findings', action: 'create' },
        { resource: 'findings', action: 'update' },
        { resource: 'findings', action: 'delete' },
        { resource: 'controls', action: 'update' },
        { resource: 'documents', action: 'read' },
        { resource: '*', action: 'export' },
    ],

    // Project Manager: Project and task management
    project_manager: [
        { resource: '*', action: 'read' },
        { resource: 'projects', action: 'create' },
        { resource: 'projects', action: 'update' },
        { resource: 'projects', action: 'delete' },
        { resource: 'risks', action: 'read' },
        { resource: 'controls', action: 'read' },
        { resource: 'documents', action: 'read' },
        { resource: 'projects', action: 'export' },
    ],

    // Direction: Read-only access with export capabilities
    direction: [
        { resource: '*', action: 'read' },
        { resource: '*', action: 'export' },
        { resource: 'documents', action: 'approve' },
    ],

    // User: Basic read access
    user: [
        { resource: 'assets', action: 'read' },
        { resource: 'risks', action: 'read' },
        { resource: 'documents', action: 'read' },
        { resource: 'incidents', action: 'create' }, // Can report incidents
        { resource: 'incidents', action: 'read' },
    ],
};

/**
 * Check if a user has permission to perform an action on a resource
 */
export function hasPermission(
    userRole: Role,
    resource: string,
    action: Permission['action']
): boolean {
    const rolePermissions = PERMISSIONS[userRole] || [];

    return rolePermissions.some(
        (perm) =>
            (perm.resource === '*' || perm.resource === resource) &&
            perm.action === action
    );
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
    return PERMISSIONS[role] || [];
}

/**
 * Check if user can access a module
 */
export function canAccessModule(userRole: Role, module: string): boolean {
    return hasPermission(userRole, module, 'read');
}

/**
 * Check if user can edit a resource
 */
export function canEdit(userRole: Role, resource: string): boolean {
    return hasPermission(userRole, resource, 'update') ||
        hasPermission(userRole, resource, 'create');
}

/**
 * Check if user can delete a resource
 */
export function canDelete(userRole: Role, resource: string): boolean {
    return hasPermission(userRole, resource, 'delete');
}

/**
 * Check if user can export data
 */
export function canExport(userRole: Role, resource: string): boolean {
    return hasPermission(userRole, resource, 'export');
}

/**
 * Check if user can approve documents/changes
 */
export function canApprove(userRole: Role, resource: string): boolean {
    return hasPermission(userRole, resource, 'approve');
}

/**
 * Get user-friendly role name
 */
export function getRoleName(role: Role): string {
    const names: Record<Role, string> = {
        admin: 'Administrateur',
        rssi: 'RSSI',
        auditor: 'Auditeur',
        project_manager: 'Chef de Projet',
        direction: 'Direction',
        user: 'Utilisateur',
    };
    return names[role] || role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: Role): string {
    const descriptions: Record<Role, string> = {
        admin: 'Accès complet à toutes les fonctionnalités',
        rssi: 'Gestion complète de la sécurité de l\'information',
        auditor: 'Gestion des audits et de la conformité',
        project_manager: 'Gestion des projets de sécurité',
        direction: 'Consultation et approbation des documents',
        user: 'Accès en lecture et signalement d\'incidents',
    };
    return descriptions[role] || '';
}
