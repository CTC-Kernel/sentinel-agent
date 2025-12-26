import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { Vulnerability, Asset, Project, UserProfile } from '../../types';

export const useVulnerabilitiesData = (organizationId?: string) => {
    // Queries
    // Note: Vulnerabilities likely large list so we might want to paginate later, but consistent with others now.
    const { data: rawVulnerabilities, loading: loadingVulnerabilities } = useFirestoreCollection<Vulnerability>(
        'vulnerabilities',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: projects, loading: loadingProjects } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    const { data: users, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', organizationId)],
        { logError: true, enabled: !!organizationId, realtime: true }
    );

    // Derived Data
    // Sort by discovery date descending by default
    const vulnerabilities = useMemo(() =>
        [...rawVulnerabilities].sort((a, b) => new Date(b.dateDiscovered).getTime() - new Date(a.dateDiscovered).getTime()),
        [rawVulnerabilities]
    );

    const loading = loadingVulnerabilities || loadingAssets || loadingProjects || loadingUsers;

    return {
        vulnerabilities,
        assets,
        projects,
        users,
        loading
    };
};
