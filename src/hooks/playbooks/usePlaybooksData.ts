import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Incident, UserProfile } from '../../types';

export const usePlaybooksData = () => {
  const { user } = useAuth();

  const { data: playbooks, loading: loadingPlaybooks } = useFirestoreCollection(
    'incident_playbooks',
    [where('organizationId', '==', user?.organizationId || '')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: incidents, loading: loadingIncidents } = useFirestoreCollection<Incident>(
    'incidents',
    [where('organizationId', '==', user?.organizationId || '')],
    { enabled: !!user?.organizationId }
  );

  const { data: users, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
    'users',
    [where('organizationId', '==', user?.organizationId || '')],
    { enabled: !!user?.organizationId }
  );

  return {
    playbooks: playbooks || [],
    incidents: incidents || [],
    users: users || [],
    loading: loadingPlaybooks || loadingIncidents || loadingUsers,
  };
};
