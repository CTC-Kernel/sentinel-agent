import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

// Test guard that bypasses authentication in test mode
// SECURITY: Only enabled in non-production environments
export const TestAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const setUser = useStore(state => state.setUser);

    const [hydrated, setHydrated] = React.useState(false);

    // SECURITY: Completely disabled in production - no localStorage bypass allowed
    const isProduction = import.meta.env.MODE === 'production' || import.meta.env.PROD === true;

    // In test mode only (NOT production), hydrate user and allow access
    const isTestMode = !isProduction && (
        import.meta.env.MODE === 'test' ||
        import.meta.env.VITE_USE_EMULATORS === 'true' ||
        (typeof window !== 'undefined' &&
            (window as unknown as { __TEST_MODE__: boolean }).__TEST_MODE__)
    );

    useEffect(() => {
        if (isTestMode) {
            const e2eUser = localStorage.getItem('E2E_TEST_USER');

            // Defers updates to avoid synchronous setState warning
            const timer = setTimeout(() => {
                if (e2eUser) {
                    try {
                        setUser(JSON.parse(e2eUser));
                    } catch (e) {
                        ErrorLogger.error(e, 'TestGuards.parseE2EUser');
                    }
                } else {
                    // Fallback hardcoded user for robustness
                    setUser({
                        uid: "e2e-fallback",
                        email: "test@sentinel.com",
                        displayName: "Test Admin",
                        organizationId: "org_default",
                        role: "admin",
                        onboardingCompleted: true,
                        emailVerified: true
                    });
                }
                useStore.getState().setLoading(false);
                setHydrated(true);
            }, 0);

            return () => clearTimeout(timer);
        }

        // ALWAYS LOG


    }, [setUser, isTestMode]);

    if (isTestMode) {
        if (!hydrated) return null;
        return <>{children}</>;
    }

    // SECURITY: In production, never allow mock auth - always redirect to login
    const isProductionEnv = import.meta.env.MODE === 'production' || import.meta.env.PROD === true;
    if (isProductionEnv) {
        return <Navigate to="/login" replace />;
    }

    let isAuthorized = false;

    // Check for mock auth state (development/test only)
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
// SECURITY: Only enabled in non-production environments
export const TestRoleGuard: React.FC<{
    children: React.ReactNode;
    allowedRoles?: string[]
}> = ({ children, allowedRoles = [] }) => {
    // SECURITY: Completely disabled in production
    const isProduction = import.meta.env.MODE === 'production' || import.meta.env.PROD === true;
    if (isProduction) {
        return <Navigate to="/" replace />;
    }

    // In test mode only (NOT production), always allow access
    if (import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_EMULATORS === 'true') {
        return <>{children}</>;
    }

    let isAuthorized = false;

    // Check for mock user with role (development only)
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
