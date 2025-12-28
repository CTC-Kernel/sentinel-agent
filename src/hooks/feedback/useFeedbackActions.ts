import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';

export const useFeedbackActions = () => {
  const { user } = useAuth();

  const { data: feedbacks, loading } = useFirestoreCollection(
    'feedback',
    [where('userId', '==', user?.uid || 'ignore')],
    { enabled: !!user?.uid }
  );

  return {
    feedbacks: feedbacks || [],
    loading,
  };
};
