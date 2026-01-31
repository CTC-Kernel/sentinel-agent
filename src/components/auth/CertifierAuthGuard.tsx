import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../firebase';
import { Loader2 } from '../ui/Icons';

interface CertifierAuthGuardProps {
    children: React.ReactNode;
}

export const CertifierAuthGuard: React.FC<CertifierAuthGuardProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Wait for auth to be ready
        const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
            if (!authUser) {
                // Redirect to login if no user found
                // Pass current location state to allow redirect back after login if needed
                navigate('/portal/login', {
                    state: { from: location },
                    replace: true
                });
            } else {
                // User is authenticated - verify they have certifier or admin role
                try {
                    const tokenResult = await authUser.getIdTokenResult();
                    if (tokenResult.claims.role !== 'certifier' && tokenResult.claims.role !== 'admin' && tokenResult.claims.role !== 'super_admin') {
                        // Not a certifier - redirect to home
                        navigate('/', { replace: true });
                        setIsLoading(false);
                        return;
                    }
                    setIsLoading(false);
                } catch {
                    // If token verification fails, redirect to login
                    navigate('/portal/login', {
                        state: { from: location },
                        replace: true
                    });
                }
            }
        });

        return () => unsubscribe();
    }, [navigate, location]);

    if (isLoading) {
        return (
            <div className="flex bg-slate-50 dark:bg-slate-900 h-screen w-full items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
};
