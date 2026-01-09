
import React, { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { useStore } from '../../store';
import { Incident } from '../../types';
import { useIncidents } from '../useIncidents';

export const useIncidentLogic = (organizationId?: string) => {
    const { demoMode } = useStore();

    // Actions are handled by the existing useIncidents hook, we can re-export or just focus on data here.
    // Ideally, we might want to merge them, but for now let's keep separation clean:
    // This hook handles *fetching* logic.
    const { loading: actionsLoading, ...incidentActions } = useIncidents();

    const [mockData, setMockData] = React.useState<{
        incidents: Incident[];
    } | null>(null);
    const [mockLoading, setMockLoading] = React.useState(true);

    React.useEffect(() => {
        if (demoMode) {
            setMockLoading(true);
            import('../../services/mockDataService').then(({ MockDataService }) => {
                setMockData({
                    incidents: MockDataService.getCollection('incidents') as Incident[]
                });
                setMockLoading(false);
            });
        }
    }, [demoMode]);

    // Query ONLY Incidents
    const { data: rawIncidents, loading: loadingIncidents, refresh: refreshIncidents } = useFirestoreCollection<Incident>(
        'incidents',
        organizationId ? [where('organizationId', '==', organizationId)] : undefined,
        { logError: true, enabled: !!organizationId && !demoMode, realtime: true }
    );

    // Derived Data
    const incidents = useMemo(() => {
        const source = (demoMode && mockData ? mockData.incidents : (rawIncidents || [])) as Incident[];
        return [...source].sort((a: Incident, b: Incident) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime());
    }, [rawIncidents, demoMode, mockData]);

    const loading = demoMode ? mockLoading : loadingIncidents;

    return {
        incidents,
        loading: loading || actionsLoading,
        refreshIncidents,
        ...incidentActions // Actions without loading
    };
};
