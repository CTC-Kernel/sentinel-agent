import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../ui/LoadingScreen';

interface AuthGuardProps {
    children: React.ReactNode;
    requireOnboarding?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireOnboarding = true }) => {
    const { t } = useTranslation();
    const { user, loading, firebaseUser, error, profileError, claimsSynced } = useAuth();

    const location = useLocation();

    // Bypass auth in test mode
    if (import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_EMULATORS === 'true') {
        return <>{children}</>;
    }

    if (error) {
        throw error;
    }

    if (loading || (firebaseUser && !claimsSynced)) {
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

    // FIX: If we have a Firebase User but failed to load the Firestore Profile (e.g. timeout),
    // Show a "Retry" screen instead of redirecting to Onboarding (which causes a loop).
    if (firebaseUser && !user && !loading && (requireOnboarding || profileError)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                </div>
                <h1 className="text-2xl font-bold mb-2">{t('auth.connectionError')}</h1>
                <p className="text-muted-foreground max-w-md mb-8">
                    {t('auth.profileLoadError')}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    return <>{children}</>;
};
