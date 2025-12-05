import { useState, useEffect } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';

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
    const [realtimeData, setRealtimeData] = useState<(T & { id: string })[]>([]);
    const [realtimeLoading, setRealtimeLoading] = useState(options.enabled !== false);
    const [realtimeError, setRealtimeError] = useState<Error | null>(null);

    const queryClient = useQueryClient();
    const constraintsKey = JSON.stringify(constraints); // Stable string for key
    const { realtime, logError, enabled } = options;
    const isEnabled = enabled !== false;

    // React Query implementation for non-realtime
    const {
        data: queryData,
        isLoading: queryLoading,
        error: queryError,
        refetch
    } = useQuery({
        queryKey: ['firestore', collectionName, constraintsKey],
        queryFn: async () => {
            try {
                const q = query(collection(db, collectionName), ...constraints);
                const snapshot = await getDocs(q);
                return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
            } catch (err) {
                const errorObj = err instanceof Error ? err : new Error(String(err));
                if (logError) {
                    ErrorLogger.error(errorObj, `useFirestoreCollection.fetchData.${collectionName}`);
                }
                throw errorObj;
            }
        },
        enabled: isEnabled && !realtime,
        // Don't refetch on window focus for firestore usually to save reads, but can be configured
        staleTime: 1000 * 60 * 5 // 5 minutes default
    });

    // Realtime implementation
    useEffect(() => {
        if (!isEnabled || !realtime) {
            if (!realtime) {
                setRealtimeLoading(false);
            }
            return;
        }

        setRealtimeLoading(true);
        const q = query(collection(db, collectionName), ...constraints);
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
                setRealtimeData(docs);
                setRealtimeLoading(false);
            },
            (err: unknown) => {
                const errorObj = err instanceof Error ? err : new Error(String(err));
                setRealtimeError(errorObj);
                if (logError) {
                    ErrorLogger.error(errorObj, `useFirestoreCollection.onSnapshot.${collectionName}`);
                }
                setRealtimeLoading(false);
            }
        );
        return () => unsubscribe();
    }, [collectionName, constraintsKey, realtime, isEnabled, logError]);

    const add = async (newData: WithFieldValue<DocumentData>) => {
        try {
            const docRef = await addDoc(collection(db, collectionName), newData);
            if (!realtime) {
                // Invalidate query to trigger refetch
                await queryClient.invalidateQueries({ queryKey: ['firestore', collectionName] });
            }
            return docRef.id;
        } catch (err: unknown) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            if (logError) ErrorLogger.error(errorObj, `useFirestoreCollection.add.${collectionName}`);
            throw errorObj;
        }
    };

    const update = async (id: string, updateData: UpdateData<DocumentData>) => {
        try {
            const docRef = doc(db, collectionName, id);
            await updateDoc(docRef, updateData);
            if (!realtime) {
                await queryClient.invalidateQueries({ queryKey: ['firestore', collectionName] });
            }
        } catch (err: unknown) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            if (logError) ErrorLogger.error(errorObj, `useFirestoreCollection.update.${collectionName}`);
            throw errorObj;
        }
    };

    const remove = async (id: string) => {
        try {
            const docRef = doc(db, collectionName, id);
            await deleteDoc(docRef);
            if (!realtime) {
                await queryClient.invalidateQueries({ queryKey: ['firestore', collectionName] });
            }
        } catch (err: unknown) {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            if (logError) ErrorLogger.error(errorObj, `useFirestoreCollection.remove.${collectionName}`);
            throw errorObj;
        }
    };

    // Return logic: if realtime, use local state; otherwise use query state
    if (realtime) {
        return {
            data: realtimeData,
            loading: realtimeLoading,
            error: realtimeError,
            refresh: async () => { }, // No-op for realtime
            add, update, remove
        };
    }

    return {
        data: queryData || [],
        loading: queryLoading,
        error: queryError as Error | null,
        refresh: async () => { await refetch(); },
        add, update, remove
    };
};

export const useFirestoreDocument = <T extends { id: string }>(
    collectionName: string,
    docId: string | undefined,
    options: UseFirestoreOptions = { realtime: false, logError: true }
) => {
    const [realtimeData, setRealtimeData] = useState<T | null>(null);
    const [realtimeLoading, setRealtimeLoading] = useState(!!docId);
    const [realtimeError, setRealtimeError] = useState<Error | null>(null);

    const { realtime, logError } = options;

    // React Query implementation for non-realtime
    const {
        data: queryData,
        isLoading: queryLoading,
        error: queryError,
        refetch
    } = useQuery({
        queryKey: ['firestore', collectionName, docId],
        queryFn: async () => {
            if (!docId) return null;
            try {
                const docRef = doc(db, collectionName, docId);
                const snapshot = await getDoc(docRef);
                if (snapshot.exists()) {
                    return { id: snapshot.id, ...snapshot.data() } as T;
                }
                return null;
            } catch (err) {
                const errorObj = err instanceof Error ? err : new Error(String(err));
                if (logError) {
                    ErrorLogger.error(errorObj, `useFirestoreDocument.fetchData.${collectionName}.${docId}`);
                }
                throw errorObj;
            }
        },
        enabled: !!docId && !realtime,
        staleTime: 1000 * 60 * 5 // 5 minutes default
    });

    // Realtime implementation
    useEffect(() => {
        if (!docId) {
            setRealtimeData(null);
            setRealtimeLoading(false);
            return;
        }

        if (realtime) {
            setRealtimeLoading(true);
            const docRef = doc(db, collectionName, docId);
            const unsubscribe = onSnapshot(docRef,
                (snapshot) => {
                    if (snapshot.exists()) {
                        setRealtimeData({ id: snapshot.id, ...snapshot.data() } as T);
                    } else {
                        setRealtimeData(null);
                    }
                    setRealtimeLoading(false);
                },
                (err: unknown) => {
                    const errorObj = err instanceof Error ? err : new Error(String(err));
                    setRealtimeError(errorObj);
                    if (logError) {
                        ErrorLogger.error(errorObj, `useFirestoreDocument.onSnapshot.${collectionName}.${docId}`);
                    }
                    setRealtimeLoading(false);
                }
            );
            return () => unsubscribe();
        }
    }, [collectionName, docId, realtime, logError]);

    if (realtime) {
        return { data: realtimeData, loading: realtimeLoading, error: realtimeError, refresh: async () => { } };
    }

    return {
        data: queryData || null,
        loading: queryLoading,
        error: queryError as Error | null,
        refresh: async () => { await refetch(); }
    };
};
