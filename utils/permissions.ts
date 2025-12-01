import { UserProfile } from '../types';

export type ResourceType =
    | 'Asset'
    | 'Risk'
    | 'Project'
    | 'Audit'
    | 'Document'
    | 'User'
    | 'Settings'
    | 'SystemLog'
    | 'Control'
    | 'Incident'
    | 'Supplier'
    | 'BusinessProcess'
    | 'ProcessingActivity'
    | 'SupplierAssessment'
    | 'SupplierIncident';

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
        SupplierIncident: ['manage']
    },
    auditor: {
        Audit: ['read', 'create', 'update'],
        Document: ['read', 'create', 'update'],
        Risk: ['read', 'update'],
        Project: ['read'],
        Asset: ['read', 'update'],
        Control: ['read'],
        Incident: ['read'],
        Supplier: ['read', 'update'],
        BusinessProcess: ['read', 'update'],
        ProcessingActivity: ['read', 'update'],
        SupplierAssessment: ['read', 'update'],
        SupplierIncident: ['read']
    },
    project_manager: {
        Project: ['manage'],
        Document: ['create', 'read', 'update'],
        Risk: ['read'],
        Asset: ['read'],
        Control: ['read'],
        Incident: ['read'],
        Supplier: ['read'],
        BusinessProcess: ['read'],
        ProcessingActivity: ['read'],
        SupplierAssessment: ['read'],
        SupplierIncident: ['read']
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
        SupplierIncident: ['read']
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

    if (userRole === 'admin') return true;

    // Get custom roles from store
    const customRoles = useStore.getState().customRoles;

    const allowed = getAllowedActions(userRole, resource, customRoles);

    if (allowed.includes(action)) return true;

    // RSSI acts as super-user when not already covered by matrix wildcard
    if (userRole === 'rssi') return true;

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
    return ownerId === user.uid || ownerId === user.displayName || ownerId === user.email;
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

    if (user.role === 'admin' || user.role === 'rssi') return true;

    // Check plan limits for specific resources if needed
    // For now, we focus on feature access via hasFeatureAccess

    if (resource === 'Document' && isResourceOwner(user, resourceOwnerId)) {
        return true;
    }

    // Explicit check for Auditor to match backend rules
    // Backend: canWrite(orgId) -> belongsToOrganization && (isAdmin || isAuditor || isRSSI)
    if (user.role === 'auditor') {
        // Auditors can edit most core GRC resources
        const auditorEditableResources: ResourceType[] = [
            'Risk', 'Asset', 'Control', 'Audit', 'Document',
            'Supplier', 'BusinessProcess', 'ProcessingActivity', 'Incident',
            'SupplierAssessment', 'SupplierIncident'
        ];
        if (auditorEditableResources.includes(resource)) return true;
    }

    return hasPermission(user, resource, 'update', orgOwnerId);
};

export const canDeleteResource = (user: UserProfile | null, resource: ResourceType, resourceOwnerId?: string, orgOwnerId?: string): boolean => {
    if (!user) return false;

    // Owner check
    if (orgOwnerId && user.uid === orgOwnerId) return true;

    if (user.role === 'admin' || user.role === 'rssi') return true;

    if (resource === 'Document' && isResourceOwner(user, resourceOwnerId)) {
        return true;
    }

    if (user.role === 'project_manager' && resource === 'Project') {
        // Project Managers can delete their own projects (or all projects if belongsToOrg, logic in rules is broad)
        // Rules: allow delete: if canDelete(orgId) || (isProjectManager() && belongsToOrganization(orgId));
        return true;
    }

    // Auditors generally cannot delete, except maybe Drafts? Rules say NO for Risks/Assets/Controls.
    // Rules say YES for Audits?
    // Audit Rules: allow delete: if canDelete(orgId); -> Admin/RSSI only.
    // So Auditors CANNOT delete Audits in Firestore rules.

    return hasPermission(user, resource, 'delete', orgOwnerId);
};
