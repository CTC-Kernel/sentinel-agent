import React, { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { useStore } from '../../store';
import { Incident, Asset, Risk, UserProfile, BusinessProcess } from '../../types';

export const useIncidentsData = (organizationId?: string) => {
    const { demoMode } = useStore();
    const [mockData, setMockData] = React.useState<Record<string, unknown[]>>({ incidents: [], assets: [], risks: [], users: [], processes: [] });
    const [mockLoading, setMockLoading] = React.useState(true);

    React.useEffect(() => {
        if (demoMode) {
            setMockLoading(true);
            import('../../services/mockDataService').then(({ MockDataService }) => {
                setMockData({
                    incidents: MockDataService.getCollection('incidents'),
                    assets: MockDataService.getCollection('assets'),
                    risks: MockDataService.getCollection('risks'),
                    users: MockDataService.getCollection('users'),
                    processes: MockDataService.getCollection('business_processes')
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
        const source = (demoMode ? mockData.incidents : rawIncidents) as Incident[];
        return [...source].sort((a: Incident, b: Incident) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime());
    }, [rawIncidents, demoMode, mockData.incidents]);

    const assets = useMemo(() => {
        const source = (demoMode ? mockData.assets : rawAssets) as Asset[];
        return [...source].sort((a: Asset, b: Asset) => a.name.localeCompare(b.name));
    }, [rawAssets, demoMode, mockData.assets]);

    const risks = useMemo(() => {
        const source = (demoMode ? mockData.risks : rawRisks) as Risk[];
        return [...source].sort((a: Risk, b: Risk) => a.threat.localeCompare(b.threat));
    }, [rawRisks, demoMode, mockData.risks]);

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
