import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store';
import { Role } from '../../utils/permissions';
import { ContentBlockerError } from '../ui/ContentBlockerError';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: Role[];
    /** Optional: Resource organization ID for IDOR protection */
    resourceOrganizationId?: string;
}

/**
 * Role-based access guard with IDOR protection
 *
 * SECURITY: When resourceOrganizationId is provided, verifies that the user
 * belongs to the same organization as the resource being accessed.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles, resourceOrganizationId }) => {
    const { user } = useStore();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const userRole = (user.role || 'user') as Role;

    // SECURITY FIX: IDOR Protection - verify user belongs to resource organization
    // This check applies to all roles including admin (org admins should only access their org)
    if (resourceOrganizationId && resourceOrganizationId !== user.organizationId) {
        // User is trying to access a resource from a different organization
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60dvh]">
                <ContentBlockerError />
                <p className="mt-4 text-slate-500">Accès refusé: ressource appartenant à une autre organisation.</p>
            </div>
        );
    }

    // Admin has access to everything within their organization
    if (userRole === 'admin') {
        return <>{children}</>;
    }

    if (allowedRoles.includes(userRole)) {
        return <>{children}</>;
    }

    // Unauthorized access attempt
    // We can show a friendly "Access Denied" page or redirect.
    // Re-using ContentBlockerError style or a dedicated Unauthorized component.
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center h-[60dvh]">
            <ContentBlockerError />
            {/* Or a specific message */}
            <p className="mt-4 text-slate-500">Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
        </div>
    );
};
