import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Risk, Asset, Incident, Document, Project, Control } from '../../types';

export const useRelationshipsData = () => {
  const { user } = useAuth();

  const { data: risks, loading: loadingRisks } = useFirestoreCollection<Risk>(
    'risks',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
    'assets',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: incidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
    'incidents',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: documents, loading: loadingDocuments } = useFirestoreCollection<Document>(
    'documents',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: projects, loading: loadingProjects } = useFirestoreCollection<Project>(
    'projects',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: controls, loading: loadingControls } = useFirestoreCollection<Control>(
    'compliance_controls',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  return {
    risks: risks || [],
    assets: assets || [],
    incidents: incidents || [],
    documents: documents || [],
    projects: projects || [],
    controls: controls || [],
    loading: loadingRisks || loadingAssets || loadingIncidents || loadingDocuments || loadingProjects || loadingControls,
  };
};
