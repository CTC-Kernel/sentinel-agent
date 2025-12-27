import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Questionnaire, EvidenceRequest, UserProfile, Document } from '../../types';

export const useAuditsActions = () => {
  const { user } = useAuth();

  const { data: questionnaires, loading: loadingQuestionnaires } = useFirestoreCollection<Questionnaire>(
    'questionnaires',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: evidences, loading: loadingEvidences } = useFirestoreCollection<EvidenceRequest>(
    'evidence_requests',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: users, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
    'users',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: documents, loading: loadingDocuments } = useFirestoreCollection<Document>(
    'documents',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  return {
    questionnaires: questionnaires || [],
    evidences: evidences || [],
    users: users || [],
    documents: documents || [],
    loading: loadingQuestionnaires || loadingEvidences || loadingUsers || loadingDocuments,
  };
};
