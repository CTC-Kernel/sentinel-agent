import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { UserProfile, UserGroup, CustomRole } from '../../types';

export const useTeamData = () => {
  const { user } = useAuth();

  const { data: groups, loading: loadingGroups, add: addGroup, update: updateGroup, remove: removeGroup } = useFirestoreCollection<UserGroup>(
    'user_groups',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: roles, loading: loadingRoles, add: addRole, update: updateRole, remove: removeRole } = useFirestoreCollection<CustomRole>(
    'roles',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: users, loading: loadingUsers, update: updateUser } = useFirestoreCollection<UserProfile>(
    'users',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  return {
    groups: groups || [],
    roles: roles || [],
    users: users || [],
    loading: loadingGroups || loadingRoles || loadingUsers,
    addGroup,
    updateGroup,
    removeGroup,
    addRole,
    updateRole,
    removeRole,
    updateUser,
  };
};
