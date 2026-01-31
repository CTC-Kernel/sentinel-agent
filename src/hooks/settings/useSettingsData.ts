import { useFirestoreCollection, useFirestoreDocument } from '../useFirestore';
import { where, writeBatch, collection, query, getDocs, doc, updateDoc, UpdateData } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../useAuth';
import { Organization, SystemLog, UserProfile } from '../../types';
import { sanitizeData } from '../../utils/dataSanitizer';
import { ErrorLogger } from '../../services/errorLogger';

export const useSettingsData = () => {
  const { user } = useAuth();

  const { data: organization, loading: loadingOrg } = useFirestoreDocument<Organization>(
    'organizations',
    user?.organizationId || '',
    { enabled: !!user?.organizationId }
  );

  const { data: integrations, loading: loadingIntegrations } = useFirestoreCollection(
    'integrations',
    [where('organizationId', '==', user?.organizationId || '')],
    { enabled: !!user?.organizationId }
  );

  const { data: activityLogs, loading: loadingLogs } = useFirestoreCollection<SystemLog>(
    'system_logs',
    [where('organizationId', '==', user?.organizationId || '')],
    { enabled: !!user?.organizationId, realtime: true }
  );

  const { data: users, loading: loadingUsers, update: updateUser } = useFirestoreCollection<UserProfile>(
    'users',
    [where('organizationId', '==', user?.organizationId || '')],
    { enabled: !!user?.organizationId }
  );

  // Update organization document
  const updateOrganization = async (data: UpdateData<Organization>) => {
    if (!user?.organizationId) throw new Error('No organization ID');
    try {
      const orgRef = doc(db, 'organizations', user.organizationId);
      await updateDoc(orgRef, data);
    } catch (error) {
      ErrorLogger.error(error, 'useSettingsData.updateOrganization');
      throw error;
    }
  };

  // Batch update all users in an organization (e.g., when org name changes)
  const batchUpdateOrgUsers = async (orgId: string, newName: string) => {
    try {
      const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
      const snap = await getDocs(q);

      const chunks = [];
      const CHUNK_SIZE = 450; // Safety margin below 500

      for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
        chunks.push(snap.docs.slice(i, i + CHUNK_SIZE));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.update(d.ref, sanitizeData({ organizationName: newName }));
        });
        await batch.commit();
      }
    } catch (error) {
      ErrorLogger.error(error, 'useSettingsData.batchUpdateOrgUsers');
      throw error;
    }
  };

  return {
    organization: organization || null,
    integrations: integrations || [],
    activityLogs: activityLogs || [],
    users: users || [],
    loading: loadingOrg || loadingIntegrations || loadingLogs || loadingUsers,
    updateOrganization,
    updateUser,
    batchUpdateOrgUsers,
  };
};
