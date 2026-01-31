import { useFirestoreCollection } from '../useFirestore';
import { where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { useCallback } from 'react';
import { Questionnaire, EvidenceRequest, UserProfile, Document, Audit, QuestionnaireResponse } from '../../types';
import { hasPermission } from '../../utils/permissions';
import { AuditLogService } from '../../services/auditLogService';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from '@/lib/toast';
import { useStore } from '../../store';

export const useAuditsActions = () => {
  const { t } = useStore();
  const { user } = useAuth();

  const { data: audits, loading: loadingAudits, update: updateAuditRaw, add: addAuditRaw, remove: removeAuditRaw } = useFirestoreCollection<Audit>(
    'audits',
    [where('organizationId', '==', user?.organizationId || '')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: questionnaires, loading: loadingQuestionnaires, add: addQuestionnaireRaw, update: updateQuestionnaireRaw, remove: removeQuestionnaireRaw } = useFirestoreCollection<Questionnaire>(
    'questionnaires',
    [where('organizationId', '==', user?.organizationId || '')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: evidences, loading: loadingEvidences } = useFirestoreCollection<EvidenceRequest>(
    'evidence_requests',
    [where('organizationId', '==', user?.organizationId || '')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: users, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
    'users',
    [where('organizationId', '==', user?.organizationId || '')],
    { enabled: !!user?.organizationId }
  );

  const { data: documents, loading: loadingDocuments, add: addDocumentRaw } = useFirestoreCollection<Document>(
    'documents',
    [where('organizationId', '==', user?.organizationId || '')],
    { enabled: !!user?.organizationId }
  );

  const { data: responses, loading: loadingResponses, add: addResponseRaw, update: updateResponseRaw } = useFirestoreCollection<QuestionnaireResponse>(
    'questionnaire_responses',
    [where('organizationId', '==', user?.organizationId || '')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  /* Wrapper with RBAC & Audit for Audits */
  const addAudit = useCallback(async (data: Partial<Audit>) => {
    if (!user?.organizationId) return null;
    if (!hasPermission(user, 'Audit', 'create')) {
      toast.error(t('audits.notAuthorizedCreate') || "Non autorisé à créer un audit");
      return null;
    }

    try {
      const id = await addAuditRaw(data);
      await AuditLogService.logCreate(
        user.organizationId,
        { id: user.uid, name: user.displayName || '', email: user.email || '' },
        'audit',
        id,
        data as Record<string, unknown>,
        `Audit créé: ${data.name}`
      );
      toast.success(t('audits.created') || "Audit créé avec succès");
      return id;
    } catch (error) {
      ErrorLogger.error(error as Error, 'useAuditsActions.addAudit');
      toast.error(t('errors.creationFailed') || "Erreur lors de la création");
      return null;
    }
  }, [addAuditRaw, user, t]);

  const updateAudit = useCallback(async (id: string, data: Partial<Audit>) => {
    if (!user?.organizationId) return;
    if (!hasPermission(user, 'Audit', 'update')) {
      toast.error(t('audits.notAuthorizedUpdate') || "Non autorisé à modifier cet audit");
      return;
    }

    try {
      await updateAuditRaw(id, data);
      await AuditLogService.logUpdate(
        user.organizationId,
        { id: user.uid, name: user.displayName || '', email: user.email || '' },
        'audit',
        id,
        {}, // Old data placeholder
        data as Record<string, unknown>,
        data.name || 'Audit'
      );
      toast.success(t('audits.updated') || "Audit mis à jour");
    } catch (error) {
      ErrorLogger.error(error as Error, 'useAuditsActions.updateAudit');
      toast.error(t('errors.updateFailed') || "Erreur lors de la mise à jour");
    }
  }, [updateAuditRaw, user, t]);

  const removeAudit = useCallback(async (id: string) => {
    if (!user?.organizationId) return;
    if (!hasPermission(user, 'Audit', 'delete')) {
      toast.error(t('audits.notAuthorizedDelete') || "Non autorisé à supprimer cet audit");
      return;
    }

    try {
      await removeAuditRaw(id);
      await AuditLogService.log({
        organizationId: user.organizationId,
        userId: user.uid,
        userName: user.displayName || '',
        userEmail: user.email || '',
        action: 'delete',
        entityType: 'audit',
        entityId: id,
        details: "Suppression d'audit"
      });
      toast.success(t('audits.deleted') || "Audit supprimé");
    } catch (error) {
      ErrorLogger.error(error as Error, 'useAuditsActions.removeAudit');
      toast.error(t('errors.deletionFailed') || "Erreur lors de la suppression");
    }
  }, [removeAuditRaw, user, t]);

  /* Wrapper for Questionnaires */
  const addQuestionnaire = useCallback(async (data: Partial<Questionnaire>) => {
    if (!user?.organizationId) return null;
    if (!hasPermission(user, 'Audit', 'create')) { // Reuse Audit permission
      toast.error(t('errors.notAuthorized') || "Non autorisé");
      return null;
    }

    try {
      const id = await addQuestionnaireRaw({
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await AuditLogService.logCreate(
        user.organizationId,
        { id: user.uid, name: user.displayName || '', email: user.email || '' },
        'questionnaire', // Now valid
        id,
        data as Record<string, unknown>,
        `Questionnaire créé`
      );
      return id;
    } catch (error) {
      ErrorLogger.error(error as Error, 'useAuditsActions.addQuestionnaire');
      return null;
    }
  }, [addQuestionnaireRaw, user, t]);

  const updateQuestionnaire = useCallback(async (id: string, data: Partial<Questionnaire>) => {
    if (!user?.organizationId) return;
    if (!hasPermission(user, 'Audit', 'update')) return;

    try {
      await updateQuestionnaireRaw(id, {
        ...data,
        updatedAt: serverTimestamp()
      });
      // Optional: minimal logging to avoid spam
    } catch (error) {
      ErrorLogger.error(error as Error, 'useAuditsActions.updateQuestionnaire');
    }
  }, [updateQuestionnaireRaw, user]);

  const removeQuestionnaire = useCallback(async (id: string) => {
    if (!user?.organizationId) return;
    if (!hasPermission(user, 'Audit', 'delete')) return;

    try {
      await removeQuestionnaireRaw(id);
      await AuditLogService.log({
        organizationId: user.organizationId,
        userId: user.uid,
        userName: user.displayName || '',
        userEmail: user.email || '',
        action: 'delete',
        entityType: 'questionnaire',
        entityId: id,
        details: "Suppression questionnaire"
      });
    } catch (error) {
      ErrorLogger.error(error as Error, 'useAuditsActions.removeQuestionnaire');
    }
  }, [removeQuestionnaireRaw, user]);

  const addResponse = useCallback(async (data: Partial<QuestionnaireResponse>) => {
    // Responses created by users/auditees
    // Usually if they have access to the audit, they can respond
    if (!user?.organizationId) return null;

    try {
      const id = await addResponseRaw({
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await AuditLogService.logCreate(
        user.organizationId,
        { id: user.uid, name: user.displayName || '', email: user.email || '' },
        'questionnaire_response',
        id,
        data as Record<string, unknown>,
        'Réponse questionnaire'
      );
      return id;
    } catch (err) {
      ErrorLogger.error(err as Error, 'useAuditsActions.addResponse');
      return null;
    }
  }, [addResponseRaw, user]);

  const updateResponse = useCallback(async (id: string, data: Partial<QuestionnaireResponse>) => {
    if (!user?.organizationId) return;
    try {
      await updateResponseRaw(id, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      ErrorLogger.error(err as Error, 'useAuditsActions.updateResponse');
    }
  }, [updateResponseRaw, user]);

  const addDocument = useCallback(async (data: Partial<Document>) => {
    if (!user?.organizationId) return null;
    // Document creation usually managed by useDocumentActions but here it might be inline
    try {
      const id = await addDocumentRaw({
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await AuditLogService.logCreate(
        user.organizationId,
        { id: user.uid, name: user.displayName || '', email: user.email || '' },
        'document',
        id,
        data as Record<string, unknown>,
        data.title || 'Document'
      );
      return id;
    } catch (err) {
      ErrorLogger.error(err as Error, 'useAuditsActions.addDocument');
      return null;
    }
  }, [addDocumentRaw, user]);

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
