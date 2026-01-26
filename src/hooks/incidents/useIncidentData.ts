
import React, { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { useStore } from '../../store';
import { Incident } from '../../types';

export const useIncidentData = (organizationId?: string, enabled = true) => {
    const { demoMode } = useStore();

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

    // Memoize constraints to ensure stable key generation in useFirestoreCollection
    const constraints = useMemo(() => {
        return organizationId ? [where('organizationId', '==', organizationId)] : undefined;
    }, [organizationId]);

    // Query ONLY Incidents
    const { data: rawIncidents, loading: loadingIncidents, refresh: refreshIncidents } = useFirestoreCollection<Incident>(
        'incidents',
        constraints,
        { logError: true, enabled: !!organizationId && !demoMode && enabled, realtime: true }
    );

    // Derived Data
    const incidents = useMemo(() => {
        const source = (demoMode && mockData ? mockData.incidents : (rawIncidents || [])) as Incident[];
        return [...source].sort((a: Incident, b: Incident) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime());
    }, [rawIncidents, demoMode, mockData]);

    const loading = demoMode ? mockLoading : loadingIncidents;

    return {
        incidents,
        loading,
        refreshIncidents
    };
};
