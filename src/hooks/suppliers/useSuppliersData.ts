import { where, serverTimestamp } from 'firebase/firestore';
import { useCallback } from 'react';
import { useFirestoreCollection } from '../useFirestore';
import { Document, UserProfile, BusinessProcess, Asset, Risk, Project } from '../../types';
import { QuestionnaireTemplate, SupplierQuestionnaireResponse } from '../../types/business';

export const useSuppliersData = (organizationId?: string) => {
    // Queries
    const { data: usersRaw, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: documentsRaw, loading: loadingDocuments } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: processesRaw, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: assetsRaw, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: risksRaw, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: projectsRaw, loading: loadingProjects } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: templates, loading: loadingTemplates, add: addTemplateRaw, update: updateTemplateRaw, remove: removeTemplate } = useFirestoreCollection<QuestionnaireTemplate>(
        'questionnaire_templates',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: assessments, loading: loadingAssessments, add: addAssessmentRaw, update: updateAssessmentRaw, remove: removeAssessment } = useFirestoreCollection<SupplierQuestionnaireResponse>(
        'questionnaire_responses',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const loading = loadingUsers || loadingDocuments || loadingProcesses || loadingAssets || loadingRisks || loadingProjects || loadingTemplates || loadingAssessments;

    // Wrapper functions to inject serverTimestamp
    const addTemplate = useCallback(async (data: Partial<QuestionnaireTemplate>) => {
        return addTemplateRaw({
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }, [addTemplateRaw]);

    const updateTemplate = useCallback(async (id: string, data: Partial<QuestionnaireTemplate>) => {
        return updateTemplateRaw(id, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }, [updateTemplateRaw]);

    const addAssessment = useCallback(async (data: Partial<SupplierQuestionnaireResponse>) => {
        return addAssessmentRaw({
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }, [addAssessmentRaw]);

    const updateAssessment = useCallback(async (id: string, data: Partial<SupplierQuestionnaireResponse>) => {
        return updateAssessmentRaw(id, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }, [updateAssessmentRaw]);

    return {
        usersRaw,
        documentsRaw,
        processesRaw,
        assetsRaw,
        risksRaw,
        projectsRaw,
        templates,
        assessments,
        loading,
        addTemplate,
        updateTemplate,
        removeTemplate,
        addAssessment,
        updateAssessment,
        removeAssessment,
    };
};
