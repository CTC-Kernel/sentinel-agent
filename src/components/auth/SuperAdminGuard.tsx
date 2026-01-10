import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../ui/LoadingScreen';

interface SuperAdminGuardProps {
    children: React.ReactNode;
}

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

    // User authenticated but profile not loaded yet (should ideally be handled by loading)
    if (!user) {
        return <LoadingScreen />;
    }

    // Check Role - Allow both super_admin and admin
    if (user.role !== 'super_admin' && user.role !== 'admin') {
        // Redirect standard users to their dashboard or a 403 page
        // For now, redirecting to root (which handles redirection based on role usually) or 404
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
