import { useMemo, useState, useEffect } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { Document, UserProfile, DocumentFolder } from '../../types';
import { useStore } from '../../store';
import { useAuth } from '../useAuth';
import { MockDataService } from '../../services/mockDataService';

export const useDocumentsData = (organizationId?: string, enabled = true) => {
    const { claimsSynced } = useAuth();
    const { demoMode: storeDemoMode } = useStore();
    // Prioritize localStorage and window global for reliability in tests/demo
    const demoMode = storeDemoMode ||
        (typeof window !== 'undefined' && (
            !!((window as unknown as { __TEST_MODE__: boolean }).__TEST_MODE__) ||
            (() => { try { return localStorage.getItem('demoMode') === 'true' } catch { return false } })()
        ));

    // Mock Data State
    const [mockData, setMockData] = useState<{
        documents: Document[];
        users: UserProfile[];
        folders: DocumentFolder[];
    } | null>(null);

    // Memoize constraints
    const constraints = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId)] : undefined;
    }, [organizationId]);

    // Queries (Disabled in Demo Mode)
    const { data: rawDocuments, loading: loadingDocuments } = useFirestoreCollection<Document>(
        'documents',
        constraints,
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode && claimsSynced && enabled }
    );

    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        constraints,
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode && claimsSynced && enabled }
    );

    const { data: rawFolders, loading: loadingFolders } = useFirestoreCollection<DocumentFolder>(
        'document_folders',
        constraints,
        { logError: true, realtime: true, enabled: !!organizationId && !demoMode && claimsSynced && enabled }
    );

    // Load Mock Data Effect
    useEffect(() => {
        if (demoMode && !mockData) {
            setTimeout(() => {
                setMockData({
                    documents: MockDataService.getCollection('documents') as Document[],
                    users: MockDataService.getCollection('users') as unknown as UserProfile[],
                    folders: [] // No mock folders yet
                });
            }, 0);
        }
    }, [demoMode, mockData]);

    const effectiveDocuments = useMemo(() => {
        const source = (demoMode && mockData ? mockData.documents : rawDocuments) || [];
        return [...source].sort((a, b) => a.title.localeCompare(b.title));
    }, [rawDocuments, mockData, demoMode]);

    const effectiveFolders = useMemo(() => {
        const source = (demoMode && mockData ? mockData.folders : rawFolders) || [];
        return [...source].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawFolders, mockData, demoMode]);

    const effectiveUsers = useMemo(() => {
        return (demoMode && mockData ? mockData.users : usersList) || [];
    }, [usersList, mockData, demoMode]);

    const loading = demoMode ? !mockData : (loadingDocuments || loadingUsers || loadingFolders);

    return {
        documents: effectiveDocuments,
        usersList: effectiveUsers,
        folders: effectiveFolders,
        loading
    };
};
