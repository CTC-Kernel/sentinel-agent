
import { useMemo, useState, useEffect } from 'react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, limit } from 'firebase/firestore';
import { useStore } from '../../store';
import { UserProfile, Supplier, BusinessProcess } from '../../types';
import { MockDataService } from '../../services/mockDataService';

interface UseAssetDependenciesOptions {
    fetchUsers?: boolean;
    fetchSuppliers?: boolean;
    fetchProcesses?: boolean;
    enabled?: boolean;
}

import { useAuth } from '../../hooks/useAuth';

export const useAssetDependencies = (options: UseAssetDependenciesOptions = {}) => {
    const { claimsSynced } = useAuth();
    const { user, demoMode } = useStore();
    const {
        fetchUsers = false,
        fetchSuppliers = false,
        fetchProcesses = false
    } = options;

    // Conditions for fetching
    const organizationId = user?.organizationId;
    const shouldFetch = (flag: boolean) => flag && !!organizationId && !demoMode && claimsSynced && (options.enabled !== false);

    // Mock Data State
    const [mockData, setMockData] = useState<{
        users: UserProfile[];
        suppliers: Supplier[];
        processes: BusinessProcess[];
    } | null>(null);

    useEffect(() => {
        if (demoMode && !mockData) {
            const timer = setTimeout(() => {
                setMockData({
                    users: MockDataService.getCollection('users') as unknown as UserProfile[],
                    suppliers: MockDataService.getCollection('suppliers') as unknown as Supplier[],
                    processes: MockDataService.getCollection('business_processes') as unknown as BusinessProcess[]
                });
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [demoMode, mockData]);

    // Memoize constraints
    const smallConstraint = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId), limit(100)] : undefined;
    }, [organizationId]);

    const mediumConstraint = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId), limit(200)] : undefined;
    }, [organizationId]);

    const { data: rawUsers, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        shouldFetch(fetchUsers) ? smallConstraint : undefined,
        { logError: true, realtime: true }
    );

    const { data: rawSuppliers, loading: loadingSuppliers } = useFirestoreCollection<Supplier>(
        'suppliers',
        shouldFetch(fetchSuppliers) ? mediumConstraint : undefined,
        { logError: true, realtime: true }
    );

    const { data: rawProcesses, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        shouldFetch(fetchProcesses) ? mediumConstraint : undefined,
        { logError: true, realtime: true }
    );

    // Processed Data
    const usersList = useMemo(() => {
        if (!fetchUsers) return [];
        const source = demoMode && mockData ? mockData.users : rawUsers;
        if (source && source.length > 0) return source;
        if (user && user.uid) return [user];
        return [];
    }, [rawUsers, mockData, demoMode, fetchUsers, user]);

    const suppliers = useMemo(() => {
        if (!fetchSuppliers) return [];
        const source = demoMode && mockData ? mockData.suppliers : rawSuppliers;
        return [...source];
    }, [rawSuppliers, mockData, demoMode, fetchSuppliers]);

    const processes = useMemo(() => {
        if (!fetchProcesses) return [];
        const source = demoMode && mockData ? mockData.processes : rawProcesses;
        return [...source];
    }, [rawProcesses, mockData, demoMode, fetchProcesses]);

    const loading = demoMode
        ? !mockData
        : ((fetchUsers && loadingUsers) || (fetchSuppliers && loadingSuppliers) || (fetchProcesses && loadingProcesses));

    return {
        usersList,
        suppliers,
        processes,
        loading
    };
};
