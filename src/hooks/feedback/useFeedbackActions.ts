import { useFirestoreCollection } from '../useFirestore';
import { serverTimestamp } from 'firebase/firestore';
import { useCallback } from 'react';
import { useStore } from '../../store';

export const useFeedbackActions = () => {
  const { user } = useStore();
  const { add: addFeedbackRaw } = useFirestoreCollection(
    'feedback',
    [],
    { enabled: false }  // We only use this hook for writing, not reading
  );

  const addFeedback = useCallback(async (data: Record<string, unknown>) => {
    if (!user?.organizationId) throw new Error('Missing organizationId');
    return addFeedbackRaw({
      ...data,
      organizationId: user.organizationId,
      createdAt: serverTimestamp()
    });
  }, [addFeedbackRaw, user?.organizationId]);

  return {
    addFeedback,
  };
};
