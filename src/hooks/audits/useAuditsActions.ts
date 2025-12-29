import { useFirestoreCollection } from '../useFirestore';
import { where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { useCallback } from 'react';
import { Questionnaire, EvidenceRequest, UserProfile, Document, Audit, QuestionnaireResponse } from '../../types';

export const useAuditsActions = () => {
  const { user } = useAuth();

  const { data: audits, loading: loadingAudits, update: updateAudit, add: addAudit, remove: removeAudit } = useFirestoreCollection<Audit>(
    'audits',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: questionnaires, loading: loadingQuestionnaires, add: addQuestionnaireRaw, update: updateQuestionnaireRaw, remove: removeQuestionnaire } = useFirestoreCollection<Questionnaire>(
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

  const { data: documents, loading: loadingDocuments, add: addDocumentRaw } = useFirestoreCollection<Document>(
    'documents',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: responses, loading: loadingResponses, add: addResponseRaw, update: updateResponseRaw } = useFirestoreCollection<QuestionnaireResponse>(
    'questionnaire_responses',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const addResponse = useCallback(async (data: Partial<QuestionnaireResponse>) => {
    return addResponseRaw({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }, [addResponseRaw]);

  const updateResponse = useCallback(async (id: string, data: Partial<QuestionnaireResponse>) => {
    return updateResponseRaw(id, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }, [updateResponseRaw]);

  const addDocument = useCallback(async (data: Partial<Document>) => {
    return addDocumentRaw({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }, [addDocumentRaw]);

  const addQuestionnaire = useCallback(async (data: Partial<Questionnaire>) => {
    return addQuestionnaireRaw({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }, [addQuestionnaireRaw]);

  const updateQuestionnaire = useCallback(async (id: string, data: Partial<Questionnaire>) => {
    return updateQuestionnaireRaw(id, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }, [updateQuestionnaireRaw]);

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
