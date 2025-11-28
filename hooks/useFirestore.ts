import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    onSnapshot,
    getDocs,
    DocumentData,
    QueryConstraint,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    WithFieldValue,
    UpdateData
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from '../services/errorLogger';
import { useStore } from '../store';
import {
    demoAssets, demoRisks, demoControls, demoProjects, demoAudits,
    demoIncidents, demoSuppliers, demoProcessingActivities,
    demoBusinessProcesses, demoBcpDrills, demoDocuments, demoUsers, demoLogs,
    demoSupplierAssessments, demoSupplierIncidents, demoFindings
} from '../data/demoData';

interface UseFirestoreOptions {
    realtime?: boolean;
    logError?: boolean;
    enabled?: boolean;
}

interface UseFirestoreReturn<T> {
    data: T[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    add: (data: WithFieldValue<DocumentData>) => Promise<string>;
    update: (id: string, data: UpdateData<DocumentData>) => Promise<void>;
    remove: (id: string) => Promise<void>;
}

// Helper to get demo data by collection name
const getDemoDataForCollection = (collectionName: string): any[] => {
    switch (collectionName) {
        case 'assets': return demoAssets;
        case 'risks': return demoRisks;
        case 'controls': return demoControls;
        case 'projects': return demoProjects;
        case 'audits': return demoAudits;
        case 'incidents': return demoIncidents;
        case 'suppliers': return demoSuppliers;
        case 'processing_activities': return demoProcessingActivities;
        case 'business_processes': return demoBusinessProcesses;
        case 'bcp_drills': return demoBcpDrills;
        case 'documents': return demoDocuments;
        case 'users': return demoUsers;
        case 'system_logs': return demoLogs;
        case 'supplierAssessments': return demoSupplierAssessments;
        case 'supplierIncidents': return demoSupplierIncidents;
        case 'findings': return demoFindings;
        default: return [];
    }
};

export const useFirestoreCollection = <T = DocumentData>(
    collectionName: string,
    constraints: QueryConstraint[] = [],
    options: UseFirestoreOptions = { realtime: false, logError: true, enabled: true }
): UseFirestoreReturn<T & { id: string }> => {
    const [data, setData] = useState<(T & { id: string })[]>([]);
    const [loading, setLoading] = useState(options.enabled !== false);
    const [error, setError] = useState<Error | null>(null);
    const { demoMode, addToast } = useStore();

    // Memoize constraints to prevent infinite loops if passed as a new array every render
    // We stringify the entire constraints array to capture values (e.g. where clauses)
    const constraintsKey = JSON.stringify(constraints);
    const isEnabled = options.enabled !== false;

    const fetchData = useCallback(async () => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        if (demoMode) {
            // Simulate network delay
            setTimeout(() => {
                const mockData = getDemoDataForCollection(collectionName);
                setData(mockData as (T & { id: string })[]);
                setLoading(false);
            }, 500);
            return;
        }

        try {
            const q = query(collection(db, collectionName), ...constraints);
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
            setData(docs);
        } catch (err) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            setError(errorObj);
            if (options.logError) {
                ErrorLogger.error(errorObj, `useFirestoreCollection.fetchData.${collectionName}`);
            }
        } finally {
            if (!demoMode) setLoading(false);
        }
    }, [collectionName, constraintsKey, options.logError, demoMode, isEnabled]);

    useEffect(() => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }

        if (demoMode) {
            fetchData();
            return;
        }

        if (options.realtime) {
            setLoading(true);
            const q = query(collection(db, collectionName), ...constraints);
            const unsubscribe = onSnapshot(q,
                (snapshot) => {
                    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
                    setData(docs);
                    setLoading(false);
                },
                (err) => {
                    const errorObj = err instanceof Error ? err : new Error(String(err));
                    setError(errorObj);
                    if (options.logError) {
                        ErrorLogger.error(errorObj, `useFirestoreCollection.onSnapshot.${collectionName}`);
                    }
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        } else {
            fetchData();
        }
    }, [collectionName, constraintsKey, options.realtime, fetchData, demoMode, isEnabled]);

    const add = async (newData: WithFieldValue<DocumentData>) => {
        if (demoMode) {
            addToast("Action simulée en mode démo (non sauvegardé)", "info");
            return "demo-new-id-" + Date.now();
        }
        try {
            const docRef = await addDoc(collection(db, collectionName), newData);
            if (!options.realtime) await fetchData(); // Manually refresh if not realtime
            return docRef.id;
        } catch (err) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            if (options.logError) ErrorLogger.error(errorObj, `useFirestoreCollection.add.${collectionName}`);
            throw errorObj;
        }
    };

    const update = async (id: string, updateData: UpdateData<DocumentData>) => {
        if (demoMode) {
            addToast("Action simulée en mode démo (non sauvegardé)", "info");
            // Optimistically update local state for demo feel
            setData(prev => prev.map(item => item.id === id ? { ...item, ...updateData } : item));
            return;
        }
        try {
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, updateData);
            if (!options.realtime) await fetchData();
        } catch (err) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            if (options.logError) ErrorLogger.error(errorObj, `useFirestoreCollection.update.${collectionName}`);
            throw errorObj;
        }
    };

    const remove = async (id: string) => {
        if (demoMode) {
            addToast("Action simulée en mode démo (non sauvegardé)", "info");
            setData(prev => prev.filter(item => item.id !== id));
            return;
        }
        try {
            const docRef = doc(db, collectionName, id);
            await deleteDoc(docRef);
            if (!options.realtime) await fetchData();
        } catch (err) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            if (options.logError) ErrorLogger.error(errorObj, `useFirestoreCollection.remove.${collectionName}`);
            throw errorObj;
        }
    };

    return { data, loading, error, refresh: fetchData, add, update, remove };
};

