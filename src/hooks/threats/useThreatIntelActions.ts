import { useFirestoreCollection } from '../useFirestore';
import { where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { useCallback } from 'react';
import { Risk, Asset } from '../../types';

export const useThreatIntelActions = () => {
  const { user } = useAuth();

  const { data: threats, loading: loadingThreats } = useFirestoreCollection(
    'threat_intelligence',
    [], // Global threat feed, not org-specific
    { realtime: true, enabled: true }
  );

  // Community threats with write operations
  const { add: addCommunityThreat, update: updateCommunityThreat } = useFirestoreCollection(
    'threats',
    [],
    { enabled: false } // Only used for writing, not reading
  );

  const { data: risks, loading: loadingRisks, add: addRiskRaw } = useFirestoreCollection<Risk>(
    'risks',
    [where('organizationId', '==', user?.organizationId || '')],
    { enabled: !!user?.organizationId }
  );

  const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
    'assets',
    [where('organizationId', '==', user?.organizationId || '')],
    { enabled: !!user?.organizationId }
  );

  const addRisk = useCallback(async (data: Partial<Risk>) => {
    if (!user?.organizationId) throw new Error('Missing organizationId');
    return addRiskRaw({
      ...data,
      organizationId: user.organizationId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }, [addRiskRaw, user]);

  return {
    threats: threats || [],
    risks: risks || [],
    assets: assets || [],
    loading: loadingThreats || loadingRisks || loadingAssets,
    addCommunityThreat,
    updateCommunityThreat,
    addRisk,
  };
};
