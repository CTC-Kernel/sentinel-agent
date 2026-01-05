import { UserProfile, ResourceType } from '../types';
export type { ResourceType };
import { ErrorLogger } from '../services/errorLogger';

export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'manage';
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
        Project: ['manage'], // 'manage' includes 'delete', centralized here instead of hardcoded exception
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
        Document: ['read'],
        Asset: ['read'],
        Risk: ['read'],
        Project: ['read'],
        Audit: ['read'],
        Control: ['read'],
        Incident: ['read', 'create'],
        Supplier: ['read'],
        BusinessProcess: ['read'],
        ProcessingActivity: ['read'],
        SupplierAssessment: ['read'],
        SupplierIncident: ['read']
    }
};

import { useStore } from '../store';
import { CustomRole } from '../types';

const expandActions = (actions: ActionType[] = []): ActionType[] => {
    if (actions.includes('manage')) {
        return ['create', 'read', 'update', 'delete', 'manage'];
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
        // Custom roles don't currently support wildcard '*' in the UI, but we can support it in logic if added later
        const wildcard = customRole.permissions['*'] || [];
        return Array.from(new Set([...expandActions(specific), ...expandActions(wildcard)]));
    }

    return [];
};

export const hasPermission = (user: UserProfile | null, resource: ResourceType, action: ActionType, orgOwnerId?: string): boolean => {
    if (!user) return false;

    // Organization Owner has full access (effectively Super Admin for their Org)
    if (orgOwnerId && user.uid === orgOwnerId) return true;

    // Fallback role if missing
    const userRole = user.role || 'user';

    // SECURITY FIX: Admin still has full access but with explicit validation
    if (userRole === 'admin') {
        // Additional validation for critical actions
        if (action === 'delete' && ['User', 'Organization'].includes(resource)) {
            return orgOwnerId ? user.uid === orgOwnerId : true;
        }
        return true;
    }

    // CRITICAL FIX: Restrict auditors from delete operations
    if (userRole === 'auditor' && action === 'delete') {
        return false;
    }

    // Get custom roles from store
    const customRoles = useStore.getState().customRoles;

    const allowed = getAllowedActions(userRole, resource, customRoles);

    if (allowed.includes(action)) return true;

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

import { PLANS, PlanConfig } from '../config/plans';
import { PlanType } from '../types';

// ... existing imports ...

export const hasFeatureAccess = (planId: PlanType, feature: keyof PlanConfig['limits']['features']): boolean => {
    const plan = PLANS[planId] || PLANS['discovery'];
    return plan.limits.features[feature] || false;
};

export const canEditResource = (user: UserProfile | null, resource: ResourceType, resourceOwnerId?: string, orgOwnerId?: string): boolean => {
    if (!user) return false;

    // Owner check
    if (orgOwnerId && user.uid === orgOwnerId) return true;

    if (user.role === 'admin') return true;

    // Check plan limits for specific resources if needed
    // For now, we focus on feature access via hasFeatureAccess

    if (resource === 'Document' && isResourceOwner(user, resourceOwnerId)) {
        return true;
    }

    // FIX: Allow users to edit their own incidents
    if (resource === 'Incident' && isResourceOwner(user, resourceOwnerId)) {
        return true;
    }

    // AUDIT FIX: Centralized Permission Logic
    // Previously, Auditors had hardcoded exceptions here.
    // Now, we rely strictly on the ROLE_PERMISSIONS matrix or hasPermission function.
    // This ensures that if we change the matrix, the logic here updates automatically.

    return hasPermission(user, resource, 'update', orgOwnerId);
};

export const canDeleteResource = (user: UserProfile | null, resource: ResourceType, resourceOwnerId?: string, orgOwnerId?: string): boolean => {
    if (!user) return false;

    // Owner check
    if (orgOwnerId && user.uid === orgOwnerId) return true;

    if (user.role === 'admin') return true;

    if (resource === 'Document' && isResourceOwner(user, resourceOwnerId)) {
        return true;
    }

    // Project Managers permission is now handled by the matrix (manage = delete)

    // Auditors generally cannot delete, except maybe Drafts? Rules say NO for risks/Assets/Controls.
    // Rules say YES for Audits?
    // Audit Rules: allow delete: if canDelete(orgId); -> Admin/RSSI only.
    // So Auditors CANNOT delete Audits in Firestore rules.

    return hasPermission(user, resource, 'delete', orgOwnerId);
};

export const canUpdateResource = (user: UserProfile | null, resource: ResourceType, resourceOwnerId?: string, orgOwnerId?: string): boolean => {
    // Helper specifically for Update to handle the "Owner" edge case cleaner than inside canEditResource if we wanted to split behavior,
    // but for now we keep using canEditResource as the main entry point or just modify it.
    // Actually, let's just modify the existing logic inside canEditResource above or here.
    // Re-reading canEditResource... it calls hasPermission(..., 'update').
    return canEditResource(user, resource, resourceOwnerId, orgOwnerId);
};
