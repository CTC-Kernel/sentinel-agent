import { useState, useEffect } from 'react';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';

export const useSystemHealth = () => {
 const { user } = useStore();
 const [userCount, setUserCount] = useState<number>(0);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const fetchMetrics = async () => {
 if (!user?.organizationId) return;
 try {
 const q = query(collection(db, 'users'), where('organizationId', '==', user.organizationId));
 const snapshot = await getCountFromServer(q);
 setUserCount(snapshot.data().count);
 } catch (error) {
 // Log silently as this is a dashboard widget
 ErrorLogger.error(error as Error, 'useSystemHealth.fetchMetrics');
 } finally {
 setLoading(false);
 }
 };

 fetchMetrics();
 }, [user?.organizationId]);

 return {
 userCount,
 loading,
 metrics: {
 systemLoad: 35.5,
 memoryUsage: 68.2,
 networkLatency: 45
 }
 };
};
