import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Risk, Asset } from '../../types';

export const useThreatIntelActions = () => {
  const { user } = useAuth();

  const { data: threats, loading: loadingThreats } = useFirestoreCollection(
    'threat_intelligence',
    [], // Global threat feed, not org-specific
    { realtime: true, enabled: true }
  );

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

  return {
    threats: threats || [],
    risks: risks || [],
    assets: assets || [],
    loading: loadingThreats || loadingRisks || loadingAssets,
  };
};
