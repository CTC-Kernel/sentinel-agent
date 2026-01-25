import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.1 });

export const RouteProgressBar = () => {
    const location = useLocation();
    const isFetching = useIsFetching();
    const isMutating = useIsMutating();

    // Track latest state for timeout closure
    const loadingStateRef = useRef({ isFetching, isMutating });
    useEffect(() => {
        loadingStateRef.current = { isFetching, isMutating };
    }, [isFetching, isMutating]);

    // Trigger on route change (for Lazy loading / initial rendering)
    useEffect(() => {
        NProgress.start();
        // Fallback cleanup if no data fetching happens
        const timer = setTimeout(() => {
            const { isFetching: f, isMutating: m } = loadingStateRef.current;
            if (f === 0 && m === 0) {
                NProgress.done();
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [location.pathname]); // key on pathname to avoid search param spam if needed

    // Trigger on Data Fetching or Mutation
    useEffect(() => {
        if (isFetching > 0 || isMutating > 0) {
            NProgress.start();
        } else {
            NProgress.done();
        }
    }, [isFetching, isMutating]);

    return null;
};
