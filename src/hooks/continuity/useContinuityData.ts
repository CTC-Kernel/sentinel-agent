import { useMemo } from 'react';
import { where, orderBy } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { BusinessProcess, BcpDrill, Asset, Risk, Supplier, UserProfile, Incident } from '../../types';

export const useContinuityData = (organizationId?: string) => {
    // Queries
    const { data: processes, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    // Drills - Order by date
    const { data: drillsRaw, loading: loadingDrills } = useFirestoreCollection<BcpDrill>(
        'bcp_drills',
        [where('organizationId', '==', organizationId), orderBy('date', 'desc')],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: risks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: suppliers, loading: loadingSuppliers } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: users, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: incidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
        'incidents',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    // Derived Data
    // Filter out drills that might have missing dates if any, though orderBy handles it usually.
    const drills = useMemo(() => drillsRaw, [drillsRaw]);

    const loading = loadingProcesses || loadingDrills || loadingAssets || loadingRisks || loadingSuppliers || loadingUsers || loadingIncidents;

    return {
        processes,
        drills,
        assets,
        risks,
        suppliers,
        users,
        incidents,
        loading
    };
};
