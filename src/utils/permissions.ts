import { UserProfile, ResourceType } from '../types';
export type { ResourceType };
import { ErrorLogger } from '../services/errorLogger';

export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'update_own' | 'delete_own';
export type Role = 'admin' | 'rssi' | 'auditor' | 'project_manager' | 'direction' | 'user';

type PermissionMatrix = Partial<Record<ResourceType | '*', ActionType[]>>;

const ROLE_PERMISSIONS: Record<Role, PermissionMatrix> = {
    admin: { '*': ['manage'] },
    rssi: {
        '*': ['read', 'update'],
        Asset: ['manage'],
        Risk: ['manage'],
        Project: ['manage'],
        Audit: ['manage'],
        Document: ['manage'],
        SystemLog: ['read'],
        Control: ['manage'],
        Incident: ['manage'],
        Supplier: ['manage'],
        BusinessProcess: ['manage'],
        ProcessingActivity: ['manage'],
        SupplierAssessment: ['manage'],
        SupplierIncident: ['manage'],
        Threat: ['manage'],
        User: ['manage'],
        CTCEngine: ['read'],
        AuditTrail: ['read'],
        Backup: ['manage'],
        Integration: ['manage'],
        Partner: ['manage']
    },
    auditor: {
        Audit: ['read', 'create', 'update'],
        Document: ['read', 'create'], // Can upload reports/evidence
        Risk: ['read'], // Read-only
        Project: ['read'],
        Asset: ['read'], // Read-only
        Control: ['read'], // Read-only
        Incident: ['read'],
        Supplier: ['read'],
        BusinessProcess: ['read'],
        ProcessingActivity: ['read'],
        SupplierAssessment: ['read'],
        SupplierIncident: ['read'],
        Threat: ['read'],
        AuditTrail: ['read']
    },
    project_manager: {
        Project: ['manage'], // 'manage' includes 'delete'
        Document: ['create', 'read', 'update'],
        Risk: ['read'],
        Asset: ['read'],
        Control: ['read'],
        Incident: ['read'],
        Supplier: ['read'],
        BusinessProcess: ['read'],
        ProcessingActivity: ['read'],
        SupplierAssessment: ['read'],
        SupplierIncident: ['read'],
        Audit: ['read']
    },
    direction: {
        Project: ['read'],
        Risk: ['read'],
        Audit: ['read'],
        Document: ['read'],
        Asset: ['read'],
        Control: ['read'],
        Incident: ['read'],
        Supplier: ['read'],
        BusinessProcess: ['read'],
        ProcessingActivity: ['read'],
        SupplierAssessment: ['read'],
        SupplierIncident: ['read'],
        CTCEngine: ['read'],
        Backup: ['read'],
        Integration: ['read']
    },
    user: {
        Document: ['read', 'update_own'], // Can often read policy docs
        Asset: ['read'],
        Risk: ['read'],
        Project: ['read'],
        Audit: ['read'],
        Control: ['read'],
        Incident: ['read', 'create', 'update_own'], // Granular: Create and Edit Own only
        Supplier: ['read'],
        BusinessProcess: ['read'],
        ProcessingActivity: ['read'],
        SupplierAssessment: ['read'],
        SupplierIncident: ['read']
    }
};

import { useStore } from '../store';
import { CustomRole } from '../types';

const isResourceOwner = (user: UserProfile, ownerId?: string): boolean => {
    if (!ownerId) return false;
    // SECURITY FIX: Multiple layers of ownership verification
    // 1. Primary check via immutable UID
    const uidMatch = ownerId === user.uid;

    // 2. Additional verification for critical resources
    if (!uidMatch) {
        // Log suspicious ownership attempts
        ErrorLogger.warn('Ownership verification failed', 'permissions.isResourceOwner', {
            metadata: {
                userId: user.uid,
                requestedOwnerId: ownerId,
                userRole: user.role,
                timestamp: new Date().toISOString()
            }
        });
        return false;
    }

    // 3. Verify user is active (check isPending flag)
    if (user.isPending) {
        ErrorLogger.warn('Pending user attempted ownership verification', 'permissions.isResourceOwner', {
            metadata: {
                userId: user.uid,
                isPending: user.isPending,
                resourceOwnerId: ownerId
            }
        });
        return false;
    }

    return true;
};

const expandActions = (actions: ActionType[] = []): ActionType[] => {
    if (actions.includes('manage')) {
        return ['create', 'read', 'update', 'delete', 'manage', 'update_own', 'delete_own'];
    }
    return actions;
};

const getAllowedActions = (role: string, resource: ResourceType, customRoles: CustomRole[] = []): ActionType[] => {
    // Check standard roles first
    if (role in ROLE_PERMISSIONS) {
        const matrix = ROLE_PERMISSIONS[role as Role];
        if (!matrix) return [];
        const specific = matrix[resource] || [];
        const wildcard = matrix['*'] || [];
        return Array.from(new Set([...expandActions(specific), ...expandActions(wildcard)]));
    }

    // Check custom roles
    const customRole = customRoles.find(r => r.id === role);
    if (customRole) {
        const specific = customRole.permissions[resource] || [];
        const wildcard = customRole.permissions['*'] || [];
        return Array.from(new Set([...expandActions(specific), ...expandActions(wildcard)]));
    }

    return [];
};

