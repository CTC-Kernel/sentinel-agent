import { db, storage } from '../firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { ref, listAll } from 'firebase/storage';
import { ErrorLogger } from './errorLogger';

export interface ServiceHealth {
    name: string;
    status: 'operational' | 'degraded' | 'outage';
    latency: number;
    error?: string;
}

export const ConnectivityService = {
    /**
     * Measure round-trip time to Firestore
     */
    checkFirestore: async (): Promise<ServiceHealth> => {
        const start = performance.now();
        try {
            // Simple read operation: Get first document from organizations to test connectivity
            // We use limit(1) to minimize data transfer
            const q = query(collection(db, 'organizations'), limit(1));
            await getDocs(q);
            const latency = Math.round(performance.now() - start);

            return {
                name: 'Firestore Database',
                status: latency > 1000 ? 'degraded' : 'operational',
                latency
            };
        } catch (error) {
            ErrorLogger.warn('Firestore check failed', 'ConnectivityService.checkFirestore', { error });
            return {
                name: 'Firestore Database',
                status: 'outage',
                latency: 0,
                error: (error as Error).message
            };
        }
    },

    /**
     * Measure connection to Storage bucket
     */
    checkStorage: async (): Promise<ServiceHealth> => {
        const start = performance.now();
        try {
            // List root items (usually fast, checks permission/connectivity)
            const storageRef = ref(storage, '/');
            await listAll(storageRef);
            const latency = Math.round(performance.now() - start);

            return {
                name: 'Storage',
                status: latency > 1000 ? 'degraded' : 'operational',
                latency
            };
        } catch (error) {
            // Storage rules might deny list on root, which is technically a successful connection (403).
            // We treat specific error codes as 'operational' in terms of connectivity if it proves we reached the server.
            const err = error as { code?: string };
            if (err.code === 'storage/unauthorized') {
                // We connected but were denied. That counts as operational network.
                const latency = Math.round(performance.now() - start);
                return {
                    name: 'Storage',
                    status: 'operational',
                    latency
                };
            }

            return {
                name: 'Storage',
                status: 'outage',
                latency: 0,
                error: (error as Error).message
            };
        }
    },

    /**
     * Check Cloud Functions availability
     * (We don't have a dedicated health endpoint, so this is a simulated checks or calls a known lightweight function)
     */
    checkCloudFunctions: async (): Promise<ServiceHealth> => {
        // No dedicated health endpoint available yet.
        // Returns 'degraded' until a lightweight ping Cloud Function is implemented.
        return {
            name: 'Cloud Functions',
            status: 'degraded',
            latency: 0
        };
    }
};
