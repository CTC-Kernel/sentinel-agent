import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingScreen } from '../ui/LoadingScreen';

export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { loading, firebaseUser } = useAuth();
    const location = useLocation();

    if (loading) {
        return <LoadingScreen />;
    }

    if (firebaseUser) {
        // Rediriger vers la page d'origine ou le dashboard
        const from = (location.state as any)?.from?.pathname || '/';
        return <Navigate to={from} replace />;
    }

    return <>{children}</>;
};
