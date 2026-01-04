import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Notification, Document, Risk, Incident, Asset, Project } from '../../types';

export const useLayoutData = () => {
  const { user } = useAuth();

  const { data: notifications, loading: loadingNotifications } = useFirestoreCollection<Notification>(
    'notifications',
    [where('userId', '==', user?.uid || 'ignore')],
    { realtime: true, enabled: !!user?.uid }
  );

  // Command palette needs access to searchable entities
  const { data: documents, loading: loadingDocuments } = useFirestoreCollection<Document>(
    'documents',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: risks, loading: loadingRisks } = useFirestoreCollection<Risk>(
    'risks',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: incidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
    'incidents',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
    'assets',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: projects, loading: loadingProjects } = useFirestoreCollection<Project>(
    'projects',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const debugLoading = {
    notifications: loadingNotifications,
    documents: loadingDocuments,
    risks: loadingRisks,
    incidents: loadingIncidents,
    assets: loadingAssets,
    projects: loadingProjects,
    userOrg: user?.organizationId
  };

  if (loadingNotifications || loadingDocuments || loadingRisks || loadingIncidents || loadingAssets || loadingProjects) {
    const loadingStates = [
      ['notifications', loadingNotifications],
      ['documents', loadingDocuments],
      ['risks', loadingRisks],
      ['incidents', loadingIncidents],
      ['assets', loadingAssets],
      ['projects', loadingProjects]
    ];
    console.log('Loading states:', loadingStates.filter(([, v]) => v === true).map(([k]) => k).join(', '));
  }

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
