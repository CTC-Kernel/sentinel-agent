import { UserProfile } from '../types';

export type ResourceType = 'Asset' | 'Risk' | 'Project' | 'Audit' | 'Document' | 'User' | 'Settings' | 'SystemLog';
export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'manage';

export const hasPermission = (user: UserProfile | null, resource: ResourceType, action: ActionType): boolean => {
    if (!user) return false;

    // Admin and RSSI have full access
    if (user.role === 'admin' || user.role === 'rssi') return true;

    switch (resource) {
        case 'Asset':
            // Read-only for everyone else
            if (action === 'read') return true;
            return false;

        case 'Risk':
            // Read-only for everyone else
            if (action === 'read') return true;
            return false;

        case 'Project':
            // Project Managers can manage projects
            if (user.role === 'project_manager') return true;
            if (action === 'read') return true;
            return false;

        case 'Audit':
            // Auditors can manage audits
            if (user.role === 'auditor') return true;
            if (action === 'read') return true;
            return false;

        case 'Document':
            // Everyone can read
            if (action === 'read') return true;
            // Creation allowed for most roles? Let's say yes for now, or restrict.
            // For now, let's allow creation for Project Managers and Auditors too.
            if (action === 'create' && (user.role === 'project_manager' || user.role === 'auditor')) return true;
            // Update/Delete handled by ownership check in component usually, but here we define role-based base permission
            return false;

        case 'User':
            // Only admins manage users (handled by first check)
            return false;

        case 'Settings':
            return false;

        default:
            return false;
    }
};

// Role type representing possible user roles
export type Role = 'admin' | 'rssi' | 'auditor' | 'project_manager' | 'direction' | 'user';

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

// Placeholder permissions map – can be expanded later
export const PERMISSIONS = {
    admin: ['*'],
    rssi: ['Asset:manage', 'Risk:manage', 'Project:manage', 'Audit:manage', 'Document:manage'],
    auditor: ['Audit:read', 'Audit:update', 'Document:read'],
    project_manager: ['Project:manage', 'Document:create'],
    direction: ['Report:read'],
    user: ['Document:read']
};

export const canEditResource = (user: UserProfile | null, resource: ResourceType, resourceOwnerId?: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'rssi') return true;

    if (resource === 'Document') {
        // Users can edit their own documents
        if (user.role === 'user') {
            return resourceOwnerId === user.uid || resourceOwnerId === user.displayName;
        }
        // Owner can edit their document
        // Note: owner in Document is stored as displayName currently, which is not ideal, but we follow existing pattern
        if (resourceOwnerId === user.displayName) {
            return true;
        }
    }

    return hasPermission(user, resource, 'update');
};
