
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Asset, Risk, Project, Audit, Incident, Supplier, Control } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';

// Optimized Helper to convert Firestore Timestamps to ISO strings
const convertTimestamps = (obj: unknown): unknown => {
    if (!obj || typeof obj !== 'object') return obj;

    // Handle Firestore Timestamp
    const timestampObj = obj as { seconds?: number; nanoseconds?: number };
    if (typeof timestampObj.seconds === 'number') {
        return new Date(timestampObj.seconds * 1000).toISOString();
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => convertTimestamps(item));
    }

    // Handle objects recursively
    if (obj.constructor === Object) {
        const converted: Record<string, unknown> = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                converted[key] = convertTimestamps((obj as Record<string, unknown>)[key]);
            }
        }
        return converted;
    }

    return obj;
};

export const useVoxels = () => {
    const { user } = useStore();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        assets: Asset[];
        risks: Risk[];
        projects: Project[];
        audits: Audit[];
        incidents: Incident[];
        suppliers: Supplier[];
        controls: Control[];
    }>({
        assets: [],
        risks: [],
        projects: [],
        audits: [],
        incidents: [],
        suppliers: [],
        controls: []
    });

    const fetchData = useCallback(async () => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const orgId = user.organizationId;

        // Resilient fetch helper
        const fetchCollection = async <T>(collectionName: string): Promise<T[]> => {
            try {
                const q = query(collection(db, collectionName), where('organizationId', '==', orgId));
                const snap = await getDocs(q);
                return snap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as T[];
            } catch (error) {
                // Log silently to avoid spamming user, but ensure we return empty array
                console.warn(`[useVoxels] Failed to fetch ${collectionName}`, error);
                ErrorLogger.error(error as Error, `useVoxels.fetchCollection.${collectionName}`);
                return [];
            }
        };

        try {
            const [
                assets,
                risks,
                projects,
                audits,
                incidents,
                suppliers,
                controls
            ] = await Promise.all([
                fetchCollection<Asset>('assets'),
                fetchCollection<Risk>('risks'),
                fetchCollection<Project>('projects'),
                fetchCollection<Audit>('audits'),
                fetchCollection<Incident>('incidents'),
                fetchCollection<Supplier>('suppliers'),
                fetchCollection<Control>('controls')
            ]);

            setData({
                assets,
                risks,
                projects,
                audits,
                incidents,
                suppliers,
                controls
            });

        } catch (error) {
            // This catch block might not be reached due to internal catches, 
            // but good for unexpected sync errors
            ErrorLogger.handleErrorWithToast(error, 'useVoxels.fetchData', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    }, [user?.organizationId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refresh = useCallback(() => {
        fetchData();
    }, [fetchData]);

    return {
        loading,
        ...data,
        refresh
    };
};
