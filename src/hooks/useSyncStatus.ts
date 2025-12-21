import { useState, useEffect } from 'react';

export interface SyncStatus {
    isOnline: boolean;
    lastSynced: Date | null;
    pendingWrites: boolean;
}

export const useSyncStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [lastSynced, setLastSynced] = useState<Date | null>(new Date());
    // Tracking pending writes globally is hard without a specific listener, 
    // but we can track online/offline changes as a proxy for "reconnecting/syncing"

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setLastSynced(new Date());
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, lastSynced };
};
