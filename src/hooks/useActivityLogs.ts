import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemLog } from '../types';
import { useStore } from '../store';
import { toast } from 'sonner';

export const useActivityLogs = (limitCount: number = 50) => {
    const { user } = useStore();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);


    const fetchLogs = useCallback(async (isLoadMore = false) => {
        if (!user?.organizationId) return;

        try {
            setLoading(true);
            let q = query(
                collection(db, 'system_logs'),
                where('organizationId', '==', user.organizationId),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );

            // Filters application (client-side filtering mostly or simple compounding)
            // Note: Complex filtering on firestore requires composite indexes.
            // For now, we stick to basic org + sort.

            // If filtering by specific fields is needed, we would add 'where' clauses here
            // but we must be careful about index requirements.

            if (isLoadMore && lastDocRef.current) {
                q = query(q, startAfter(lastDocRef.current));
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setHasMore(false);
                if (!isLoadMore) setLogs([]);
                setLoading(false);
                return;
            }

            const newLogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SystemLog));

            lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
            setLogs(prev => isLoadMore ? [...prev, ...newLogs] : newLogs);
            setHasMore(snapshot.docs.length === limitCount);

        } catch (error) {
            console.error('Error fetching activity logs:', error);
            toast.error('Impossible de charger le journal d\'activité');
        } finally {
            setLoading(false);
        }
    }, [user?.organizationId, limitCount]);

    useEffect(() => {
        // Initial fetch
        fetchLogs(false);
    }, [fetchLogs]);

    const refresh = () => {
        lastDocRef.current = null;
        fetchLogs(false);
    };

    const loadMore = () => {
        if (!loading && hasMore) {
            fetchLogs(true);
        }
    };

    return {
        logs,
        loading,
        hasMore,
        refresh,
        loadMore
    };
};
