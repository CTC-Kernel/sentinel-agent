import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { Vulnerability, Asset, Project, UserProfile } from '../../types';

export const useVulnerabilitiesData = (organizationId?: string, enabled = true) => {
 // Queries
 // Note: Vulnerabilities likely large list so we might want to paginate later, but consistent with others now.
 // Memoize constraints
 const constraints = useMemo(() => {
 return organizationId ? [where('organizationId', '==', organizationId)] : undefined;
 }, [organizationId]);

 const { data: rawVulnerabilities, loading: loadingVulnerabilities } = useFirestoreCollection<Vulnerability>(
 'vulnerabilities',
 constraints,
 { logError: true, enabled: !!organizationId && enabled, realtime: true }
 );

 const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
 'assets',
 constraints,
 { logError: true, enabled: !!organizationId && enabled, realtime: true }
 );

 const { data: projects, loading: loadingProjects } = useFirestoreCollection<Project>(
 'projects',
 constraints,
 { logError: true, enabled: !!organizationId && enabled, realtime: true }
 );

 const { data: users, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
 'users',
 constraints,
 { logError: true, enabled: !!organizationId && enabled, realtime: true }
 );

 // Derived Data
 // Sort by discovery date descending by default
 const vulnerabilities = useMemo(() =>
 [...rawVulnerabilities].sort((a, b) => new Date(b.dateDiscovered || b.publishedDate).getTime() - new Date(a.dateDiscovered || a.publishedDate).getTime()),
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
