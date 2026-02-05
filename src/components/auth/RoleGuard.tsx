import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useLocale } from '../../hooks/useLocale';
import { useStore } from '../../store';
import { Role } from '../../utils/permissions';
import { ShieldAlert, ArrowLeft } from '../ui/Icons';

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
 const { t } = useLocale();
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
 <div className="flex flex-col items-center justify-center p-12 text-center h-[60dvh] gap-4">
 <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
  <ShieldAlert className="w-8 h-8 text-destructive" />
 </div>
 <h2 className="text-xl font-bold text-foreground">{t('auth.accessDenied', { defaultValue: 'Acces refuse' })}</h2>
 <p className="text-sm text-muted-foreground max-w-md">{t('auth.accessDeniedOtherOrg')}</p>
 <Link
  to="/"
  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
 >
  <ArrowLeft className="w-4 h-4" />
  {t('common.backToDashboard', { defaultValue: 'Retour au tableau de bord' })}
 </Link>
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
 <div className="flex flex-col items-center justify-center p-12 text-center h-[60dvh] gap-4">
 <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
 <ShieldAlert className="w-8 h-8 text-destructive" />
 </div>
 <h2 className="text-xl font-bold text-foreground">{t('auth.accessDenied', { defaultValue: 'Acces refuse' })}</h2>
 <p className="text-sm text-muted-foreground max-w-md">{t('auth.insufficientPermissions')}</p>
 <Link
 to="/"
 className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
 >
 <ArrowLeft className="w-4 h-4" />
 {t('common.backToDashboard', { defaultValue: 'Retour au tableau de bord' })}
 </Link>
 </div>
 );
};
