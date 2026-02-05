import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';

interface AuditLog {
 id: string;
 action: 'create' | 'update' | 'delete';
 entityType: string;
 entityId: string;
 userId: string;
 userName: string;
 timestamp: Date;
 before?: Record<string, unknown>;
 after?: Record<string, unknown>;
 changes?: string[];
}

export const useAuditLogs = (organizationId?: string) => {
 const [logs, setLogs] = useState<AuditLog[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!organizationId) {
 setLogs([]);
 setLoading(false);
 return;
 }

 const fetchLogs = async () => {
 setLoading(true);
 try {
 const logsRef = collection(db, 'system_logs');
 const q = query(
 logsRef,
 where('organizationId', '==', organizationId),
 orderBy('timestamp', 'desc'),
 limit(500)
 );
 
 const snapshot = await getDocs(q);
 const fetchedLogs: AuditLog[] = [];

 snapshot.forEach(doc => {
 const data = doc.data();
 fetchedLogs.push({
 id: doc.id,
 action: data.action,
 entityType: data.entityType,
 entityId: data.entityId,
 userId: data.userId,
 userName: data.userName || 'Utilisateur inconnu',
 timestamp: data.timestamp?.toDate() || new Date(),
 before: data.before,
 after: data.after,
 changes: data.changes
 });
 });

 setLogs(fetchedLogs);
 } catch (error) {
 ErrorLogger.error(error, 'useAuditLogs.fetchLogs');
 } finally {
 setLoading(false);
 }
 };

 fetchLogs();
 }, [organizationId]);

 return { logs, loading };
};

export type { AuditLog };
