import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.1 });

export const RouteProgressBar = () => {
    const location = useLocation();

    useEffect(() => {
        NProgress.start();
        // Complete the bar shortly after the start/location change
        // In a real SPA, this is instant, but the visual cue helps.
        const timer = setTimeout(() => {
            NProgress.done();
        }, 150); // Small delay to make it visible

        return () => {
            clearTimeout(timer);
            NProgress.done();
        };
    }, [location]);

    return null;
};
