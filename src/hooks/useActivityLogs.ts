import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemLog } from '../types';
import { useStore } from '../store';
import { toast } from '@/lib/toast';

export const useActivityLogs = (limitCount: number = 50) => {
    const { user, t } = useStore();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const [filter, setFilter] = useState({
        search: '',
        action: '',
        resource: '',
        severity: 'all', // 'all', 'info', 'warning', 'critical', 'success'
        dateRange: 'all' // 'all', 'today', 'week', 'month'
    });

    const [stats, setStats] = useState({
        scansToday: 0,
        criticalAlerts: 0,
        activeAdmins: 0
    });

    const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);

    useEffect(() => {
        let result = logs;

        // Search
        if (filter.search) {
            const needle = filter.search.toLowerCase();
            result = result.filter(l =>
                (l.details || '').toLowerCase().includes(needle) ||
                (l.userEmail || '').toLowerCase().includes(needle) ||
                (l.action || '').toLowerCase().includes(needle)
            );
        }

        // Action
        if (filter.action) {
            result = result.filter(l => l.action === filter.action);
        }

        // Resource
        if (filter.resource) {
            result = result.filter(l => l.resource === filter.resource);
        }

        // Severity
        if (filter.severity && filter.severity !== 'all') {
            // Mapping: 'critical' might be mapped from 'danger' in UI or just 'critical' in DB
            result = result.filter(l => (l.severity || 'info') === filter.severity);
        }

        // Date Range
        if (filter.dateRange && filter.dateRange !== 'all') {
            const now = new Date();
            const logDate = (timestamp: unknown): Date => {
                if (!timestamp) return new Date();
                if (typeof timestamp === 'string') return new Date(timestamp);
                if (timestamp instanceof Date) return timestamp;
                if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof (timestamp as { toDate: () => Date }).toDate === 'function') {
                    return (timestamp as { toDate: () => Date }).toDate();
                }
                if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
                    return new Date((timestamp as { seconds: number }).seconds * 1000);
                }
                return new Date();
            };

            if (filter.dateRange === 'today') {
                const startOfToday = new Date(now.setHours(0, 0, 0, 0));
                result = result.filter(l => logDate(l.timestamp) >= startOfToday);
            } else if (filter.dateRange === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                result = result.filter(l => logDate(l.timestamp) >= weekAgo);
            } else if (filter.dateRange === 'month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                result = result.filter(l => logDate(l.timestamp) >= monthAgo);
            }
        }

        setFilteredLogs(result);
    }, [logs, filter]);

    const fetchLogs = useCallback(async (isLoadMore = false) => {
        if (!user?.organizationId) return;

        try {
            setLoading(true);

            // Base query
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

            // Fetch Stats (Mocked or simple queries for now to save reads, or real if critical)
            // For Masterpiece, let's calculate from the fetched logs + active admins count
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

            // Calculate stats from the initial batch (and potentially accumulated logs if managed differently)
            if (!isLoadMore) {
                const recentLogs = newLogs;
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const logsToday = recentLogs.filter(l => {
                    const ts = l.timestamp as { seconds: number } | string | Date;
                    let date: Date;
                    if (ts && typeof ts === 'object' && 'seconds' in ts) {
                        date = new Date(ts.seconds * 1000);
                    } else if (typeof ts === 'string') {
                        date = new Date(ts);
                    } else {
                        date = new Date(); // Fallback
                    }
                    return date >= today;
                });

                const uniqueUsers = new Set(recentLogs.map(l => l.userEmail)).size;
                const criticals = recentLogs.filter(l => l.severity === 'danger' || l.severity === 'critical' as string).length;

                setStats({
                    scansToday: logsToday.length,
                    criticalAlerts: criticals,
                    activeAdmins: uniqueUsers
                });
            }

            lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
            setLogs(prev => isLoadMore ? [...prev, ...newLogs] : newLogs);
            setHasMore(snapshot.docs.length === limitCount);

        } catch {
            toast.error(t('activityLogs.toast.loadError', { defaultValue: 'Impossible de charger le journal d\'activité' }));
        } finally {
            setLoading(false);
        }
    }, [user?.organizationId, limitCount, t]);

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

    const exportLogs = () => {
        if (!filteredLogs.length) return;

        const headers = ['Date', 'Utilisateur', 'Action', 'Ressource', 'Détails', 'IP', 'Sévérité'];
        const csvContent = [
            headers.join(','),
            ...filteredLogs.map(log => {
                const ts = log.timestamp as unknown;
                const safeTimestamp = (t: unknown): string => {
                    if (!t) return new Date().toISOString();
                    if (typeof t === 'string') return t;
                    if (t instanceof Date) return t.toISOString();
                    if (t && typeof t === 'object' && 'toDate' in t && typeof (t as { toDate: () => Date }).toDate === 'function') {
                        return (t as { toDate: () => Date }).toDate().toISOString();
                    }
                    if (t && typeof t === 'object' && 'seconds' in t) {
                        return new Date((t as { seconds: number }).seconds * 1000).toISOString();
                    }
                    return new Date().toISOString();
                };
                const date = new Date(safeTimestamp(ts)).toLocaleString();
                return [
                    `"${date}"`,
                    `"${log.userEmail}"`,
                    `"${log.action}"`,
                    `"${log.resource}"`,
                    `"${(log.details || '').replace(/"/g, '""')}"`, // Escape quotes
                    `"${log.ip || ''}"`,
                    `"${log.severity || 'info'}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return {
        logs: filteredLogs,
        loading,
        hasMore,
        refresh,
        loadMore,
        filter,
        setFilter,
        stats,
        exportLogs
    };
};
