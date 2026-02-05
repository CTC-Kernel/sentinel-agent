import { useState, useCallback } from 'react';
import { collection, addDoc, deleteDoc, doc, getDoc, getDocs, query, where, limit, QueryDocumentSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useStore } from '../store';
import { ErrorLogger } from '../services/errorLogger';
import { logAction } from '../services/logger';
import { Incident, Document } from '../types';
import { sanitizeData } from '../utils/dataSanitizer';

export const useReports = () => {
 const { user, addToast, t } = useStore();
 const [loading, setLoading] = useState(false);

 const saveReport = useCallback(async (blob: Blob, filename: string, title: string) => {
 if (!user?.organizationId) return;
 setLoading(true);

 try {
 // 1. Upload to Storage
 const storagePath = `documents/${user.organizationId}/${Date.now()}_${filename}`;
 const storageRef = ref(storage, storagePath);
 const snapshot = await uploadBytes(storageRef, blob);
 const url = await getDownloadURL(snapshot.ref);

 // 2. Create Document Record
 const docData = {
 title: title,
 type: 'Rapport',
 url: url,
 hash: '', // Optional: could compute SHA-256
 ownerId: user.uid,
 owner: user.displayName || user.email || 'Système',
 organizationId: user.organizationId,
 createdAt: serverTimestamp(),
 updatedAt: serverTimestamp(),
 version: '1.0',
 size: blob.size,
 status: 'Validé',
 description: `Rapport généré automatiquement : ${title}`,
 isSecure: false,
 watermarkEnabled: false
 };

 const docRef = await addDoc(collection(db, 'documents'), sanitizeData(docData));

 await logAction(user, 'CREATE', 'Document', `Generated Report: ${title}`);
 addToast(t('reports.successSaved'), "success");
 return { id: docRef.id, ...docData };

 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useReports.saveReport', 'CREATE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const deleteReport = useCallback(async (id: string) => {
 if (!user?.organizationId) return;
 setLoading(true);
 try {
 // SECURITY: Verify report belongs to user's organization before deleting
 const reportDoc = await getDoc(doc(db, 'documents', id));
 if (!reportDoc.exists() || reportDoc.data()?.organizationId !== user.organizationId) {
 throw new Error('Access denied');
 }
 await deleteDoc(doc(db, 'documents', id));
 await logAction(user, 'DELETE', 'Document', `Deleted Report: ${id}`);
 addToast(t('reports.deleteSuccess'), "success");
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useReports.deleteReport', 'DELETE_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user, addToast, t]);

 const fetchCompliancePackData = useCallback(async () => {
 if (!user?.organizationId) return null;
 setLoading(true);
 try {
 const [incidentsSnap, allDocsSnap] = await Promise.all([
 getDocs(query(collection(db, 'incidents'), where('organizationId', '==', user.organizationId), limit(500))),
 getDocs(query(collection(db, 'documents'), where('organizationId', '==', user.organizationId), limit(1000)))
 ]);

 const mapDoc = <T>(d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as T);

 return {
 incidents: incidentsSnap.docs.map(d => mapDoc<Incident>(d)),
 documents: allDocsSnap.docs.map(d => mapDoc<Document>(d))
 };
 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'useReports.fetchCompliancePackData', 'FETCH_FAILED');
 throw error;
 } finally {
 setLoading(false);
 }
 }, [user]);

 return {
 saveReport,
 deleteReport,
 fetchCompliancePackData,
 loading
 };
};
