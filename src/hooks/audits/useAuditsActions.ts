import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Questionnaire, EvidenceRequest, UserProfile, Document, Audit, QuestionnaireResponse } from '../../types';

export const useAuditsActions = () => {
  const { user } = useAuth();

  const { data: audits, loading: loadingAudits, update: updateAudit, add: addAudit, remove: removeAudit } = useFirestoreCollection<Audit>(
    'audits',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: questionnaires, loading: loadingQuestionnaires, add: addQuestionnaire, update: updateQuestionnaire, remove: removeQuestionnaire } = useFirestoreCollection<Questionnaire>(
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

  const { data: documents, loading: loadingDocuments, add: addDocument } = useFirestoreCollection<Document>(
    'documents',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: responses, loading: loadingResponses, add: addResponse, update: updateResponse } = useFirestoreCollection<QuestionnaireResponse>(
    'questionnaire_responses',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  return {
    audits: audits || [],
    questionnaires: questionnaires || [],
    evidences: evidences || [],
    users: users || [],
    documents: documents || [],
    responses: responses || [],
    loading: loadingAudits || loadingQuestionnaires || loadingEvidences || loadingUsers || loadingDocuments || loadingResponses,
    updateAudit,
    addAudit,
    removeAudit,
    addQuestionnaire,
    updateQuestionnaire,
    removeQuestionnaire,
    addResponse,
    updateResponse,
    addDocument,
  };
};
