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
