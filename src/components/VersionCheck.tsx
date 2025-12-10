import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface VersionInfo {
    version: string;
    timestamp: string;
}

import { ErrorLogger } from '../services/errorLogger';

export const VersionCheck = () => {
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                // Add timestamp to avoid caching of version.json itself
                const response = await fetch(`/version.json?t=${new Date().getTime()}`);
                if (!response.ok) return;

                const data: VersionInfo = await response.json();

                if (!currentVersion) {
                    setCurrentVersion(data.version);
                } else if (currentVersion !== data.version) {
                    // New version detected
                    toast.info("Une nouvelle version est disponible", {
                        description: "L'application va se recharger pour appliquer la mise à jour.",
                        duration: Infinity,
                        action: {
                            label: "Mettre à jour",
                            onClick: () => window.location.reload(),
                        },
                    });
                }
            } catch (error) {
                ErrorLogger.warn('Failed to check version', 'VersionCheck', { metadata: { error } });
            }
        };

        // Check immediately
        checkVersion();

        // Check every 5 minutes
        const interval = setInterval(checkVersion, 5 * 60 * 1000);

        // Also check on visibility change (when user comes back to tab)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkVersion();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [currentVersion]);

    return null;
};
