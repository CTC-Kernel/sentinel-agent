import { where } from 'firebase/firestore';
import { useFirestoreCollection } from '../useFirestore';
import { useAuth } from '../useAuth';
import { Risk, Audit, Asset, Document, Control, Incident, Vulnerability, BusinessProcess, Project } from '../../types';

export const useReportsData = (organizationId?: string, enabled = true) => {
 const { claimsSynced } = useAuth();
 // Queries
 const { data: risks, loading: loadingRisks } = useFirestoreCollection<Risk>(
 'risks',
 [where('organizationId', '==', organizationId)],
 { logError: true, enabled: !!organizationId && claimsSynced && enabled, realtime: true }
 );

 const { data: audits, loading: loadingAudits } = useFirestoreCollection<Audit>(
 'audits',
 [where('organizationId', '==', organizationId)],
 { logError: true, enabled: !!organizationId && claimsSynced && enabled, realtime: true }
 );

 const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
 'assets',
 [where('organizationId', '==', organizationId)],
 { logError: true, enabled: !!organizationId && claimsSynced && enabled, realtime: true }
 );

 const { data: documents, loading: loadingDocuments } = useFirestoreCollection<Document>(
 'documents',
 [where('organizationId', '==', organizationId)],
 { logError: true, enabled: !!organizationId && claimsSynced && enabled, realtime: true }
 );

 const { data: controls, loading: loadingControls } = useFirestoreCollection<Control>(
 'controls',
 [where('organizationId', '==', organizationId)],
 { logError: true, enabled: !!organizationId && claimsSynced && enabled, realtime: true }
 );

 // Additional data sometimes needed for comprehensive reports
 const { data: incidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
 'incidents',
 [where('organizationId', '==', organizationId)],
 { logError: true, enabled: !!organizationId && claimsSynced && enabled, realtime: true }
 );

 const { data: vulnerabilities, loading: loadingVulns } = useFirestoreCollection<Vulnerability>(
 'vulnerabilities',
 [where('organizationId', '==', organizationId)],
 { logError: true, enabled: !!organizationId && claimsSynced && enabled, realtime: true }
 );

 const { data: processes, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
 'business_processes',
 [where('organizationId', '==', organizationId)],
 { logError: true, enabled: !!organizationId && claimsSynced && enabled, realtime: true }
 );

 const { data: projects, loading: loadingProjects } = useFirestoreCollection<Project>(
 'projects',
 [where('organizationId', '==', organizationId)],
 { logError: true, enabled: !!organizationId && claimsSynced && enabled, realtime: true }
 );

 const loading = loadingRisks || loadingAudits || loadingAssets || loadingDocuments || loadingControls || loadingIncidents || loadingVulns || loadingProcesses || loadingProjects;

 return {
 risks,
 audits,
 assets,
 documents,
 controls,
 incidents,
 vulnerabilities,
 processes,
 projects,
 loading
 };
};
