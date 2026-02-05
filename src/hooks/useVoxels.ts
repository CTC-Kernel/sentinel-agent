
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Asset, Risk, Project, Audit, Incident, Supplier, Control } from '../types';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';

// Optimized Helper to convert Firestore Timestamps to ISO strings
const convertTimestamps = (obj: unknown): unknown => {
 if (!obj || typeof obj !== 'object') return obj;

 // Handle Firestore Timestamp
 const timestampObj = obj as { seconds?: number; nanoseconds?: number };
 if (typeof timestampObj.seconds === 'number') {
 return new Date(timestampObj.seconds * 1000).toISOString();
 }

 // Handle arrays
 if (Array.isArray(obj)) {
 return obj.map(item => convertTimestamps(item));
 }

 // Handle objects recursively
 if (obj.constructor === Object) {
 const converted: Record<string, unknown> = {};
 for (const key in obj) {
 if (Object.prototype.hasOwnProperty.call(obj, key)) {
 converted[key] = convertTimestamps((obj as Record<string, unknown>)[key]);
 }
 }
 return converted;
 }

 return obj;
};

export const useVoxels = () => {
 const { user } = useStore();
 // Initialize loading based on whether we have organizationId
 const [loading, setLoading] = useState(() => Boolean(user?.organizationId));
 const [data, setData] = useState<{
 assets: Asset[];
 risks: Risk[];
 projects: Project[];
 audits: Audit[];
 incidents: Incident[];
 suppliers: Supplier[];
 controls: Control[];
 }>({
 assets: [],
 risks: [],
 projects: [],
 audits: [],
 incidents: [],
 suppliers: [],
 controls: []
 });

 useEffect(() => {
 if (!user?.organizationId) return;

 const orgId = user.organizationId;
 const collections = ['assets', 'risks', 'projects', 'audits', 'incidents', 'suppliers', 'controls'];
 const unsubscribes: (() => void)[] = [];
 const loadedStatus: Record<string, boolean> = {};

 collections.forEach(colName => {
 const q = query(collection(db, colName), where('organizationId', '==', orgId));
 const unsub = onSnapshot(q, (snap) => {
 const colData = snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() })) as (Asset | Risk | Project | Audit | Incident | Supplier | Control)[];
 setData(prev => ({ ...prev, [colName]: colData }));

 loadedStatus[colName] = true;
 if (Object.keys(loadedStatus).length === collections.length) {
  setLoading(false);
 }
 }, (err) => {
 ErrorLogger.error(err, `useVoxels.listener.${colName}`);
 loadedStatus[colName] = true; // Still mark as loaded to unblock loading state
 if (Object.keys(loadedStatus).length === collections.length) setLoading(false);
 });
 unsubscribes.push(unsub);
 });

 return () => unsubscribes.forEach(unsub => unsub());
 }, [user?.organizationId]);

 return {
 loading,
 ...data,
 refresh: () => { } // No-op for compatibility
 };
};
