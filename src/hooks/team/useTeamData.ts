import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { UserProfile } from '../../types';

export const useTeamData = () => {
  const { user } = useAuth();

  const { data: groups, loading: loadingGroups } = useFirestoreCollection(
    'groups',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: roles, loading: loadingRoles } = useFirestoreCollection(
    'roles',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: users, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
    'users',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  return {
    groups: groups || [],
    roles: roles || [],
    users: users || [],
    loading: loadingGroups || loadingRoles || loadingUsers,
  };
};