export const useFirestoreDocument = <T extends { id: string }>(
    collectionName: string,
    docId: string | undefined,
    options: UseFirestoreOptions = { realtime: false, logError: true }
) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(!!docId);
    const [error, setError] = useState<Error | null>(null);
    const { demoMode } = useStore();

    const fetchData = useCallback(async () => {
        if (!docId) return;
        setLoading(true);

        if (demoMode) {
            setTimeout(() => {
                const mockCollection = getDemoDataForCollection(collectionName);
                const mockDoc = mockCollection.find(d => d.id === docId);
                setData(mockDoc ? (mockDoc as T) : null);
                setLoading(false);
            }, 500);
            return;
        }

        try {
            const docRef = doc(db, collectionName, docId);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                setData({ id: snapshot.id, ...snapshot.data() } as T);
            } else {
                setData(null);
            }
        } catch (err) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            setError(errorObj);
            if (options.logError) {
                ErrorLogger.error(errorObj, `useFirestoreDocument.fetchData.${collectionName}.${docId}`);
            }
        } finally {
            if (!demoMode) setLoading(false);
        }
    }, [collectionName, docId, options.logError, demoMode]);

    useEffect(() => {
        if (!docId) {
            setData(null);
            setLoading(false);
            return;
        }

        if (demoMode) {
            fetchData();
            return;
        }

        if (options.realtime) {
            setLoading(true);
            const docRef = doc(db, collectionName, docId);
            const unsubscribe = onSnapshot(docRef,
                (snapshot) => {
                    if (snapshot.exists()) {
                        setData({ id: snapshot.id, ...snapshot.data() } as T);
                    } else {
                        setData(null);
                    }
                    setLoading(false);
                },
                (err) => {
                    const errorObj = err instanceof Error ? err : new Error(String(err));
                    setError(errorObj);
                    if (options.logError) {
                        ErrorLogger.error(errorObj, `useFirestoreDocument.onSnapshot.${collectionName}.${docId}`);
                    }
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        } else {
            fetchData();
        }
    }, [collectionName, docId, options.realtime, fetchData, demoMode]);

    return { data, loading, error, refresh: fetchData };
};
