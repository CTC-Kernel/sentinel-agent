import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Incident } from '../../types';

export const useIncidentsActions = () => {
  const { user } = useAuth();

  const { data: incidents, loading, add: addIncident, update: updateIncident, remove: removeIncident } = useFirestoreCollection<Incident>(
    'incidents',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  return {
    incidents: incidents || [],
    loading,
    addIncident,
    updateIncident,
    removeIncident,
  };
};
