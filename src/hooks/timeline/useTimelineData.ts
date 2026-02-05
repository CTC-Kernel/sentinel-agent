import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { SystemLog, Incident, Risk, Document, Asset } from '../../types';

export const useTimelineData = () => {
 const { user } = useAuth();

 const { data: systemLogs, loading: loadingLogs } = useFirestoreCollection<SystemLog>(
 'system_logs',
 [where('organizationId', '==', user?.organizationId || '')],
 { realtime: true, enabled: !!user?.organizationId }
 );

 const { data: incidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
 'incidents',
 [where('organizationId', '==', user?.organizationId || '')],
 { enabled: !!user?.organizationId }
 );

 const { data: risks, loading: loadingRisks } = useFirestoreCollection<Risk>(
 'risks',
 [where('organizationId', '==', user?.organizationId || '')],
 { enabled: !!user?.organizationId }
 );

 const { data: documents, loading: loadingDocuments } = useFirestoreCollection<Document>(
 'documents',
 [where('organizationId', '==', user?.organizationId || '')],
 { enabled: !!user?.organizationId }
 );

 const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
 'assets',
 [where('organizationId', '==', user?.organizationId || '')],
 { enabled: !!user?.organizationId }
 );

 return {
 systemLogs: systemLogs || [],
 incidents: incidents || [],
 risks: risks || [],
 documents: documents || [],
 assets: assets || [],
 loading: loadingLogs || loadingIncidents || loadingRisks || loadingDocuments || loadingAssets,
 };
};
