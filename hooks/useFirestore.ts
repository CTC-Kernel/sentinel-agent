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

export const useFirestoreCollection = <T = DocumentData>(
    collectionName: string,
    constraints: QueryConstraint[] = [],
    options: UseFirestoreOptions = { realtime: false, logError: true, enabled: true }
): UseFirestoreReturn<T & { id: string }> => {
    const [data, setData] = useState<(T & { id: string })[]>([]);
    const [loading, setLoading] = useState(options.enabled !== false);
    const [error, setError] = useState<Error | null>(null);

    // Memoize constraints to prevent infinite loops if passed as a new array every render
    // We stringify the entire constraints array to capture values (e.g. where clauses)
    const constraintsKey = JSON.stringify(constraints);
    const { realtime, logError, enabled } = options;
    const isEnabled = enabled !== false;

    const fetchData = useCallback(async () => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const q = query(collection(db, collectionName), ...constraints);
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
            setData(docs);
        } catch (err: unknown) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            setError(errorObj);
            if (logError) {
                ErrorLogger.error(errorObj, `useFirestoreCollection.fetchData.${collectionName}`);
            }
        } finally {
            setLoading(false);
        }
    }, [collectionName, constraintsKey, logError, isEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isEnabled) {
            setLoading(false);
            return;
        }

        if (realtime) {
            setLoading(true);
            const q = query(collection(db, collectionName), ...constraints);
            const unsubscribe = onSnapshot(q,
                (snapshot) => {
                    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
                    setData(docs);
                    setLoading(false);
                },
                (err: unknown) => {
                    const errorObj = err instanceof Error ? err : new Error(String(err));
                    setError(errorObj);
                    if (logError) {
                        ErrorLogger.error(errorObj, `useFirestoreCollection.onSnapshot.${collectionName}`);
                    }
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        } else {
            fetchData();
        }
    }, [collectionName, constraintsKey, realtime, fetchData, isEnabled, logError]); // eslint-disable-line react-hooks/exhaustive-deps

    const add = async (newData: WithFieldValue<DocumentData>) => {
        try {
            const docRef = await addDoc(collection(db, collectionName), newData);
            if (!options.realtime) await fetchData(); // Manually refresh if not realtime
            return docRef.id;
        } catch (err: unknown) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            if (options.logError) ErrorLogger.error(errorObj, `useFirestoreCollection.add.${collectionName}`);
            throw errorObj;
        }
    };

    const update = async (id: string, updateData: UpdateData<DocumentData>) => {
        try {
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, updateData);
            if (!options.realtime) await fetchData();
        } catch (err: unknown) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            if (options.logError) ErrorLogger.error(errorObj, `useFirestoreCollection.update.${collectionName}`);
            throw errorObj;
        }
    };

    const remove = async (id: string) => {
        try {
            const docRef = doc(db, collectionName, id);
            await deleteDoc(docRef);
            if (!options.realtime) await fetchData();
        } catch (err: unknown) {
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
    const { realtime, logError } = options;

    const fetchData = useCallback(async () => {
        if (!docId) return;
        setLoading(true);

        try {
            const docRef = doc(db, collectionName, docId);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                setData({ id: snapshot.id, ...snapshot.data() } as T);
            } else {
                setData(null);
            }
        } catch (err: unknown) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            setError(errorObj);
            if (logError) {
                ErrorLogger.error(errorObj, `useFirestoreDocument.fetchData.${collectionName}.${docId}`);
            }
        } finally {
            setLoading(false);
        }
    }, [collectionName, docId, logError]);



    useEffect(() => {
        if (!docId) {
            setData(null);
            setLoading(false);
            return;
        }

        if (realtime) {
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
                (err: unknown) => {
                    const errorObj = err instanceof Error ? err : new Error(String(err));
                    setError(errorObj);
                    if (logError) {
                        ErrorLogger.error(errorObj, `useFirestoreDocument.onSnapshot.${collectionName}.${docId}`);
                    }
                    setLoading(false);
                }
            );
            return () => unsubscribe();
        } else {
            fetchData();
        }
    }, [collectionName, docId, realtime, fetchData, logError]);

    return { data, loading, error, refresh: fetchData };
};
