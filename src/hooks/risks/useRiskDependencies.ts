
import { useMemo, useState, useEffect } from 'react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, limit } from 'firebase/firestore';
import { useStore } from '../../store';
import { Asset, Control, BusinessProcess as Process, Supplier, Incident, Audit, Project, UserProfile } from '../../types';
import { MockDataService } from '../../services/mockDataService';

interface UseRiskDependenciesOptions {
    fetchAssets?: boolean;
    fetchControls?: boolean;
    fetchProcesses?: boolean;
    fetchSuppliers?: boolean;
    fetchIncidents?: boolean;
    fetchAudits?: boolean;
    fetchProjects?: boolean;
    fetchUsers?: boolean;
}

export const useRiskDependencies = (options: UseRiskDependenciesOptions = {}) => {
    const { user, demoMode } = useStore();
    const {
        fetchAssets = false,
        fetchControls = false,
        fetchProcesses = false,
        fetchSuppliers = false,
        fetchIncidents = false,
        fetchAudits = false,
        fetchProjects = false,
        fetchUsers = false
    } = options;

    // Conditions for fetching
    const organizationId = user?.organizationId;
    const shouldFetch = (flag: boolean) => flag && !!organizationId && !demoMode;

    // Mock Data State
    const [mockData, setMockData] = useState<{
        assets: Asset[];
        controls: Control[];
        processes: Process[];
        suppliers: Supplier[];
        incidents: Incident[];
        audits: Audit[];
        projects: Project[];
        users: UserProfile[];
    } | null>(null);

    useEffect(() => {
        if (demoMode && !mockData) {
            const timer = setTimeout(() => {
                setMockData({
                    assets: MockDataService.getCollection('assets') as Asset[],
                    controls: MockDataService.getCollection('controls') as Control[],
                    processes: MockDataService.getCollection('business_processes') as Process[],
                    suppliers: MockDataService.getCollection('suppliers') as Supplier[],
                    incidents: MockDataService.getCollection('incidents') as Incident[],
                    audits: MockDataService.getCollection('audits') as Audit[],
                    projects: MockDataService.getCollection('projects') as Project[],
                    users: MockDataService.getCollection('users') as unknown as UserProfile[]
                });
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [demoMode, mockData]);

    // Memoize constraints


    const assetConstraint = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId), limit(500)] : undefined;
    }, [organizationId]);

    const controlConstraint = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId), limit(1000)] : undefined;
    }, [organizationId]);

    const subConstraint = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId), limit(200)] : undefined;
    }, [organizationId]);

    const smallConstraint = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId), limit(100)] : undefined;
    }, [organizationId]);


    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        shouldFetch(fetchAssets) ? assetConstraint : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchAssets) }
    );

    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>(
        'controls',
        shouldFetch(fetchControls) ? controlConstraint : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchControls) }
    );

    const { data: rawProcesses, loading: loadingProcesses } = useFirestoreCollection<Process>(
        'business_processes',
        shouldFetch(fetchProcesses) ? subConstraint : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchProcesses) }
    );

    const { data: rawSuppliers, loading: loadingSuppliers } = useFirestoreCollection<Supplier>(
        'suppliers',
        shouldFetch(fetchSuppliers) ? subConstraint : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchSuppliers) }
    );

    const { data: rawIncidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
        'incidents',
        shouldFetch(fetchIncidents) ? smallConstraint : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchIncidents) }
    );

    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>(
        'audits',
        shouldFetch(fetchAudits) ? smallConstraint : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchAudits) }
    );

    const { data: rawProjects, loading: loadingProjects } = useFirestoreCollection<Project>(
        'projects',
        shouldFetch(fetchProjects) ? smallConstraint : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchProjects) }
    );

    const { data: rawUsers, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        shouldFetch(fetchUsers) ? smallConstraint : undefined,
        { logError: true, realtime: true, enabled: shouldFetch(fetchUsers) }
    );

    // Processed Data
    const assets = useMemo(() => {
        if (!fetchAssets) return [];
        const source = demoMode && mockData ? mockData.assets : rawAssets;
        return [...source].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawAssets, mockData, demoMode, fetchAssets]);

    const controls = useMemo(() => {
        if (!fetchControls) return [];
        const source = demoMode && mockData ? mockData.controls : rawControls;
        return [...source].sort((a, b) => a.code.localeCompare(b.code));
    }, [rawControls, mockData, demoMode, fetchControls]);

    const processes = useMemo(() => {
        if (!fetchProcesses) return [];
        const source = demoMode && mockData ? mockData.processes : rawProcesses;
        return [...source];
    }, [rawProcesses, mockData, demoMode, fetchProcesses]);

    const suppliers = useMemo(() => {
        if (!fetchSuppliers) return [];
        const source = demoMode && mockData ? mockData.suppliers : rawSuppliers;
        return [...source];
    }, [rawSuppliers, mockData, demoMode, fetchSuppliers]);

    const incidents = useMemo(() => {
        if (!fetchIncidents) return [];
        const source = demoMode && mockData ? mockData.incidents : rawIncidents;
        return [...source];
    }, [rawIncidents, mockData, demoMode, fetchIncidents]);

    const audits = useMemo(() => {
        if (!fetchAudits) return [];
        const source = demoMode && mockData ? mockData.audits : rawAudits;
        return [...source];
    }, [rawAudits, mockData, demoMode, fetchAudits]);

    const projects = useMemo(() => {
        if (!fetchProjects) return [];
        const source = demoMode && mockData ? mockData.projects : rawProjects;
        return [...source];
    }, [rawProjects, mockData, demoMode, fetchProjects]);

    const usersList = useMemo(() => {
        if (!fetchUsers) return [];
        const source = demoMode && mockData ? mockData.users : rawUsers;
        if (source && source.length > 0) return source;
        if (user && user.uid) return [user];
        return [];
    }, [rawUsers, mockData, demoMode, fetchUsers, user]);

    const loading = demoMode
        ? !mockData
        : (
            (fetchAssets && loadingAssets) ||
            (fetchControls && loadingControls) ||
            (fetchProcesses && loadingProcesses) ||
            (fetchSuppliers && loadingSuppliers) ||
            (fetchIncidents && loadingIncidents) ||
            (fetchAudits && loadingAudits) ||
            (fetchProjects && loadingProjects) ||
            (fetchUsers && loadingUsers)
        );

    return {
        assets,
        controls,
        processes,
        suppliers,
        incidents,
        audits,
        projects,
        usersList,
        loading
    };
};
