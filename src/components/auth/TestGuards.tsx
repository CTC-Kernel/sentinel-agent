import React from 'react';
import { Navigate } from 'react-router-dom';

// Test guard that bypasses authentication in test mode
export const TestAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // In test mode, always allow access
    if (import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_EMULATORS === 'true') {
        return <>{children}</>;
    }

    let isAuthorized = false;

    // Check for mock auth state
    if (typeof window !== 'undefined') {
        const mockUser = localStorage.getItem('auth_user');
        if (mockUser) {
            try {
                const user = JSON.parse(mockUser);
                if (user.uid && user.email) {
                    isAuthorized = true;
                }
            } catch {
                // Invalid mock user format
            }
        }
    }

    if (isAuthorized) {
        return <>{children}</>;
    }

    // Redirect to login if not authenticated
    return <Navigate to="/login" replace />;
};

// Test role guard that bypasses RBAC in test mode
export const TestRoleGuard: React.FC<{
    children: React.ReactNode;
    allowedRoles?: string[]
}> = ({ children, allowedRoles = [] }) => {
    // In test mode, always allow access
    if (import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_EMULATORS === 'true') {
        return <>{children}</>;
    }

    let isAuthorized = false;

    // Check for mock user with role
    if (typeof window !== 'undefined') {
        const mockUser = localStorage.getItem('auth_user');
        if (mockUser) {
            try {
                const user = JSON.parse(mockUser);
                if (user.role && (!allowedRoles.length || allowedRoles.includes(user.role))) {
                    isAuthorized = true;
                }
            } catch {
                // Invalid mock user format
            }
        }
    }

    if (isAuthorized) {
        return <>{children}</>;
    }

    // Redirect to dashboard if not authorized
    return <Navigate to="/" replace />;
};
