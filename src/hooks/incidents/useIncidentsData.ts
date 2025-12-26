import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { Incident, Asset, Risk, UserProfile, BusinessProcess } from '../../types';

export const useIncidentsData = (organizationId?: string) => {
    // Queries
    const { data: rawIncidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
        'incidents',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: rawProcesses, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    // Derived Data
    const sortedIncidents = useMemo(() =>
        [...rawIncidents].sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime()),
        [rawIncidents]
    );

    const assets = useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);
    const risks = useMemo(() => [...rawRisks].sort((a, b) => a.threat.localeCompare(b.threat)), [rawRisks]);

    // FIX: Ensure usersList is never empty if logged in logic is handled in view or here?
    // Let's just return the raw list and let the view handle "effectiveUsers" or handle it here if we pass user.
    // For now, keeping it simple.

    const loading = loadingIncidents || loadingAssets || loadingRisks || loadingUsers || loadingProcesses;

    return {
        sortedIncidents,
        assets,
        risks,
        usersList,
        rawProcesses,
        loading
    };
};
