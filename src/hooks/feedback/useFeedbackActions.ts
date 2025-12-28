import { useFirestoreCollection } from '../useFirestore';

export const useFeedbackActions = () => {
  const { add: addFeedback } = useFirestoreCollection(
    'feedback',
    [],
    { enabled: false }  // We only use this hook for writing, not reading
  );

  return {
    addFeedback,
  };
};
