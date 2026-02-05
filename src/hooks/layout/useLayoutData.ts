import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Notification, Document, Risk, Incident, Asset, Project } from '../../types';

export interface UseLayoutDataOptions {
 /** Enable loading of searchable entities (assets, risks, documents, incidents, projects) */
 enableSearch?: boolean;
 /** Enable loading of notifications (always realtime) */
 enableNotifications?: boolean;
}

export const useLayoutData = (options: UseLayoutDataOptions = {}) => {
 const { enableSearch = true, enableNotifications = true } = options;
 const { user } = useAuth();

 const { data: notifications, loading: loadingNotifications } = useFirestoreCollection<Notification>(
 'notifications',
 [where('userId', '==', user?.uid || '')],
 { realtime: true, enabled: enableNotifications && !!user?.uid }
 );

 // Command palette needs access to searchable entities - only load when enabled
 const { data: documents, loading: loadingDocuments } = useFirestoreCollection<Document>(
 'documents',
 [where('organizationId', '==', user?.organizationId || '')],
 { enabled: enableSearch && !!user?.organizationId }
 );

 const { data: risks, loading: loadingRisks } = useFirestoreCollection<Risk>(
 'risks',
 [where('organizationId', '==', user?.organizationId || '')],
 { enabled: enableSearch && !!user?.organizationId }
 );

 const { data: incidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
 'incidents',
 [where('organizationId', '==', user?.organizationId || '')],
 { enabled: enableSearch && !!user?.organizationId }
 );

 const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
 'assets',
 [where('organizationId', '==', user?.organizationId || '')],
 { enabled: enableSearch && !!user?.organizationId }
 );

 const { data: projects, loading: loadingProjects } = useFirestoreCollection<Project>(
 'projects',
 [where('organizationId', '==', user?.organizationId || '')],
 { enabled: enableSearch && !!user?.organizationId }
 );


 return {
 notifications: notifications || [],
 documents: documents || [],
 risks: risks || [],
 incidents: incidents || [],
 assets: assets || [],
 projects: projects || [],
 loading: loadingNotifications || loadingDocuments || loadingRisks || loadingIncidents || loadingAssets || loadingProjects,
 };
};
