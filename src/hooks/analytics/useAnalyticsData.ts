import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Risk, Incident, Asset, Vulnerability, Control } from '../../types';

export const useAnalyticsData = () => {
  const { user } = useAuth();

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

  const { data: vulnerabilities, loading: loadingVulnerabilities } = useFirestoreCollection<Vulnerability>(
    'vulnerabilities',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: controls, loading: loadingControls } = useFirestoreCollection<Control>(
    'controls',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  return {
    risks: risks || [],
    incidents: incidents || [],
    assets: assets || [],
    vulnerabilities: vulnerabilities || [],
    controls: controls || [],
    loading: loadingRisks || loadingIncidents || loadingAssets || loadingVulnerabilities || loadingControls,
  };
};
