import { useMemo } from 'react';
import { useStore } from '../store';
import { useComplianceActions } from './useComplianceActions';
import { Control, Risk, Finding, Framework, Document, UserProfile, Asset, Supplier, Project } from '../types';
import { useFirestoreCollection } from './useFirestore';
import { where, limit } from 'firebase/firestore';

interface UseComplianceDataOptions {
    fetchRisks?: boolean;
    fetchAssets?: boolean;
    fetchDocuments?: boolean;
    fetchUsers?: boolean;
    fetchSuppliers?: boolean;
    fetchProjects?: boolean;
}

export const useComplianceData = (currentFramework?: Framework, options: UseComplianceDataOptions = {}) => {
    const { user, demoMode } = useStore();
    const {
        fetchRisks = false,
        fetchAssets = false,
        fetchDocuments = false,
        fetchUsers = false,
        fetchSuppliers = false,
        fetchProjects = false
    } = options;

    const shouldFetch = (flag: boolean) => !!user?.organizationId && !demoMode && flag;
    const shouldFetchCore = !!user?.organizationId && !demoMode; // Controls are always fetched

    // 1. Controls (Core - Always Fetched if not demo)
    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>(
        'controls',
        shouldFetchCore ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: shouldFetchCore }
    );

    // 2. Risks
    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        shouldFetch(fetchRisks) ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchRisks) }
    );

    // 3. Assets
    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        shouldFetch(fetchAssets) ? [where('organizationId', '==', user?.organizationId), limit(500)] : undefined, // Limit for perf
        { logError: true, realtime: true, enabled: shouldFetch(fetchAssets) }
    );

    // 4. Documents
    const { data: rawDocuments, loading: loadingDocuments } = useFirestoreCollection<Document>(
        'documents',
        shouldFetch(fetchDocuments) ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchDocuments) }
    );

    // 5. Users
    const { data: rawUsers, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        shouldFetch(fetchUsers) ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchUsers) }
    );

    // 6. Suppliers
    const { data: rawSuppliers, loading: loadingSuppliers } = useFirestoreCollection<Supplier>(
        'suppliers',
        shouldFetch(fetchSuppliers) ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchSuppliers) }
    );

    // 7. Projects
    const { data: rawProjects, loading: loadingProjects } = useFirestoreCollection<Project>(
        'projects',
        shouldFetch(fetchProjects) ? [where('organizationId', '==', user?.organizationId)] : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchProjects) }
    );

    // Actions
    const complianceActions = useComplianceActions(user);

    // Filter Controls by Framework (Simulated client-side filtering or framework specific logic)
    const filteredControls = useMemo(() => {
        if (!rawControls) return [];
        return currentFramework
            ? rawControls.filter(c => c.framework === currentFramework)
            : rawControls;
    }, [rawControls, currentFramework]);

    const loading = loadingControls ||
        (fetchRisks && loadingRisks) ||
        (fetchAssets && loadingAssets) ||
        (fetchDocuments && loadingDocuments) ||
        (fetchUsers && loadingUsers) ||
        (fetchSuppliers && loadingSuppliers) ||
        (fetchProjects && loadingProjects);

    // Default empty arrays if not fetched
    return {
        controls: rawControls || [],
        filteredControls: filteredControls,
        risks: rawRisks || [],
        findings: [] as Finding[], // Findings logic tbd
        documents: rawDocuments || [],
        usersList: rawUsers || [],
        assets: rawAssets || [],
        suppliers: rawSuppliers || [],
        projects: rawProjects || [],
        loading,
        ...complianceActions
    };
};
