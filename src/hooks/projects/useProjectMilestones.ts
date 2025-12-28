import { useFirestoreCollection } from '../useFirestore';
import { where } from 'firebase/firestore';
import { useAuth } from '../useAuth';
import { ProjectMilestone } from '../../types';

export const useProjectMilestones = (projectId?: string) => {
  const { user } = useAuth();

  const { data: milestones, loading, add: addMilestone, update: updateMilestone, remove: removeMilestone } = useFirestoreCollection<ProjectMilestone>(
    'project_milestones',
    projectId 
      ? [where('organizationId', '==', user?.organizationId || 'ignore'), where('projectId', '==', projectId)]
      : [where('organizationId', '==', user?.organizationId || 'ignore')],
    { realtime: true, enabled: !!user?.organizationId }
  );

  return {
    milestones: milestones || [],
    loading,
    addMilestone,
    updateMilestone,
    removeMilestone,
  };
};
