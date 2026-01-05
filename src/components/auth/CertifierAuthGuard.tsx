import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../firebase';
import { Loader2 } from 'lucide-react';

interface CertifierAuthGuardProps {
    children: React.ReactNode;
}

export const CertifierAuthGuard: React.FC<CertifierAuthGuardProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Wait for auth to be ready
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (!user) {
                // Redirect to login if no user found
                // Pass current location state to allow redirect back after login if needed
                navigate('/portal/login', {
                    state: { from: location },
                    replace: true
                });
            } else {
                // User is authenticated
                // Ideally we should also check if the user has a 'certifier' claim or role
                // But for now, basic auth check is the MVP requirement
                setIsLoading(false);
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
