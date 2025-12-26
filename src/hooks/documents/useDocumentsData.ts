import { useMemo } from 'react';
import { where, orderBy, limit } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { Document, UserProfile, Control, Asset, Audit, DocumentFolder, Risk } from '../../types';
import { EncryptionService } from '../../services/encryptionService';

export const useDocumentsData = (organizationId?: string) => {
    // Queries
    const { data: rawDocuments, loading: loadingDocuments } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    const { data: rawFolders, loading: loadingFolders } = useFirestoreCollection<DocumentFolder>(
        'document_folders',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true, enabled: !!organizationId }
    );

    // Derived Data
    const documents = useMemo(() => {
        return [...rawDocuments]
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(doc => ({
                ...doc,
                description: EncryptionService.decrypt(doc.description || '')
            }));
    }, [rawDocuments]);

    const controls = useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const folders = useMemo(() => [...rawFolders].sort((a, b) => a.name.localeCompare(b.name)), [rawFolders]);

    const loading = loadingDocuments || loadingUsers || loadingControls || loadingAssets || loadingAudits || loadingFolders || loadingRisks;

    return {
        documents,
        usersList,
        controls,
        folders,
        rawAssets,
        rawAudits,
        rawRisks,
        loading
    };
};
