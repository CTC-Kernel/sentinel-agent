import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Asset, Risk, Project, Audit, Incident, Supplier, Control } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';

// Helper to convert Firestore Timestamps to ISO strings
const convertTimestamps = (obj: unknown): unknown => {
    if (!obj || typeof obj !== 'object') return obj;

    // Handle Firestore Timestamp
    const timestampObj = obj as { seconds?: number; nanoseconds?: number };
    if (timestampObj.seconds !== undefined && timestampObj.nanoseconds !== undefined) {
        return new Date(timestampObj.seconds * 1000).toISOString();
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => convertTimestamps(item));
    }

    // Handle objects recursively
    const converted: Record<string, unknown> = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            converted[key] = convertTimestamps((obj as Record<string, unknown>)[key]);
        }
    }
    return converted;
};

export const useVoxels = () => {
    const { user } = useStore();
    const [loading, setLoading] = useState(true);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [audits, setAudits] = useState<Audit[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [controls, setControls] = useState<Control[]>([]);

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

            setAssets(assetsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Asset[]);
            setRisks(risksSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Risk[]);
            setProjects(projectsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Project[]);
            setAudits(auditsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Audit[]);
            setIncidents(incidentsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Incident[]);
            setSuppliers(suppliersSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Supplier[]);
            setControls(controlsSnap.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() })) as Control[]);

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'useVoxels.fetchData', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    }, [user?.organizationId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refresh = () => {
        fetchData();
    };

    return {
        loading,
        assets,
        risks,
        projects,
        audits,
        incidents,
        suppliers,
        controls,
        refresh
    };
};