export const hasPermission = (
    user: UserProfile | null,
    resource: ResourceType,
    action: ActionType,
    orgOwnerId?: string,
    resourceOwnerId?: string,
    resourceOrganizationId?: string
): boolean => {
    if (!user) return false;

    // Organization Owner has full access to their own organization
    if (orgOwnerId && user.uid === orgOwnerId) return true;

    const userRole = user.role || 'user';

    // SECURITY FIX: Admin must respect tenant isolation
    // Admin has full access ONLY within their own organization
    if (userRole === 'admin') {
        // Critical resources require organization owner check
        if (action === 'delete' && ['User', 'Organization'].includes(resource)) {
            return orgOwnerId ? user.uid === orgOwnerId : false; // CHANGED: false instead of true
        }

        // SECURITY: Verify admin belongs to the resource's organization
        // If resourceOrganizationId is provided, it must match user's org
        if (resourceOrganizationId && user.organizationId) {
            if (resourceOrganizationId !== user.organizationId) {
                ErrorLogger.warn('Admin attempted cross-tenant access', 'permissions.hasPermission', {
                    metadata: {
                        userId: user.uid,
                        userOrgId: user.organizationId,
                        resourceOrgId: resourceOrganizationId,
                        resource,
                        action,
                        timestamp: new Date().toISOString()
                    }
                });
                return false;
            }
        }

        return true;
    }

    // Auditor Restriction (Cannot delete/manage mostly)
    if (userRole === 'auditor' && (action === 'delete' || action === 'manage')) {
        return false;
    }

    // Get permissions from Matrix
    const customRoles = useStore.getState().customRoles;
    const allowed = getAllowedActions(userRole, resource, customRoles);

    // 1. Direct match (e.g. 'read', 'create')
    if (allowed.includes(action)) return true;

    // 2. Ownership-based match (update_own / delete_own)
    // If the user wants to 'update', check if they have 'update_own' AND are the owner
    if (action === 'update' && allowed.includes('update_own')) {
        return isResourceOwner(user, resourceOwnerId);
    }
    if (action === 'delete' && allowed.includes('delete_own')) {
        return isResourceOwner(user, resourceOwnerId);
    }

    return false;
};

// Role type representing possible user roles
// Human‑readable role names (French)
export const getRoleName = (role: Role): string => {
    switch (role) {
        case 'admin':
            return 'Administrateur';
        case 'rssi':
            return 'RSSI';
        case 'auditor':
            return 'Auditeur';
        case 'project_manager':
            return 'Chef de Projet';
        case 'direction':
            return 'Direction';
        case 'user':
            return 'Utilisateur';
        default:
            return role;
    }
};

// Descriptions for each role
export const getRoleDescription = (role: Role): string => {
    switch (role) {
        case 'admin':
            return "Accès complet à toutes les fonctionnalités et paramètres du système.";
        case 'rssi':
            return "Responsable de la sécurité des systèmes d'information, gestion des risques et des incidents.";
        case 'auditor':
            return "Effectue les audits internes et externes, vérifie la conformité ISO 27001.";
        case 'project_manager':
            return "Gère les projets SSI, planifie les jalons et suit l’avancement.";
        case 'direction':
            return "Supervise l’ensemble des activités de conformité et de sécurité.";
        case 'user':
            return "Utilise l'application avec des droits limités selon les besoins métier.";
        default:
            return '';
    }
};

export const PERMISSIONS = ROLE_PERMISSIONS;

import { PLANS, PlanConfig } from '../config/plans';
import { PlanType } from '../types';

export const hasFeatureAccess = (planId: PlanType, feature: keyof PlanConfig['limits']['features']): boolean => {
    const plan = PLANS[planId] || PLANS['discovery'];
    return plan.limits.features[feature] || false;
};

// Helper exports that now delegate fully to hasPermission
// SECURITY: Added resourceOrganizationId parameter for tenant isolation
export const canEditResource = (
    user: UserProfile | null,
    resource: ResourceType,
    resourceOwnerId?: string,
    orgOwnerId?: string,
    resourceOrganizationId?: string
): boolean => {
    return hasPermission(user, resource, 'update', orgOwnerId, resourceOwnerId, resourceOrganizationId);
};

export const canDeleteResource = (
    user: UserProfile | null,
    resource: ResourceType,
    resourceOwnerId?: string,
    orgOwnerId?: string,
    resourceOrganizationId?: string
): boolean => {
    return hasPermission(user, resource, 'delete', orgOwnerId, resourceOwnerId, resourceOrganizationId);
};

export const canUpdateResource = (
    user: UserProfile | null,
    resource: ResourceType,
    resourceOwnerId?: string,
    orgOwnerId?: string,
    resourceOrganizationId?: string
): boolean => {
    return canEditResource(user, resource, resourceOwnerId, orgOwnerId, resourceOrganizationId);
};
