import { useFirestoreCollection } from '../useFirestore';
import { where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { useCallback } from 'react';
import { ProjectMilestone } from '../../types';

export const useProjectMilestones = (projectId?: string) => {
  const { user } = useAuth();

  const { data: milestones, loading, add: addMilestoneRaw, update: updateMilestone, remove: removeMilestone } = useFirestoreCollection<ProjectMilestone>(
    'project_milestones',
    projectId
      ? [where('organizationId', '==', user?.organizationId || ''), where('projectId', '==', projectId)]
      : [where('organizationId', '==', user?.organizationId || '')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  const addMilestone = useCallback(async (data: Partial<ProjectMilestone>) => {
    return addMilestoneRaw({
      ...data,
      createdAt: serverTimestamp()
    });
  }, [addMilestoneRaw]);

  return {
    milestones: milestones || [],
    loading,
    addMilestone,
    updateMilestone,
    removeMilestone,
  };
};
