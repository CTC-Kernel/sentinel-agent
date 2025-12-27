import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { db, auth } from '../firebase';
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

const stableValueKey = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
    if (value instanceof Date) return `date:${value.toISOString()}`;

    const maybeTimestamp = value as { seconds?: number; nanoseconds?: number };
    if (
        value &&
        typeof value === 'object' &&
        typeof maybeTimestamp.seconds === 'number' &&
        typeof maybeTimestamp.nanoseconds === 'number'
    ) {
        return `ts:${maybeTimestamp.seconds}:${maybeTimestamp.nanoseconds}`;
    }

    try {
        return `json:${JSON.stringify(value)}`;
    } catch {
        return `str:${String(value)}`;
    }
};

const stableConstraintKey = (c: QueryConstraint): string => {
    const anyC = c as unknown as {
        type?: string;
        fieldPath?: unknown;
        opStr?: unknown;
        value?: unknown;
        directionStr?: unknown;
        limit?: unknown;
    };

    const type = anyC.type ?? 'unknown';

    const fieldPathObj = anyC.fieldPath as unknown as { canonicalString?: () => string } | undefined;
    const fieldKey = fieldPathObj?.canonicalString ? fieldPathObj.canonicalString() : stableValueKey(anyC.fieldPath);
    const opKey = stableValueKey(anyC.opStr);
    const valueKey = stableValueKey(anyC.value);
    const dirKey = stableValueKey(anyC.directionStr);
    const limitKey = stableValueKey(anyC.limit);

    // Keep all parts to make key stable across renders and constraint recreation
    return [type, fieldKey, opKey, valueKey, dirKey, limitKey].join(':');
};


export const useFirestoreCollection = <T = DocumentData>(
    collectionName: string,
    constraints: QueryConstraint[] = [],
    options: UseFirestoreOptions = { realtime: false, logError: true, enabled: true }
): UseFirestoreReturn<T & { id: string }> => {
    const [realtimeData, setRealtimeData] = useState<(T & { id: string })[]>([]);
    const [realtimeLoading, setRealtimeLoading] = useState(options.enabled !== false);
    const [realtimeError, setRealtimeError] = useState<Error | null>(null);
    const [realtimeFailed, setRealtimeFailed] = useState(false);

    const queryClient = useQueryClient();

    const constraintsKey = useMemo(() => {
        // JSON.stringify is unreliable for Firestore QueryConstraint objects.
        // Use their string representation (and type if available) to build a stable key.
        return constraints.map(stableConstraintKey).join('|');
    }, [constraints]);

    // Keep a stable constraints array reference as long as constraintsKey doesn't change.
    const constraintsRef = useRef<{ key: string; value: QueryConstraint[] }>({ key: '', value: [] });
    useEffect(() => {
        if (constraintsRef.current.key !== constraintsKey) {
            constraintsRef.current = { key: constraintsKey, value: constraints };
        }
    }, [constraintsKey, constraints]);

    const { realtime, logError, enabled } = options;
    const isEnabled = enabled !== false;
    const shouldUseRealtime = realtime && !realtimeFailed;

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
        enabled: isEnabled && !shouldUseRealtime,
        // Don't refetch on window focus for firestore usually to save reads, but can be configured
        staleTime: 1000 * 60 * 5 // 5 minutes default
    });

    // Realtime implementation
    useEffect(() => {
        if (!isEnabled || !shouldUseRealtime) {
            if (!shouldUseRealtime) {
                setTimeout(() => setRealtimeLoading(false), 0);
            }
            return;
        }

        // Avoid synchronous state update warning
        setTimeout(() => setRealtimeLoading(true), 0);

        let timeoutId: number | null = null;
        timeoutId = window.setTimeout(() => {
            setRealtimeFailed(true);
            setRealtimeLoading(false);
        }, 12000);

        const q = query(collection(db, collectionName), ...constraintsRef.current.value);
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
                setRealtimeData(docs);
                setRealtimeLoading(false);
                if (timeoutId !== null) window.clearTimeout(timeoutId);
            },
            (err: unknown) => {
                const errorObj = err instanceof Error ? err : new Error(String(err));

                // Suppress 'permission-denied' errors if user is logged out (race condition on signout)
                const code = (errorObj as { code?: string }).code;
                const isPermissionError = code === 'permission-denied' || errorObj.message.includes('permission-denied');

                if (isPermissionError) {
                    // Gracefully handle logout race condition
                    // If auth.currentUser is null, OR we are in a transition state, suppress.
                    if (!auth.currentUser) {
                        setRealtimeLoading(false);
                        return;
                    }
                    // Optional: could add a check for 'isBlocked' from store if available, but hooks are decoupled.
                }

                setRealtimeError(errorObj);
                if (logError) {
                    ErrorLogger.error(errorObj, `useFirestoreCollection.onSnapshot.${collectionName}`);
                }
                setRealtimeFailed(true);
                setRealtimeLoading(false);
                if (timeoutId !== null) window.clearTimeout(timeoutId);
            }
        );
        return () => {
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            unsubscribe();
        };
    }, [collectionName, constraintsKey, shouldUseRealtime, isEnabled, logError]); // constraintsRef is stable

    const add = useCallback(async (newData: WithFieldValue<DocumentData>) => {
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
    }, [collectionName, logError, queryClient, realtime]);

    const update = useCallback(async (id: string, updateData: UpdateData<DocumentData>) => {
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
    }, [collectionName, logError, queryClient, realtime]);

    const remove = useCallback(async (id: string) => {
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
    }, [collectionName, logError, queryClient, realtime]);

    // Stable refresh function
    const refresh = useCallback(async () => {
        if (!realtime) await refetch();
    }, [realtime, refetch]);

    // Return logic: if realtime, use local state; otherwise use query state
    if (shouldUseRealtime) {
        return {
            data: realtimeData,
            loading: realtimeLoading,
            error: realtimeError,
            refresh,
            add, update, remove
        };
    }

    return {
        data: queryData || [],
        loading: queryLoading,
        error: queryError as Error | null,
        refresh,
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
            setTimeout(() => {
                setRealtimeData(null);
                setRealtimeLoading(false);
            }, 0);
            return;
        }

        if (realtime) {
            // Avoid synchronous state update warning
            setTimeout(() => setRealtimeLoading(true), 0);
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

                    // Suppress 'permission-denied' errors if user is logged out (race condition on signout)
                    const code = (errorObj as { code?: string }).code;
                    const isPermissionError = code === 'permission-denied' || errorObj.message.includes('permission-denied');

                    if (isPermissionError) {
                        if (!auth.currentUser) {
                            setRealtimeLoading(false);
                            return;
                        }
                    }

                    setRealtimeError(errorObj);
                    if (logError) {
                        ErrorLogger.error(errorObj, `useFirestoreDocument.onSnapshot.${collectionName}.${docId}`);
                    }
                    setRealtimeLoading(false);
                }
            );
            return () => unsubscribe();
        }
    }, [collectionName, docId, realtime, logError]); // db and ErrorLogger are imports, no need in dep array

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
