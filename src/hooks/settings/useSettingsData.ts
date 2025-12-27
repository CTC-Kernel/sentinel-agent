import { useFirestoreCollection, useFirestoreDocument } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Organization, SystemLog, UserProfile } from '../../types';

export const useSettingsData = () => {
  const { user } = useAuth();

  const { data: organization, loading: loadingOrg } = useFirestoreDocument<Organization>(
    'organizations',
    user?.organizationId || 'ignore',
    { enabled: !!user?.organizationId }
  );

  const { data: integrations, loading: loadingIntegrations } = useFirestoreCollection(
    'integrations',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: activityLogs, loading: loadingLogs } = useFirestoreCollection<SystemLog>(
    'system_logs',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId, realtime: true }
  );

  const { data: users, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
    'users',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  return {
    organization: organization || null,
    integrations: integrations || [],
    activityLogs: activityLogs || [],
    users: users || [],
    loading: loadingOrg || loadingIntegrations || loadingLogs || loadingUsers,
  };
};
