/**
 * Training Store Tests
 * Story NIS2-TRN-002: Zustand Store Training
 * Target coverage: >80%
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useTrainingStore,
  trainingStoreActions,
  useCourses,
  useFilteredCourses,
  useAssignments,
  useUserAssignments,
  useFilteredAssignments,
  useOverdueAssignments,
  useCampaigns,
  useFilteredCampaigns,
  useActiveCampaigns,
  useTrainingStats,
  useCourseFilters,
  useAssignmentFilters,
  useTrainingUI,
  useTrainingLoading,
  useTrainingError,
  useSelectedCourse,
  useSelectedAssignment,
  useSelectedCampaign,
} from '../trainingStore';
import type {
  TrainingCourse,
  TrainingAssignment,
  TrainingCampaign,
  TrainingStats,
} from '../../types/training';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Mock Data
// ============================================================================

const mockTimestamp = {
  toDate: () => new Date('2026-01-27'),
  seconds: 1769558400,
  nanoseconds: 0,
} as Timestamp;

const mockCourses: TrainingCourse[] = [
  {
    id: 'course-1',
    organizationId: 'org-1',
    title: 'Security Basics',
    description: 'Introduction to cybersecurity',
    category: 'security',
    source: 'internal',
    duration: 60,
    isRequired: true,
    targetRoles: ['user'],
    content: { type: 'video', url: 'https://example.com/video1' },
    frameworkMappings: { nis2: ['21.2g'] },
    createdAt: mockTimestamp,
    createdBy: 'admin-1',
    updatedAt: mockTimestamp,
    updatedBy: 'admin-1',
    isArchived: false,
  },
  {
    id: 'course-2',
    organizationId: 'org-1',
    title: 'RGPD Awareness',
    description: 'GDPR compliance training',
    category: 'compliance',
    source: 'cnil',
    duration: 45,
    isRequired: false,
    targetRoles: ['user', 'manager'],
    content: { type: 'document', url: 'https://example.com/doc1' },
    frameworkMappings: { rgpd: ['art.39'] },
    createdAt: mockTimestamp,
    createdBy: 'admin-1',
    updatedAt: mockTimestamp,
    updatedBy: 'admin-1',
    isArchived: false,
  },
  {
    id: 'course-3',
    organizationId: 'org-1',
    title: 'Phishing Prevention',
    description: 'How to detect phishing attacks',
    category: 'awareness',
    source: 'anssi',
    duration: 30,
    isRequired: true,
    targetRoles: ['user'],
    content: { type: 'quiz', quizId: 'quiz-1' },
    frameworkMappings: { nis2: ['21.2g'], iso27001: ['A.7.2.2'] },
    createdAt: mockTimestamp,
    createdBy: 'admin-1',
    updatedAt: mockTimestamp,
    updatedBy: 'admin-1',
    isArchived: false,
  },
];

const mockAssignments: TrainingAssignment[] = [
  {
    id: 'assign-1',
    organizationId: 'org-1',
    userId: 'user-1',
    courseId: 'course-1',
    assignedBy: 'admin-1',
    assignedAt: mockTimestamp,
    dueDate: mockTimestamp,
    status: 'assigned',
    remindersSent: 0,
  },
  {
    id: 'assign-2',
    organizationId: 'org-1',
    userId: 'user-1',
    courseId: 'course-2',
    assignedBy: 'admin-1',
    assignedAt: mockTimestamp,
    dueDate: mockTimestamp,
    status: 'completed',
    completedAt: mockTimestamp,
    score: 85,
    remindersSent: 0,
  },
  {
    id: 'assign-3',
    organizationId: 'org-1',
    userId: 'user-2',
    courseId: 'course-1',
    assignedBy: 'admin-1',
    assignedAt: mockTimestamp,
    dueDate: mockTimestamp,
    status: 'overdue',
    remindersSent: 2,
  },
];

const mockCampaigns: TrainingCampaign[] = [
  {
    id: 'campaign-1',
    organizationId: 'org-1',
    name: 'Q1 Security Training',
    description: 'Quarterly security training',
    startDate: mockTimestamp,
    endDate: mockTimestamp,
    scope: 'all',
    courseIds: ['course-1', 'course-3'],
    status: 'active',
    progress: { totalAssignments: 50, completed: 30, overdue: 5 },
    createdAt: mockTimestamp,
    createdBy: 'admin-1',
  },
  {
    id: 'campaign-2',
    organizationId: 'org-1',
    name: 'RGPD Campaign',
    startDate: mockTimestamp,
    endDate: mockTimestamp,
    scope: 'department',
    scopeFilter: ['IT'],
    courseIds: ['course-2'],
    status: 'draft',
    progress: { totalAssignments: 0, completed: 0, overdue: 0 },
    createdAt: mockTimestamp,
    createdBy: 'admin-1',
  },
];

const mockStats: TrainingStats = {
  total: 100,
  completed: 75,
  overdue: 10,
  inProgress: 15,
  completionRate: 75,
};

// ============================================================================
// Tests
// ============================================================================

describe('trainingStore', () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      trainingStoreActions.reset();
    });
  });

  // ==========================================================================
  // Course Actions
  // ==========================================================================

  describe('Course Actions', () => {
    it('should set courses', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
      });

      const { result } = renderHook(() => useCourses());
      expect(result.current).toHaveLength(3);
      expect(result.current[0].title).toBe('Security Basics');
    });

    it('should add a course', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.addCourse({
          ...mockCourses[0],
          id: 'course-4',
          title: 'New Course',
        });
      });

      const { result } = renderHook(() => useCourses());
      expect(result.current).toHaveLength(4);
    });

    it('should update a course', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.updateCourse('course-1', { title: 'Updated Title' });
      });

      const { result } = renderHook(() => useCourses());
      const course = result.current.find((c) => c.id === 'course-1');
      expect(course?.title).toBe('Updated Title');
    });

    it('should remove a course', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.removeCourse('course-1');
      });

      const { result } = renderHook(() => useCourses());
      expect(result.current).toHaveLength(2);
      expect(result.current.find((c) => c.id === 'course-1')).toBeUndefined();
    });
  });

  // ==========================================================================
  // Assignment Actions
  // ==========================================================================

  describe('Assignment Actions', () => {
    it('should set assignments', () => {
      act(() => {
        trainingStoreActions.setAssignments(mockAssignments);
      });

      const { result } = renderHook(() => useAssignments());
      expect(result.current).toHaveLength(3);
    });

    it('should add an assignment', () => {
      act(() => {
        trainingStoreActions.addAssignment(mockAssignments[0]);
      });

      const { result } = renderHook(() => useAssignments());
      expect(result.current).toHaveLength(1);
    });

    it('should add multiple assignments', () => {
      act(() => {
        trainingStoreActions.addAssignments(mockAssignments);
      });

      const { result } = renderHook(() => useAssignments());
      expect(result.current).toHaveLength(3);
    });

    it('should update an assignment', () => {
      act(() => {
        trainingStoreActions.setAssignments(mockAssignments);
        trainingStoreActions.updateAssignment('assign-1', { status: 'in_progress' });
      });

      const { result } = renderHook(() => useAssignments());
      const assignment = result.current.find((a) => a.id === 'assign-1');
      expect(assignment?.status).toBe('in_progress');
    });

    it('should remove an assignment', () => {
      act(() => {
        trainingStoreActions.setAssignments(mockAssignments);
        trainingStoreActions.removeAssignment('assign-1');
      });

      const { result } = renderHook(() => useAssignments());
      expect(result.current).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Campaign Actions
  // ==========================================================================

  describe('Campaign Actions', () => {
    it('should set campaigns', () => {
      act(() => {
        trainingStoreActions.setCampaigns(mockCampaigns);
      });

      const { result } = renderHook(() => useCampaigns());
      expect(result.current).toHaveLength(2);
    });

    it('should add a campaign', () => {
      act(() => {
        trainingStoreActions.addCampaign(mockCampaigns[0]);
      });

      const { result } = renderHook(() => useCampaigns());
      expect(result.current).toHaveLength(1);
    });

    it('should update a campaign', () => {
      act(() => {
        trainingStoreActions.setCampaigns(mockCampaigns);
        trainingStoreActions.updateCampaign('campaign-1', { status: 'completed' });
      });

      const { result } = renderHook(() => useCampaigns());
      const campaign = result.current.find((c) => c.id === 'campaign-1');
      expect(campaign?.status).toBe('completed');
    });

    it('should remove a campaign', () => {
      act(() => {
        trainingStoreActions.setCampaigns(mockCampaigns);
        trainingStoreActions.removeCampaign('campaign-1');
      });

      const { result } = renderHook(() => useCampaigns());
      expect(result.current).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Stats Actions
  // ==========================================================================

  describe('Stats Actions', () => {
    it('should set stats', () => {
      act(() => {
        trainingStoreActions.setStats(mockStats);
      });

      const { result } = renderHook(() => useTrainingStats());
      expect(result.current?.completionRate).toBe(75);
    });

    it('should clear stats', () => {
      act(() => {
        trainingStoreActions.setStats(mockStats);
        trainingStoreActions.clearStats();
      });

      const { result } = renderHook(() => useTrainingStats());
      expect(result.current).toBeNull();
    });
  });

  // ==========================================================================
  // Filter Selectors
  // ==========================================================================

  describe('Filter Selectors', () => {
    it('should filter courses by category', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.setCourseFilters({ category: 'security' });
      });

      const { result } = renderHook(() => useFilteredCourses());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].category).toBe('security');
    });

    it('should filter courses by source', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.setCourseFilters({ source: 'anssi' });
      });

      const { result } = renderHook(() => useFilteredCourses());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].source).toBe('anssi');
    });

    it('should filter courses by required only', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.setCourseFilters({ showRequiredOnly: true });
      });

      const { result } = renderHook(() => useFilteredCourses());
      expect(result.current).toHaveLength(2);
      result.current.forEach((c) => expect(c.isRequired).toBe(true));
    });

    it('should filter courses by search query', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.setCourseFilters({ searchQuery: 'phishing' });
      });

      const { result } = renderHook(() => useFilteredCourses());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].title).toBe('Phishing Prevention');
    });

    it('should filter assignments by status', () => {
      act(() => {
        trainingStoreActions.setAssignments(mockAssignments);
        trainingStoreActions.setAssignmentFilters({ status: 'completed' });
      });

      const { result } = renderHook(() => useFilteredAssignments());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].status).toBe('completed');
    });

    it('should filter assignments by courseId', () => {
      act(() => {
        trainingStoreActions.setAssignments(mockAssignments);
        trainingStoreActions.setAssignmentFilters({ courseId: 'course-1' });
      });

      const { result } = renderHook(() => useFilteredAssignments());
      expect(result.current).toHaveLength(2);
    });

    it('should filter campaigns by status', () => {
      act(() => {
        trainingStoreActions.setCampaigns(mockCampaigns);
        trainingStoreActions.setCampaignFilters({ status: 'active' });
      });

      const { result } = renderHook(() => useFilteredCampaigns());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].status).toBe('active');
    });

    it('should filter campaigns by search query', () => {
      act(() => {
        trainingStoreActions.setCampaigns(mockCampaigns);
        trainingStoreActions.setCampaignFilters({ searchQuery: 'RGPD' });
      });

      const { result } = renderHook(() => useFilteredCampaigns());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('RGPD Campaign');
    });

    it('should reset all filters', () => {
      act(() => {
        trainingStoreActions.setCourseFilters({ category: 'security' });
        trainingStoreActions.setAssignmentFilters({ status: 'completed' });
        trainingStoreActions.resetFilters();
      });

      const { result: courseFilters } = renderHook(() => useCourseFilters());
      const { result: assignmentFilters } = renderHook(() => useAssignmentFilters());

      expect(courseFilters.current.category).toBe('all');
      expect(assignmentFilters.current.status).toBe('all');
    });
  });

  // ==========================================================================
  // User-specific Selectors
  // ==========================================================================

  describe('User-specific Selectors', () => {
    it('should get assignments for a specific user', () => {
      act(() => {
        trainingStoreActions.setAssignments(mockAssignments);
      });

      const { result } = renderHook(() => useUserAssignments('user-1'));
      expect(result.current).toHaveLength(2);
      result.current.forEach((a) => expect(a.userId).toBe('user-1'));
    });

    it('should get overdue assignments', () => {
      act(() => {
        trainingStoreActions.setAssignments(mockAssignments);
      });

      const { result } = renderHook(() => useOverdueAssignments());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].status).toBe('overdue');
    });

    it('should get active campaigns', () => {
      act(() => {
        trainingStoreActions.setCampaigns(mockCampaigns);
      });

      const { result } = renderHook(() => useActiveCampaigns());
      expect(result.current).toHaveLength(1);
      expect(result.current[0].status).toBe('active');
    });
  });

  // ==========================================================================
  // UI State
  // ==========================================================================

  describe('UI State', () => {
    it('should select a course', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.selectCourse('course-1');
      });

      const { result } = renderHook(() => useSelectedCourse());
      expect(result.current?.id).toBe('course-1');
    });

    it('should select an assignment', () => {
      act(() => {
        trainingStoreActions.setAssignments(mockAssignments);
        trainingStoreActions.selectAssignment('assign-1');
      });

      const { result } = renderHook(() => useSelectedAssignment());
      expect(result.current?.id).toBe('assign-1');
    });

    it('should select a campaign', () => {
      act(() => {
        trainingStoreActions.setCampaigns(mockCampaigns);
        trainingStoreActions.selectCampaign('campaign-1');
      });

      const { result } = renderHook(() => useSelectedCampaign());
      expect(result.current?.id).toBe('campaign-1');
    });

    it('should set loading state', () => {
      act(() => {
        trainingStoreActions.setLoading(true);
      });

      const { result } = renderHook(() => useTrainingLoading());
      expect(result.current).toBe(true);
    });

    it('should set error state', () => {
      act(() => {
        trainingStoreActions.setError('Test error');
      });

      const { result } = renderHook(() => useTrainingError());
      expect(result.current).toBe('Test error');
    });

    it('should return null for selected course when not set', () => {
      const { result } = renderHook(() => useSelectedCourse());
      expect(result.current).toBeNull();
    });

    it('should return null for selected course when course not found', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.selectCourse('nonexistent');
      });

      const { result } = renderHook(() => useSelectedCourse());
      expect(result.current).toBeNull();
    });
  });

  // ==========================================================================
  // Global Actions
  // ==========================================================================

  describe('Global Actions', () => {
    it('should reset the store', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
        trainingStoreActions.setAssignments(mockAssignments);
        trainingStoreActions.setCampaigns(mockCampaigns);
        trainingStoreActions.setStats(mockStats);
        trainingStoreActions.setLoading(true);
        trainingStoreActions.setError('Error');
        trainingStoreActions.reset();
      });

      const { result: courses } = renderHook(() => useCourses());
      const { result: assignments } = renderHook(() => useAssignments());
      const { result: campaigns } = renderHook(() => useCampaigns());
      const { result: stats } = renderHook(() => useTrainingStats());
      const { result: ui } = renderHook(() => useTrainingUI());

      expect(courses.current).toHaveLength(0);
      expect(assignments.current).toHaveLength(0);
      expect(campaigns.current).toHaveLength(0);
      expect(stats.current).toBeNull();
      expect(ui.current.isLoading).toBe(false);
      expect(ui.current.error).toBeNull();
    });
  });

  // ==========================================================================
  // Direct Store Access
  // ==========================================================================

  describe('Direct Store Access', () => {
    it('should access store state directly', () => {
      act(() => {
        trainingStoreActions.setCourses(mockCourses);
      });

      const state = useTrainingStore.getState();
      expect(state.courses).toHaveLength(3);
    });

    it('should subscribe to store changes', () => {
      let callCount = 0;

      const unsubscribe = useTrainingStore.subscribe(
        (state) => state.courses,
        () => {
          callCount++;
        }
      );

      act(() => {
        trainingStoreActions.setCourses(mockCourses);
      });

      expect(callCount).toBe(1);
      unsubscribe();
    });
  });
});
