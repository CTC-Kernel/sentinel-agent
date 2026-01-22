import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../ui/LoadingScreen';

interface SuperAdminGuardProps {
    children: React.ReactNode;
}

/**
 * AUDIT FIX: Renommé conceptuellement "AdminLevelGuard"
 *
 * Ce guard autorise l'accès aux utilisateurs avec des privilèges administrateur:
 * - super_admin: Administrateur système global (multi-tenant)
 * - admin: Administrateur d'organisation (tenant-level)
 *
 * Pour un guard strictement super_admin uniquement, créer un nouveau composant
 * qui vérifie UNIQUEMENT user.role === 'super_admin' ET les custom claims Firebase.
 *
 * @see /firestore.rules - isSuperAdmin() pour la logique serveur correspondante
 */
export const SuperAdminGuard: React.FC<SuperAdminGuardProps> = ({ children }) => {
    const { user, loading, firebaseUser } = useAuth();
    const location = useLocation();

    // Loading state
    if (loading) {
        return <LoadingScreen />;
    }

    // No user authenticated
    if (!firebaseUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // User authenticated but profile not loaded yet
    if (!user) {
        return <LoadingScreen />;
    }

    // AUDIT FIX: Documentation clarifiée - autorise admin ET super_admin
    // C'est intentionnel pour permettre aux admins d'organisation d'accéder
    // aux fonctions administratives de leur tenant
    const hasAdminPrivileges = user.role === 'super_admin' || user.role === 'admin';

    if (!hasAdminPrivileges) {
        // Utilisateurs non-admin redirigés vers le dashboard principal
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

/**
 * Guard strict pour super_admin uniquement (multi-tenant system admin)
 * Utiliser ce guard pour les routes qui ne doivent être accessibles
 * qu'aux administrateurs système globaux.
 */
export const StrictSuperAdminGuard: React.FC<SuperAdminGuardProps> = ({ children }) => {
    const { user, loading, firebaseUser } = useAuth();
    const location = useLocation();

    if (loading) {
        return <LoadingScreen />;
    }

    if (!firebaseUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!user) {
        return <LoadingScreen />;
    }

    // STRICT: Uniquement super_admin
    if (user.role !== 'super_admin') {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
