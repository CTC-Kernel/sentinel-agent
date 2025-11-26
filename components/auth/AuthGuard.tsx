import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../ui/LoadingScreen';

interface AuthGuardProps {
    children: React.ReactNode;
    requireOnboarding?: boolean;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requireOnboarding = true }) => {
    const { user, loading, firebaseUser } = useAuth();
    const location = useLocation();

    if (loading) {
        // On peut afficher un spinner ou rien tant que c'est en chargement initial
        // Si on veut éviter le flash, on peut mettre un timer ou juste un spinner minimaliste
        return <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-slate-900">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>;
    }

    if (!firebaseUser) {
        // Rediriger vers la page de login en gardant l'URL d'origine pour redirection après login
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (user && requireOnboarding && (!user.onboardingCompleted || !user.organizationId)) {
        // Si l'utilisateur est connecté mais n'a pas fini l'onboarding
        return <Navigate to="/onboarding" replace />;
    }

    return <>{children}</>;
};
