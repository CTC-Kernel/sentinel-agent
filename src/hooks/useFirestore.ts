import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { sanitizeData } from '../utils/dataSanitizer';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { MockDataService } from '../services/mockDataService';

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

import { useStore } from '../store';

export const useFirestoreCollection = <T = DocumentData>(
    collectionName: string,
    constraints: QueryConstraint[] = [],
    options: UseFirestoreOptions = { realtime: false, logError: true, enabled: true }
): UseFirestoreReturn<T & { id: string }> => {
    const { demoMode } = useStore();

    const [realtimeData, setRealtimeData] = useState<(T & { id: string })[]>([]);
    const [realtimeLoading, setRealtimeLoading] = useState(options.enabled !== false && !demoMode);
    const [realtimeError, setRealtimeError] = useState<Error | null>(null);
    const [realtimeFailed, setRealtimeFailed] = useState(false);

    const queryClient = useQueryClient();

    const constraintsKey = useMemo(() => {
        // JSON.stringify is unreliable for Firestore QueryConstraint objects.
        // Use their string representation (and type if available) to build a stable key.
        return constraints.map(stableConstraintKey).join('|');
    }, [constraints]);

    // Use useMemo to ensure the constraints array reference remains stable 
    // as long as the stable key hasn't changed.
    const stableConstraints = useMemo(() => {
        return constraints;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [constraintsKey]);

    const { realtime, logError, enabled } = options;
    const isEnabled = enabled !== false;
    const shouldUseRealtime = realtime && !realtimeFailed;

    // React Query implementation for non-realtime
    // React Query implementation
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
            } catch (_err) {
                const errorObj = _err instanceof Error ? _err : new Error(String(_err));
                if (logError) ErrorLogger.error(errorObj, `useFirestoreCollection.fetchData.${collectionName}`);
                throw errorObj;
            }
        },
        enabled: isEnabled && !shouldUseRealtime && !demoMode,
        staleTime: 1000 * 60 * 5
    });

    // Mock Data Loading (Demo Mode)
    // Mock Data Loading (Demo Mode)
    useEffect(() => {
        if (demoMode && isEnabled) {
            setTimeout(() => {
                setRealtimeLoading(true);
                const mockData = MockDataService.getCollection(collectionName) as (T & { id: string })[];
                setRealtimeData(mockData);
                setRealtimeLoading(false);
            }, 0);
        }
    }, [demoMode, collectionName, isEnabled]);

    // Realtime implementation
    useEffect(() => {
        let isMounted = true;
        let timeoutId: number | null = null;

        if (!isEnabled || !shouldUseRealtime || demoMode) {
            return;
        }

        // Set loading state immediately (inside effect is safe)
        setRealtimeLoading(true);

        timeoutId = window.setTimeout(() => {
            if (isMounted) {
                setRealtimeFailed(true);
                setRealtimeLoading(false);
            }
        }, 5000); // 5s timeout

        let unsubscribe = () => { };

        try {
            const q = query(collection(db, collectionName), ...stableConstraints);
            unsubscribe = onSnapshot(q,
                (snapshot) => {
                    if (!isMounted) return;
                    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T & { id: string }));
                    setRealtimeData(docs);
                    setRealtimeLoading(false);
                    if (timeoutId !== null) window.clearTimeout(timeoutId);
                },
                (err: unknown) => {
                    if (!isMounted) return;
                    const errorObj = err instanceof Error ? err : new Error(String(err));
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
                        ErrorLogger.error(errorObj, `useFirestoreCollection.onSnapshot.${collectionName}`);
                    }
                    setRealtimeFailed(true);
                    setRealtimeLoading(false);
                    if (timeoutId !== null) window.clearTimeout(timeoutId);
                }
            );
        } catch (err) {
            if (logError) ErrorLogger.error(err, `useFirestoreCollection.setup.${collectionName}`);
            if (isMounted) {
                setRealtimeFailed(true);
                setRealtimeLoading(false);
            }
        }

        return () => {
            isMounted = false;
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            try {
                unsubscribe();
            } catch {
                ErrorLogger.warn('Firestore unsubscribe failed', 'useFirestoreCollection');
            }
        };
    }, [collectionName, constraintsKey, stableConstraints, shouldUseRealtime, isEnabled, logError, demoMode]);

    // Mutation implementation for Global Loading Feedback

    const addMutation = useMutation({
        mutationKey: ['firestore', 'add', collectionName],
        mutationFn: async (newData: WithFieldValue<DocumentData>) => {
            if (demoMode) return "mock-id-" + Date.now();
            try {
                const docRef = await addDoc(collection(db, collectionName), sanitizeData(newData));
                return docRef.id;
            } catch (_err) {
                const errorObj = _err instanceof Error ? _err : new Error(String(_err));
                if (logError) ErrorLogger.error(errorObj, `useFirestoreCollection.add.${collectionName}`);
                throw errorObj;
            }
        },
        onSuccess: async () => {
            if (!realtime) {
                await queryClient.invalidateQueries({ queryKey: ['firestore', collectionName] });
            }
        }
    });

    const updateMutation = useMutation({
        mutationKey: ['firestore', 'update', collectionName],
        mutationFn: async ({ id, data }: { id: string, data: UpdateData<DocumentData> }) => {
            if (demoMode) return;
            try {
                const docRef = doc(db, collectionName, id);
                await updateDoc(docRef, data);
            } catch (_err) {
                const errorObj = _err instanceof Error ? _err : new Error(String(_err));
                if (logError) ErrorLogger.error(errorObj, `useFirestoreCollection.update.${collectionName}`);
                throw errorObj;
            }
        },
        onSuccess: async () => {
            if (!realtime) {
                await queryClient.invalidateQueries({ queryKey: ['firestore', collectionName] });
            }
        }
    });

    const removeMutation = useMutation({
        mutationKey: ['firestore', 'remove', collectionName],
        mutationFn: async (id: string) => {
            if (demoMode) return;
            try {
                const docRef = doc(db, collectionName, id);
                await deleteDoc(docRef);
            } catch (_err) {
                const errorObj = _err instanceof Error ? _err : new Error(String(_err));
                if (logError) ErrorLogger.error(errorObj, `useFirestoreCollection.remove.${collectionName}`);
                throw errorObj;
            }
        },
        onSuccess: async () => {
            if (!realtime) {
                await queryClient.invalidateQueries({ queryKey: ['firestore', collectionName] });
            }
        }
    });

    // Wrapper functions to maintain API compatibility
    const add = useCallback(async (newData: WithFieldValue<DocumentData>) => {
        return await addMutation.mutateAsync(newData);
    }, [addMutation]);

    const update = useCallback(async (id: string, data: UpdateData<DocumentData>) => {
        await updateMutation.mutateAsync({ id, data });
    }, [updateMutation]);

    const remove = useCallback(async (id: string) => {
        await removeMutation.mutateAsync(id);
    }, [removeMutation]);

    // Stable refresh function
    const refresh = useCallback(async () => {
        if (demoMode) return;
        if (!realtime) await refetch();
    }, [realtime, refetch, demoMode]);

    // Return logic
    if (demoMode) {
        return {
            data: realtimeData,
            loading: realtimeLoading,
            error: null,
            refresh,
            add, update, remove
        };
    }

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
        error: (queryError as Error | null) || (realtimeFailed ? realtimeError : null),
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
    const { demoMode } = useStore();

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
            } catch (_err) {
                const errorObj = _err instanceof Error ? _err : new Error(String(_err));
                if (logError) {
                    ErrorLogger.error(errorObj, `useFirestoreDocument.fetchData.${collectionName}.${docId}`);
                }
                throw errorObj;
            }
        },
        enabled: !!docId && !realtime && !demoMode,
        staleTime: 1000 * 60 * 5 // 5 minutes default
    });

    // Mock Data Loading (Demo Mode)
    useEffect(() => {
        if (demoMode && docId) {
            setTimeout(() => {
                setRealtimeLoading(true);
                const mockDoc = MockDataService.getDocument(collectionName, docId) as T | null;
                setRealtimeData(mockDoc);
                setRealtimeLoading(false);
            }, 0);
        }
    }, [demoMode, collectionName, docId]);

    // Realtime implementation
    useEffect(() => {
        let isMounted = true;
        const timeouts: number[] = [];
        let unsubscribe = () => { };

        if (!docId) {
            // Delay setting null to avoid flicker if ID changes rapidly
            const tm = window.setTimeout(() => {
                if (isMounted) {
                    setRealtimeData(null);
                    setRealtimeLoading(false);
                }
            }, 0);
            timeouts.push(tm);
            return () => {
                isMounted = false;
                timeouts.forEach(window.clearTimeout);
            };
        }

        if (realtime && !demoMode) {
            // Set loading immediately. safe inside useEffect.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRealtimeLoading(true);

            try {
                const docRef = doc(db, collectionName, docId);
                unsubscribe = onSnapshot(docRef,
                    (snapshot) => {
                        if (!isMounted) return;
                        if (snapshot.exists()) {
                            setRealtimeData({ id: snapshot.id, ...snapshot.data() } as T);
                        } else {
                            setRealtimeData(null);
                        }
                        setRealtimeLoading(false);
                    },
                    (err: unknown) => {
                        if (!isMounted) return;
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
            } catch (err) {
                if (logError) ErrorLogger.error(err, `useFirestoreDocument.setup.${collectionName}.${docId}`);
                if (isMounted) setRealtimeLoading(false);
            }

            return () => {
                isMounted = false;
                timeouts.forEach(window.clearTimeout);
                try {
                    unsubscribe();
                } catch {
                    ErrorLogger.warn('Firestore unsubscribe failed', 'useFirestoreDocument');
                }
            };
        }
    }, [collectionName, docId, realtime, logError, demoMode]); // db and ErrorLogger are imports, no need in dep array

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
