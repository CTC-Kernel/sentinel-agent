import { useMemo, useState, useEffect } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { Document, UserProfile, Control, Asset, Audit, DocumentFolder, Risk } from '../../types';
import { EncryptionService } from '../../services/encryptionService';
import { useStore } from '../../store';
import { MockDataService } from '../../services/mockDataService';

export const useDocumentsData = (organizationId?: string) => {
    const { demoMode } = useStore();

    // Mock Data State
    const [mockData, setMockData] = useState<{
        documents: Document[];
        users: UserProfile[];
        controls: Control[];
        assets: Asset[];
        audits: Audit[];
        risks: Risk[];
        folders: DocumentFolder[];
    } | null>(null);

    // Queries (Disabled in Demo Mode)
    const { data: rawDocuments, loading: loadingDocuments } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    const { data: rawFolders, loading: loadingFolders } = useFirestoreCollection<DocumentFolder>(
        'document_folders',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode }
    );

    // Load Mock Data Effect
    useEffect(() => {
        if (demoMode && !mockData) {
            setMockData({
                documents: MockDataService.getCollection('documents') as Document[],
                users: MockDataService.getCollection('users') as unknown as UserProfile[],
                controls: MockDataService.getCollection('controls') as Control[],
                assets: MockDataService.getCollection('assets') as Asset[],
                audits: MockDataService.getCollection('audits') as Audit[],
                risks: MockDataService.getCollection('risks') as Risk[],
                folders: [] // No mock folders yet
            });
        }
    }, [demoMode, mockData]);

    const effectiveDocuments = useMemo(() => {
        const source = demoMode && mockData ? mockData.documents : rawDocuments;
        return [...source]
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(doc => ({
                ...doc,
                description: EncryptionService.decrypt(doc.description || '')
            }));
    }, [rawDocuments, mockData, demoMode]);

    const effectiveControls = useMemo(() => {
        const source = demoMode && mockData ? mockData.controls : rawControls;
        return [...source].sort((a, b) => a.code.localeCompare(b.code));
    }, [rawControls, mockData, demoMode]);

    const effectiveFolders = useMemo(() => {
        const source = demoMode && mockData ? mockData.folders : rawFolders;
        return [...source].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawFolders, mockData, demoMode]);

    const effectiveUsers = useMemo(() => {
        return demoMode && mockData ? mockData.users : usersList;
    }, [usersList, mockData, demoMode]);

    const effectiveAssets = useMemo(() => {
        return demoMode && mockData ? mockData.assets : rawAssets;
    }, [rawAssets, mockData, demoMode]);

    const effectiveAudits = useMemo(() => {
        return demoMode && mockData ? mockData.audits : rawAudits;
    }, [rawAudits, mockData, demoMode]);

    const effectiveRisks = useMemo(() => {
        return demoMode && mockData ? mockData.risks : rawRisks;
    }, [rawRisks, mockData, demoMode]);


    const loading = demoMode ? !mockData : (loadingDocuments || loadingUsers || loadingControls || loadingAssets || loadingAudits || loadingFolders || loadingRisks);

    return {
        documents: effectiveDocuments,
        usersList: effectiveUsers,
        controls: effectiveControls,
        folders: effectiveFolders,
        rawAssets: effectiveAssets,
        rawAudits: effectiveAudits,
        rawRisks: effectiveRisks,
        loading
    };
};
