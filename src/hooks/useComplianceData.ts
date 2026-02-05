import { useMemo } from 'react';
import { useStore } from '../store';
import { useComplianceActions } from './useComplianceActions';
import { Control, Risk, Finding, Framework, Document, UserProfile, Asset, Supplier, Project } from '../types';
import { useFirestoreCollection } from './useFirestore';
import { where, limit } from 'firebase/firestore';
import { useAuth } from './useAuth';

export const useComplianceData = (currentFramework?: Framework, enabled = true) => {
 const { user, claimsSynced } = useAuth();
 const { demoMode } = useStore();

 const shouldFetch = !!user?.organizationId && !demoMode && claimsSynced && enabled;

 const organizationId = user?.organizationId;

 // Memoize constraints
 const constraints = useMemo(() => {
 return organizationId ? [where('organizationId', '==', organizationId), limit(1000)] : undefined;
 }, [organizationId]);

 // 1. Controls (Core - Always Fetched if not demo)
 const { data: rawControls, loading: loadingControls, error: errorControls } = useFirestoreCollection<Control>(
 'controls',
 shouldFetch ? constraints : undefined,
 { logError: true, realtime: true, enabled: shouldFetch }
 );

 // 2. Risks
 const { data: rawRisks, loading: loadingRisks, error: errorRisks } = useFirestoreCollection<Risk>(
 'risks',
 shouldFetch ? constraints : undefined,
 { logError: true, realtime: true, enabled: shouldFetch }
 );

 // 3. Assets
 const { data: rawAssets, loading: loadingAssets, error: errorAssets } = useFirestoreCollection<Asset>(
 'assets',
 shouldFetch ? constraints : undefined,
 { logError: true, realtime: true, enabled: shouldFetch }
 );

 // 4. Documents
 const { data: rawDocuments, loading: loadingDocuments, error: errorDocuments } = useFirestoreCollection<Document>(
 'documents',
 shouldFetch ? constraints : undefined,
 { logError: true, realtime: true, enabled: shouldFetch }
 );

 // 5. Users
 const { data: rawUsers, loading: loadingUsers, error: errorUsers } = useFirestoreCollection<UserProfile>(
 'users',
 shouldFetch ? constraints : undefined,
 { logError: true, realtime: true, enabled: shouldFetch }
 );

 // 6. Suppliers
 const { data: rawSuppliers, loading: loadingSuppliers, error: errorSuppliers } = useFirestoreCollection<Supplier>(
 'suppliers',
 shouldFetch ? constraints : undefined,
 { logError: true, realtime: true, enabled: shouldFetch }
 );

 // 7. Projects
 const { data: rawProjects, loading: loadingProjects, error: errorProjects } = useFirestoreCollection<Project>(
 'projects',
 shouldFetch ? constraints : undefined,
 { logError: true, realtime: true, enabled: shouldFetch }
 );

 // Actions
 const complianceActions = useComplianceActions(user);

 // Filter Controls by Framework
 const filteredControls = useMemo(() => {
 if (!rawControls) return [];
 return currentFramework
 ? rawControls.filter(c => c.framework === currentFramework)
 : rawControls;
 }, [rawControls, currentFramework]);

 const loading = loadingControls || loadingRisks || loadingAssets || loadingDocuments || loadingUsers || loadingSuppliers || loadingProjects;

 // Default empty arrays if not fetched
 const error = errorControls || errorRisks || errorAssets || errorDocuments || errorUsers || errorSuppliers || errorProjects;

 return {
 controls: rawControls || [],
 filteredControls: filteredControls,
 risks: rawRisks || [],
 findings: [] as Finding[],
 documents: rawDocuments || [],
 usersList: rawUsers || [],
 assets: rawAssets || [],
 suppliers: rawSuppliers || [],
 projects: rawProjects || [],
 loading,
 error,
 ...complianceActions
 };

};
