import { useFirestoreCollection } from '../useFirestore';
import { serverTimestamp } from 'firebase/firestore';
import { useCallback } from 'react';

export const useFeedbackActions = () => {
  const { add: addFeedbackRaw } = useFirestoreCollection(
    'feedback',
    [],
    { enabled: false }  // We only use this hook for writing, not reading
  );

  const addFeedback = useCallback(async (data: Record<string, unknown>) => {
    return addFeedbackRaw({
      ...data,
      createdAt: serverTimestamp()
    });
  }, [addFeedbackRaw]);

  return {
    addFeedback,
  };
};
