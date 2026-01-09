
import { useMemo, useState, useEffect } from 'react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, limit } from 'firebase/firestore';
import { useStore } from '../../store';
import { Asset, Risk, UserProfile, BusinessProcess } from '../../types';
import { MockDataService } from '../../services/mockDataService';

interface UseIncidentDependenciesOptions {
    fetchAssets?: boolean;
    fetchRisks?: boolean;
    fetchUsers?: boolean;
    fetchProcesses?: boolean;
}

export const useIncidentDependencies = (options: UseIncidentDependenciesOptions = {}) => {
    const { user, demoMode } = useStore();
    const {
        fetchAssets = false,
        fetchRisks = false,
        fetchUsers = false,
        fetchProcesses = false
    } = options;

    const shouldFetch = (flag: boolean) => flag && !!user?.organizationId && !demoMode;

    // Mock Data State
    const [mockData, setMockData] = useState<{
        assets: Asset[];
        risks: Risk[];
        users: UserProfile[];
        processes: BusinessProcess[];
    } | null>(null);

    useEffect(() => {
        if (demoMode && !mockData) {
            const timer = setTimeout(() => {
                setMockData({
                    assets: MockDataService.getCollection('assets') as unknown as Asset[],
                    risks: MockDataService.getCollection('risks') as unknown as Risk[],
                    users: MockDataService.getCollection('users') as unknown as UserProfile[],
                    processes: MockDataService.getCollection('business_processes') as unknown as BusinessProcess[]
                });
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [demoMode, mockData]);

    // Data Fetching
    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        shouldFetch(fetchAssets) ? [where('organizationId', '==', user?.organizationId), limit(1000)] : undefined,
        { logError: true, realtime: true }
    );

    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        shouldFetch(fetchRisks) ? [where('organizationId', '==', user?.organizationId), limit(1000)] : undefined,
        { logError: true, realtime: true }
    );

    const { data: rawUsers, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        shouldFetch(fetchUsers) ? [where('organizationId', '==', user?.organizationId), limit(100)] : undefined,
        { logError: true, realtime: true }
    );

    const { data: rawProcesses, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        shouldFetch(fetchProcesses) ? [where('organizationId', '==', user?.organizationId), limit(200)] : undefined,
        { logError: true, realtime: true }
    );

    // Processed Data
    const assets = useMemo(() => {
        if (!fetchAssets) return [];
        const source = demoMode && mockData ? mockData.assets : rawAssets;
        return [...(source || [])].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawAssets, mockData, demoMode, fetchAssets]);

    const risks = useMemo(() => {
        if (!fetchRisks) return [];
        const source = demoMode && mockData ? mockData.risks : rawRisks;
        return [...(source || [])].sort((a, b) => a.threat.localeCompare(b.threat));
    }, [rawRisks, mockData, demoMode, fetchRisks]);

    const usersList = useMemo(() => {
        if (!fetchUsers) return [];
        const source = demoMode && mockData ? mockData.users : rawUsers;
        if (source && source.length > 0) return source;
        if (user && user.uid) return [user];
        return [];
    }, [rawUsers, mockData, demoMode, fetchUsers, user]);

    const processes = useMemo(() => {
        if (!fetchProcesses) return [];
        const source = demoMode && mockData ? mockData.processes : rawProcesses;
        return [...(source || [])];
    }, [rawProcesses, mockData, demoMode, fetchProcesses]);

    const loading = demoMode
        ? !mockData
        : ((fetchAssets && loadingAssets) || (fetchRisks && loadingRisks) || (fetchUsers && loadingUsers) || (fetchProcesses && loadingProcesses));

    return {
        assets,
        risks,
        usersList,
        processes,
        loading
    };
};
