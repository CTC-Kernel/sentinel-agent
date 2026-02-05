import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { SystemLog } from '../types';
import { useStore } from '../store';
import { toast } from '@/lib/toast';
import { ErrorLogger } from '../services/errorLogger';

export const useResourceLogs = (_resourceType: string, resourceId?: string, limitCount: number = 20) => {
 const { user, t } = useStore();
 const [logs, setLogs] = useState<SystemLog[]>([]);
 const [loading, setLoading] = useState(true);
 const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
 const [hasMore, setHasMore] = useState(true);

 const fetchLogs = useCallback(async (isLoadMore = false) => {
 if (!user?.organizationId || !resourceId) return;

 try {
 setLoading(true);

 // Base query for specific resource
 // We search for logs where resourceId matches OR (resource matches AND details contains name/ID if needed, but resourceId is safer)
 // Ideally system_logs should have resourceId indexed.
 let q = query(
 collection(db, 'system_logs'),
 where('organizationId', '==', user.organizationId),
 where('resourceId', '==', resourceId),
 orderBy('timestamp', 'desc'),
 limit(limitCount)
 );

 // Fallback: If resourceId wasn't logged in older logs, we might miss them. 
 // For Masterpiece "Time Machine", we assume forward compatibility with new logs having resourceId.

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
 // Silent error or specific handling? 
 // For a history tab, we might want to show empty state rather than error toast if it's just index missing
 if ((error as { code?: string })?.code === 'failed-precondition') {
 ErrorLogger.info(`Missing Firestore index for resource logs query. Resource: ${resourceId}`, 'useResourceLogs');
 setLogs([]);
 } else {
 toast.error(t('resourceLogs.toast.loadError', { defaultValue: 'Failed to load history' }));
 }
 } finally {
 setLoading(false);
 }
 }, [user?.organizationId, resourceId, limitCount, t]);

 useEffect(() => {
 if (resourceId) {
 lastDocRef.current = null;
 fetchLogs(false);
 } else {
 setLogs([]);
 setLoading(false);
 }
 }, [fetchLogs, resourceId]);

 const loadMore = () => {
 if (!loading && hasMore) {
 fetchLogs(true);
 }
 };

 return {
 logs,
 loading,
 hasMore,
 loadMore,
 refresh: () => {
 lastDocRef.current = null;
 fetchLogs(false);
 }
 };
};
