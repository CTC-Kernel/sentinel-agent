import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../ui/LoadingScreen';

import { ErrorLogger } from '../../services/errorLogger';

interface AuthGuardProps {
    children: React.ReactNode;
    requireOnboarding?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireOnboarding = true }) => {
    const { user, loading, firebaseUser } = useAuth();

    const location = useLocation();

    if (loading) {
        return <LoadingScreen />;
    }



    if (!firebaseUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!firebaseUser.emailVerified && location.pathname !== '/verify-email') {
        return <Navigate to="/verify-email" replace />;
    }

    if (user && requireOnboarding && (!user.onboardingCompleted || !user.organizationId)) {
        return <Navigate to="/onboarding" replace />;
    }

    if (firebaseUser && !user && !loading && requireOnboarding) {
        ErrorLogger.warn("AuthGuard: Firebase user exists but Firestore profile is missing. Redirecting to Onboarding.", 'AuthGuard');
        return <Navigate to="/onboarding" replace />;
    }

    return <>{children}</>;
};
