import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { BusinessProcess } from '../../types';

export const useContinuityActions = () => {
  const { user } = useAuth();

  const { data: strategies, loading: loadingStrategies } = useFirestoreCollection(
    'bcp_strategies',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: drills, loading: loadingDrills } = useFirestoreCollection(
    'drills',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: warRoomSessions, loading: loadingWarRoom } = useFirestoreCollection(
    'war_room_sessions',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: processes, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
    'business_processes',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  return {
    strategies: strategies || [],
    drills: drills || [],
    warRoomSessions: warRoomSessions || [],
    processes: processes || [],
    loading: loadingStrategies || loadingDrills || loadingWarRoom || loadingProcesses,
  };
};
