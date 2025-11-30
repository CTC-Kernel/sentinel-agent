import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../store';

interface AuthGuardProps {
    children: React.ReactNode;
    requireOnboarding?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireOnboarding = true }) => {
    const { user, loading, firebaseUser } = useAuth();
    const { demoMode } = useStore();
    const location = useLocation();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-slate-900">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>;
    }

    // In Demo Mode, we bypass authentication checks
    if (demoMode) {
        return <>{children}</>;
    }

    if (!firebaseUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (user && requireOnboarding && (!user.onboardingCompleted || !user.organizationId)) {
        return <Navigate to="/onboarding" replace />;
    }

    if (firebaseUser && !user && !loading && requireOnboarding) {
        console.warn("AuthGuard: Firebase user exists but Firestore profile is missing. Redirecting to Onboarding.");
        return <Navigate to="/onboarding" replace />;
    }

    return <>{children}</>;
};
