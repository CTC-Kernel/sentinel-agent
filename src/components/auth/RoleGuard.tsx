import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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
                <p className="mt-4 text-slate-500">{t('auth.accessDeniedOtherOrg')}</p>
            </div>
        );
    }

    // super_admin has access to everything within their organization
    if (userRole === 'super_admin') {
        return <>{children}</>;
    }

    // Admin has access to everything within their organization,
    // unless the route is explicitly restricted to super_admin only
    const isSuperAdminOnly = allowedRoles.includes('super_admin') && !allowedRoles.includes('admin');
    if (userRole === 'admin' && !isSuperAdminOnly) {
        return <>{children}</>;
    }

    if (allowedRoles.includes(userRole)) {
        return <>{children}</>;
    }

    // Unauthorized access attempt
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center h-[60dvh]">
            <ContentBlockerError />
            <p className="mt-4 text-slate-500">{t('auth.insufficientPermissions')}</p>
        </div>
    );
};
