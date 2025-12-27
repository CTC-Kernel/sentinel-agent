import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { Supplier, SupplierAssessment, Questionnaire, UserProfile } from '../../types';

export const useSuppliersActions = () => {
  const { user } = useAuth();

  const { data: suppliers, loading: loadingSuppliers } = useFirestoreCollection<Supplier>(
    'suppliers',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: assessments, loading: loadingAssessments } = useFirestoreCollection<SupplierAssessment>(
    'supplier_assessments',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const { data: questionnaires, loading: loadingQuestionnaires } = useFirestoreCollection<Questionnaire>(
    'questionnaires',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  const { data: users, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
    'users',
    [where('organizationId', '==', user?.organizationId || 'ignore')],
    { enabled: !!user?.organizationId }
  );

  return {
    suppliers: suppliers || [],
    assessments: assessments || [],
    questionnaires: questionnaires || [],
    users: users || [],
    loading: loadingSuppliers || loadingAssessments || loadingQuestionnaires || loadingUsers,
  };
};
