import { useState, useEffect } from 'react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';

export const useSystemHealth = () => {
    const { user } = useStore();
    const [userCount, setUserCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Simulated system stats
    const [systemLoad, setSystemLoad] = useState(24);
    const [memoryUsage, setMemoryUsage] = useState(42);
    const [networkLatency, setNetworkLatency] = useState(35);

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!user?.organizationId) return;
            try {
                // Fetch real user count filtered by Org
                const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
                const snapshot = await getCountFromServer(q);
                setUserCount(snapshot.data().count);
            } catch (error) {
                // Log silently as this is a dashboard widget
                ErrorLogger.error(error as Error, 'useSystemHealth.fetchMetrics');
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();

        // Simulate live metric updates
        const interval = setInterval(() => {
            setSystemLoad(prev => Math.min(Math.max(prev + (Math.random() - 0.5) * 5, 10), 60));
            setMemoryUsage(prev => Math.min(Math.max(prev + (Math.random() - 0.5) * 3, 30), 80));
            setNetworkLatency(prev => Math.min(Math.max(prev + (Math.random() - 0.5) * 10, 20), 80));
        }, 3000);

        return () => clearInterval(interval);
    }, [user?.organizationId]);

    return {
        userCount,
        loading,
        metrics: {
            systemLoad,
            memoryUsage,
            networkLatency
        }
    };
};
