import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Asset, Risk, Project, Audit, Incident, Supplier, Control } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';

// Optimized Helper to convert Firestore Timestamps to ISO strings
// Moved outside component to prevent recreation
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
    // We only traverse plain objects
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
        try {
            const orgId = user.organizationId;

            const [
                assetsSnap,
                risksSnap,
                projectsSnap,
                auditsSnap,
                incidentsSnap,
                suppliersSnap,
                controlsSnap
            ] = await Promise.all([
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', orgId))),
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', orgId))),
                getDocs(query(collection(db, 'projects'), where('organizationId', '==', orgId))),
                getDocs(query(collection(db, 'audits'), where('organizationId', '==', orgId))),
                getDocs(query(collection(db, 'incidents'), where('organizationId', '==', orgId))),
                getDocs(query(collection(db, 'suppliers'), where('organizationId', '==', orgId))),
                getDocs(query(collection(db, 'controls'), where('organizationId', '==', orgId)))
            ]);

            // Batch update to prevent multiple re-renders
            setData({
                assets: assetsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Asset[],
                risks: risksSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Risk[],
                projects: projectsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Project[],
                audits: auditsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Audit[],
                incidents: incidentsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Incident[],
                suppliers: suppliersSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Supplier[],
                controls: controlsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Control[]
            });

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useVoxels.fetchData', 'FETCH_FAILED');
            // Reset to empty on error to avoid stale state issues, or keep previous state? 
            // Better to keep previous state but log error in this context.
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
