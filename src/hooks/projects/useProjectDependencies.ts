import { useMemo, useState, useEffect } from 'react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { where, limit } from 'firebase/firestore';
import { useStore } from '../../store';
import { Risk, Control, Asset, Audit, UserProfile } from '../../types';
import { MockDataService } from '../../services/mockDataService';

interface UseProjectDependenciesOptions {
    fetchRisks?: boolean;
    fetchControls?: boolean;
    fetchAssets?: boolean;
    fetchAudits?: boolean;
    fetchUsers?: boolean;
}

export const useProjectDependencies = (options: UseProjectDependenciesOptions = {}) => {
    const { user, demoMode } = useStore();
    const {
        fetchRisks = false,
        fetchControls = false,
        fetchAssets = false,
        fetchAudits = false,
        fetchUsers = false
    } = options;

    // Conditions for fetching
    const shouldFetchRisks = fetchRisks && !!user?.organizationId && !demoMode;
    const shouldFetchControls = fetchControls && !!user?.organizationId && !demoMode;
    const shouldFetchAssets = fetchAssets && !!user?.organizationId && !demoMode;
    const shouldFetchAudits = fetchAudits && !!user?.organizationId && !demoMode;
    const shouldFetchUsers = fetchUsers && !!user?.organizationId && !demoMode;

    // Mock Data State
    const [mockData, setMockData] = useState<{
        risks: Risk[];
        controls: Control[];
        assets: Asset[];
        audits: Audit[];
        users: UserProfile[];
    } | null>(null);

    useEffect(() => {
        if (demoMode && !mockData) {
            const timer = setTimeout(() => {
                setMockData({
                    risks: MockDataService.getCollection('risks') as Risk[],
                    controls: MockDataService.getCollection('controls') as Control[],
                    assets: MockDataService.getCollection('assets') as Asset[],
                    audits: MockDataService.getCollection('audits') as Audit[],
                    users: MockDataService.getCollection('users') as unknown as UserProfile[]
                });
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [demoMode, mockData]);

    // Firestore Collections - Only fetch if requested
    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        shouldFetchRisks ? [where('organizationId', '==', user?.organizationId), limit(500)] : undefined,
        { logError: true, realtime: true }
    );

    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>(
        'controls',
        shouldFetchControls ? [where('organizationId', '==', user?.organizationId), limit(1000)] : undefined,
        { logError: true, realtime: true }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        shouldFetchAssets ? [where('organizationId', '==', user?.organizationId), limit(500)] : undefined,
        { logError: true, realtime: true }
    );

    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>(
        'audits',
        shouldFetchAudits ? [where('organizationId', '==', user?.organizationId), limit(500)] : undefined,
        { logError: true, realtime: true }
    );

    const { data: rawUsers, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        shouldFetchUsers ? [where('organizationId', '==', user?.organizationId), limit(100)] : undefined,
        { logError: true, realtime: true }
    );

    // Processed Data
    const risks = useMemo(() => {
        if (!fetchRisks) return [];
        const source = demoMode && mockData ? mockData.risks : rawRisks;
        return [...source].sort((a, b) => b.score - a.score);
    }, [rawRisks, mockData, demoMode, fetchRisks]);

    const controls = useMemo(() => {
        if (!fetchControls) return [];
        const source = demoMode && mockData ? mockData.controls : rawControls;
        return [...source].sort((a, b) => a.code.localeCompare(b.code));
    }, [rawControls, mockData, demoMode, fetchControls]);

    const assets = useMemo(() => {
        if (!fetchAssets) return [];
        const source = demoMode && mockData ? mockData.assets : rawAssets;
        return [...source].sort((a, b) => a.name.localeCompare(b.name));
    }, [rawAssets, mockData, demoMode, fetchAssets]);

    const audits = useMemo(() => {
        if (!fetchAudits) return [];
        const source = demoMode && mockData ? mockData.audits : rawAudits;
        return [...source].sort((a, b) => new Date(b.dateScheduled).getTime() - new Date(a.dateScheduled).getTime());
    }, [rawAudits, mockData, demoMode, fetchAudits]);

    const usersList = useMemo(() => {
        if (!fetchUsers) return [];
        const source = demoMode && mockData ? mockData.users : rawUsers;
        if (source && source.length > 0) return source;
        if (user && user.uid) return [user];
        return [];
    }, [rawUsers, mockData, demoMode, fetchUsers, user]);

    const loading = demoMode
        ? !mockData
        : ((fetchRisks && loadingRisks) || (fetchControls && loadingControls) ||
            (fetchAssets && loadingAssets) || (fetchAudits && loadingAudits) ||
            (fetchUsers && loadingUsers));

    return {
        risks,
        controls,
        assets,
        audits,
        usersList,
        loading
    };
};
