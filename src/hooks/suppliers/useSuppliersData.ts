import { where, serverTimestamp } from 'firebase/firestore';
import { useCallback, useState, useEffect, useMemo } from 'react';
import { useFirestoreCollection } from '../useFirestore';
import { Document, UserProfile, BusinessProcess, Asset, Risk, Project } from '../../types';
import { QuestionnaireTemplate, SupplierQuestionnaireResponse } from '../../types/business';
import { useStore } from '../../store';

export const useSuppliersData = (organizationId?: string) => {
    const { demoMode } = useStore();

    // Mock Data State
    const [mockData, setMockData] = useState<{
        users: UserProfile[];
        documents: Document[];
        processes: BusinessProcess[];
        assets: Asset[];
        risks: Risk[];
        projects: Project[];
        templates: QuestionnaireTemplate[];
        responses: SupplierQuestionnaireResponse[];
    } | null>(null);

    // Queries
    const { data: usersRaw, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: documentsRaw, loading: loadingDocuments } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: processesRaw, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: assetsRaw, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: risksRaw, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: projectsRaw, loading: loadingProjects } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: templatesRaw, loading: loadingTemplates, add: addTemplateRaw, update: updateTemplateRaw, remove: removeTemplate } = useFirestoreCollection<QuestionnaireTemplate>(
        'questionnaire_templates',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: assessmentsRaw, loading: loadingAssessments, add: addAssessmentRaw, update: updateAssessmentRaw, remove: removeAssessment } = useFirestoreCollection<SupplierQuestionnaireResponse>(
        'questionnaire_responses',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    // Load Mock Data Effect
    useEffect(() => {
        if (demoMode && !mockData) {
            import('../../services/mockDataService').then(({ MockDataService }) => {
                setMockData({
                    users: MockDataService.getCollection('users') as unknown as UserProfile[],
                    documents: MockDataService.getCollection('documents') as Document[],
                    processes: MockDataService.getCollection('business_processes') as unknown as BusinessProcess[],
                    assets: MockDataService.getCollection('assets') as Asset[],
                    risks: MockDataService.getCollection('risks') as Risk[],
                    projects: MockDataService.getCollection('projects') as Project[],
                    templates: [], // Mock templates if needed, for now empty or todo
                    responses: []  // Mock responses if needed
                });
            });
        }
    }, [demoMode, mockData]);

    const users = useMemo(() => demoMode && mockData ? mockData.users : usersRaw, [usersRaw, mockData, demoMode]);
    const documents = useMemo(() => demoMode && mockData ? mockData.documents : documentsRaw, [documentsRaw, mockData, demoMode]);
    const processes = useMemo(() => demoMode && mockData ? mockData.processes : processesRaw, [processesRaw, mockData, demoMode]);
    const assets = useMemo(() => demoMode && mockData ? mockData.assets : assetsRaw, [assetsRaw, mockData, demoMode]);
    const risks = useMemo(() => demoMode && mockData ? mockData.risks : risksRaw, [risksRaw, mockData, demoMode]);
    const projects = useMemo(() => demoMode && mockData ? mockData.projects : projectsRaw, [projectsRaw, mockData, demoMode]);
    const templates = useMemo(() => demoMode && mockData ? mockData.templates : templatesRaw, [templatesRaw, mockData, demoMode]);
    const assessments = useMemo(() => demoMode && mockData ? mockData.responses : assessmentsRaw, [assessmentsRaw, mockData, demoMode]);

    const loading = demoMode ? !mockData : (loadingUsers || loadingDocuments || loadingProcesses || loadingAssets || loadingRisks || loadingProjects || loadingTemplates || loadingAssessments);

    // Wrapper functions to inject serverTimestamp
    const addTemplate = useCallback(async (data: Partial<QuestionnaireTemplate>) => {
        if (demoMode) return;
        return addTemplateRaw({
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }, [addTemplateRaw, demoMode]);

    const updateTemplate = useCallback(async (id: string, data: Partial<QuestionnaireTemplate>) => {
        if (demoMode) return;
        return updateTemplateRaw(id, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }, [updateTemplateRaw, demoMode]);

    const addAssessment = useCallback(async (data: Partial<SupplierQuestionnaireResponse>) => {
        if (demoMode) return;
        return addAssessmentRaw({
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }, [addAssessmentRaw, demoMode]);

    const updateAssessment = useCallback(async (id: string, data: Partial<SupplierQuestionnaireResponse>) => {
        if (demoMode) return;
        return updateAssessmentRaw(id, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }, [updateAssessmentRaw, demoMode]);

    return {
        usersRaw: users,
        documentsRaw: documents,
        processesRaw: processes,
        assetsRaw: assets,
        risksRaw: risks,
        projectsRaw: projects,
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
