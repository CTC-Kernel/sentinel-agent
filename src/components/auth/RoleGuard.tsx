import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store';
import { Role } from '../../utils/permissions';
import { ContentBlockerError } from '../ui/ContentBlockerError';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: Role[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
    const { user } = useStore();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const userRole = (user.role || 'user') as Role;

    // Admin has access to everything by default in this guard logic, 
    // unless explicitly excluded (which shouldn't happen for admin).
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
