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


    const [filter, setFilter] = useState({ search: '', action: '', resource: '' });

    const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);

    useEffect(() => {
        let result = logs;

        if (filter.search) {
            const needle = filter.search.toLowerCase();
            result = result.filter(l =>
                (l.details || '').toLowerCase().includes(needle) ||
                (l.userEmail || '').toLowerCase().includes(needle) ||
                (l.action || '').toLowerCase().includes(needle)
            );
        }

        if (filter.action) {
            result = result.filter(l => l.action === filter.action);
        }

        if (filter.resource) {
            result = result.filter(l => l.resource === filter.resource);
        }

        setFilteredLogs(result);
    }, [logs, filter]);

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
        logs: filteredLogs,
        loading,
        hasMore,
        refresh,
        loadMore,
        filter,
        setFilter
    };
};
