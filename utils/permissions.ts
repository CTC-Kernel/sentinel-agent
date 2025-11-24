import { UserProfile } from '../types';

export type ResourceType = 'Asset' | 'Risk' | 'Project' | 'Audit' | 'Document' | 'User' | 'Settings' | 'SystemLog';
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
        SystemLog: ['read']
    },
    auditor: {
        Audit: ['manage'],
        Document: ['read', 'create', 'update'],
        Risk: ['read'],
        Project: ['read'],
        Asset: ['read']
    },
    project_manager: {
        Project: ['manage'],
        Document: ['create', 'read', 'update'],
        Risk: ['read'],
        Asset: ['read']
    },
    direction: {
        Project: ['read'],
        Risk: ['read'],
        Audit: ['read'],
        Document: ['read'],
        Asset: ['read']
    },
    user: {
        Document: ['read'],
        Asset: ['read'],
        Risk: ['read']
    }
};

const expandActions = (actions: ActionType[] = []): ActionType[] => {
    if (actions.includes('manage')) {
        return ['create', 'read', 'update', 'delete', 'manage'];
    }
    return actions;
};

const getAllowedActions = (role: Role, resource: ResourceType): ActionType[] => {
    const matrix = ROLE_PERMISSIONS[role];
    if (!matrix) return [];
    const specific = matrix[resource] || [];
    const wildcard = matrix['*'] || [];
    return Array.from(new Set([...expandActions(specific), ...expandActions(wildcard)]));
};

export const hasPermission = (user: UserProfile | null, resource: ResourceType, action: ActionType): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const allowed = getAllowedActions(user.role, resource);
    if (allowed.includes(action)) return true;

    // RSSI acts as super-user when not already covered by matrix wildcard
    if (user.role === 'rssi') return true;

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

export const canEditResource = (user: UserProfile | null, resource: ResourceType, resourceOwnerId?: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'rssi') return true;

    if (resource === 'Document' && isResourceOwner(user, resourceOwnerId)) {
        return true;
    }

    return hasPermission(user, resource, 'update');
};
