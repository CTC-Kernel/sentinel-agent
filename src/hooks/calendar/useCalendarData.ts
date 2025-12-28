import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Asset, Risk } from '../../types';

export const useCalendarData = () => {
  const { user } = useAuth();

  const { data: events, loading: loadingEvents } = useFirestoreCollection(
    'calendar_events',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: assets, loading: loadingAssets } = useFirestoreCollection<Asset>(
    'assets',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: risks, loading: loadingRisks } = useFirestoreCollection<Risk>(
    'risks',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  return {
    events: events || [],
    assets: assets || [],
    risks: risks || [],
    loading: loadingEvents || loadingAssets || loadingRisks,
  };
};
