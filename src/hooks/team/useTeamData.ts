import { useFirestoreCollection } from '../useFirestore';
import { where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { useCallback } from 'react';
import { UserProfile, UserGroup, CustomRole } from '../../types';

export const useTeamData = (enabled = true) => {
  const { user, claimsSynced } = useAuth();

  const { data: groups, loading: loadingGroups, add: addGroupRaw, update: updateGroupRaw, remove: removeGroup } = useFirestoreCollection<UserGroup>(
    'user_groups',
    [where('organizationId', '==', user?.organizationId || '')],
    { realtime: true, enabled: !!user?.organizationId && claimsSynced && enabled }
  );

  const { data: roles, loading: loadingRoles, add: addRoleRaw, update: updateRoleRaw, remove: removeRole } = useFirestoreCollection<CustomRole>(
    'roles',
    [where('organizationId', '==', user?.organizationId || '')],
    { realtime: true, enabled: !!user?.organizationId && claimsSynced && enabled }
  );

  const { data: users, loading: loadingUsers, update: updateUser } = useFirestoreCollection<UserProfile>(
    'users',
    [where('organizationId', '==', user?.organizationId || '')],
    { realtime: true, enabled: !!user?.organizationId && claimsSynced && enabled }
  );

  const addRole = useCallback(async (data: Partial<CustomRole>) => {
    return addRoleRaw({
      ...data,
      createdAt: serverTimestamp()
    });
  }, [addRoleRaw]);

  const updateRole = useCallback(async (id: string, data: Partial<CustomRole>) => {
    return updateRoleRaw(id, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }, [updateRoleRaw]);

  const addGroup = useCallback(async (data: Partial<UserGroup>) => {
    return addGroupRaw({
      ...data,
      createdAt: serverTimestamp()
    });
  }, [addGroupRaw]);

  const updateGroup = useCallback(async (id: string, data: Partial<UserGroup>) => {
    return updateGroupRaw(id, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }, [updateGroupRaw]);

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
