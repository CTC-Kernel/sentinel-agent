import { useFirestoreCollection } from '../useFirestore';
import { where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { useCallback } from 'react';
import { BusinessProcess, Strategy } from '../../types';

export const useContinuityActions = () => {
  const { user } = useAuth();

  const { data: strategies, loading: loadingStrategies, add: addStrategyRaw, remove: removeStrategy } = useFirestoreCollection<Strategy>(
    'bcp_strategies',
    [where('organizationId', '==', user?.organizationId)],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: drills, loading: loadingDrills } = useFirestoreCollection<import('../../types').BcpDrill>(
    'drills',
    [where('organizationId', '==', user?.organizationId)],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: warRoomSessions, loading: loadingWarRoom } = useFirestoreCollection<import('../../types').WarRoomSession>(
    'war_room_sessions',
    [where('organizationId', '==', user?.organizationId)],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: processes, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
    'business_processes',
    [where('organizationId', '==', user?.organizationId)],
    { enabled: !!user?.organizationId }
  );

  const addStrategy = useCallback(async (data: Record<string, unknown>) => {
    return addStrategyRaw({
      ...data,
      createdAt: serverTimestamp()
    });
  }, [addStrategyRaw]);

  return {
    strategies: strategies || [],
    drills: drills || [],
    warRoomSessions: warRoomSessions || [],
    processes: processes || [],
    loading: loadingStrategies || loadingDrills || loadingWarRoom || loadingProcesses,
    addStrategy,
    removeStrategy,
  };
};
