import { useState, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LoadingScreen } from './LoadingScreen';

export const NavigationLoader = () => {
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);

    // useLayoutEffect runs synchronously after DOM updates but before paint.
    // However, for route changes, we want to trigger this *as soon as* the location changes.
    // React Router updates location, this effect fires.
    useLayoutEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoading(true);

        // Force the loader to stay for at least 800ms to allow the animation to be seen
        // and to mask the "flash" of the next page rendering securely.
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 800);

        return () => clearTimeout(timer);
    }, [location.pathname]); // Only trigger on path changes, not hash/search if unnecessary

    if (!isLoading) return null;

    return <LoadingScreen message="Chargement sécurisé..." />;
};
