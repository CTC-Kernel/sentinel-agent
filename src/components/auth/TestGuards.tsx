import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../../store';

// Test guard that bypasses authentication in test mode
export const TestAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const setUser = useStore(state => state.setUser);

    // In test mode, hydrate user and allow access
    if (import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_EMULATORS === 'true') {
        useEffect(() => {
            const e2eUser = localStorage.getItem('E2E_TEST_USER');
            const authUser = localStorage.getItem('auth_user');

            if (e2eUser) {
                try {
                    console.log('Hydrating E2E_TEST_USER from localStorage:', e2eUser);
                    setUser(JSON.parse(e2eUser));
                } catch (e) {
                    console.error('Failed to parse E2E_TEST_USER', e);
                }
            } else if (authUser) {
                try {
                    setUser(JSON.parse(authUser));
                } catch (e) {
                    console.error('Failed to parse auth_user', e);
                }
            }
        }, [setUser]);

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
