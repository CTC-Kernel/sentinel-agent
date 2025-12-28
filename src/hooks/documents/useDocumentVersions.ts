import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { DocumentVersion } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';

export const useDocumentVersions = (documentId: string | null, enabled: boolean = true) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !documentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVersions(prev => prev.length > 0 ? [] : prev);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(prev => prev ? false : prev);
      return;
    }

    setLoading(true);
    const qVersions = query(
      collection(db, 'document_versions'),
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
  }, [documentId, enabled]);

  return { versions, loading };
};
