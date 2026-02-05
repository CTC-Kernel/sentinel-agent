import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { DocumentVersion } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import { useStore } from '../../store';

export const useDocumentVersions = (documentId: string | null, enabled: boolean = true) => {
 const { user } = useStore();
 const [versions, setVersions] = useState<DocumentVersion[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!enabled || !documentId || !user?.organizationId) {
 setTimeout(() => {
 setVersions(prev => prev.length > 0 ? [] : prev);
 setLoading(prev => prev ? false : prev);
 }, 0);
 return;
 }

 setTimeout(() => setLoading(true), 0);
 const qVersions = query(
 collection(db, 'document_versions'),
 where('organizationId', '==', user.organizationId),
 where('documentId', '==', documentId),
 orderBy('uploadedAt', 'desc')
 );

 const unsubscribe = onSnapshot(
 qVersions,
 (snapshot) => {
 setVersions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DocumentVersion)));
 setLoading(false);
 },
 (err) => {
 ErrorLogger.error(err, 'useDocumentVersions');
 setLoading(false);
 }
 );

 return () => unsubscribe();
 }, [documentId, enabled, user?.organizationId]);

 return { versions, loading };
};
