import { useFirestoreCollection } from '../useFirestore';
import { where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { useCallback } from 'react';
import { UserProfile, UserGroup, CustomRole } from '../../types';
import { AuditLogService } from '../../services/auditLogService';

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

  const { data: users, loading: loadingUsers, update: updateUserRaw } = useFirestoreCollection<UserProfile>(
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

  const updateUser = useCallback(async (id: string, data: Partial<UserProfile>) => {
    // Find absolute user to get previous state
    const targetUser = users.find(u => u.uid === id);
    const oldRole = targetUser?.role;

    // Perform update
    await updateUserRaw(id, data);

    // Audit Log
    if (user && user.organizationId && targetUser) {
      try {
        const adminUser = {
          id: user.uid,
          name: user.displayName || user.email || 'Unknown',
          email: user.email || ''
        };

        if (data.role && data.role !== oldRole) {
          await AuditLogService.logPermissionChange(
            user.organizationId,
            adminUser,
            id,
            targetUser.displayName || targetUser.email || 'Unknown',
            oldRole as string,
            data.role as string
          );
        } else {
          await AuditLogService.logUpdate(
            user.organizationId,
            adminUser,
            'user',
            id,
            targetUser as unknown as Record<string, unknown>,
            data as unknown as Record<string, unknown>
          );
        }
      } catch (error) {
        console.error("Failed to log audit event", error);
      }
    }
  }, [updateUserRaw, users, user]);

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
