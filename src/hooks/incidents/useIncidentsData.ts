import React, { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { useStore } from '../../store';
import { Incident, Asset, Risk, UserProfile, BusinessProcess } from '../../types';

export const useIncidentsData = (organizationId?: string) => {
    const { demoMode } = useStore();
    const [mockData, setMockData] = React.useState<{
        incidents: Incident[];
        assets: Asset[];
        risks: Risk[];
        users: UserProfile[];
        processes: BusinessProcess[];
    }>({ incidents: [], assets: [], risks: [], users: [], processes: [] });
    const [mockLoading, setMockLoading] = React.useState(true);

    React.useEffect(() => {
        if (demoMode) {
            setMockLoading(true);
            import('../../services/mockDataService').then(({ MockDataService }) => {
                setMockData({
                    incidents: MockDataService.getCollection('incidents') as Incident[],
                    assets: MockDataService.getCollection('assets') as Asset[],
                    risks: MockDataService.getCollection('risks') as Risk[],
                    users: MockDataService.getCollection('users') as unknown as UserProfile[],
                    processes: MockDataService.getCollection('business_processes') as BusinessProcess[]
                });
                setMockLoading(false);
            });
        }
    }, [demoMode]);

    // Queries
    const { data: rawIncidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
        'incidents',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId && !demoMode, realtime: true }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId && !demoMode, realtime: true }
    );

    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId && !demoMode, realtime: true }
    );

    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId && !demoMode, realtime: true }
    );

    const { data: rawProcesses, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId && !demoMode, realtime: true }
    );

    // Derived Data
    const sortedIncidents = useMemo(() => {
        const source = demoMode ? mockData.incidents : rawIncidents;
        return [...source].sort((a: Incident, b: Incident) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime());
    }, [rawIncidents, demoMode, mockData.incidents]);

    const assets = useMemo(() => {
        const source = demoMode ? mockData.assets : rawAssets;
        return [...source].sort((a: Asset, b: Asset) => a.name.localeCompare(b.name));
    }, [rawAssets, demoMode, mockData.assets]);

    const risks = useMemo(() => {
        const source = demoMode ? mockData.risks : rawRisks;
        return [...source].sort((a: Risk, b: Risk) => a.threat.localeCompare(b.threat));
    }, [rawRisks, demoMode, mockData.risks]);

    // FIX: Ensure usersList is never empty if logged in logic is handled in view or here?
    // Let's just return the raw list and let the view handle "effectiveUsers" or handle it here if we pass user.
    // For now, keeping it simple.

    const loading = demoMode ? mockLoading : (loadingIncidents || loadingAssets || loadingRisks || loadingUsers || loadingProcesses);

    return {
        sortedIncidents,
        assets,
        risks,
        usersList: demoMode ? mockData.users : usersList,
        rawProcesses: demoMode ? mockData.processes : rawProcesses,
        loading
    };
};
