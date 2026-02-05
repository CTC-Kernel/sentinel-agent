/**
 * useTrainingAssignment Hook
 *
 * Provides training assignment operations with state management.
 * Part of the Training & Awareness module (NIS2 Art. 21.2g).
 *
 * @module hooks/training/useTrainingAssignment
 */

import { useState, useCallback } from 'react';
import { useAuth } from '../useAuth';
import { TrainingService } from '../../services/TrainingService';
import { useTrainingStore, useCourses } from '../../stores/trainingStore';
import { ErrorLogger } from '../../services/errorLogger';
import { toast } from '@/lib/toast';
import { useStore } from '../../store';
import type { TrainingCourse, TrainingAssignment } from '../../types/training';
import type { UserProfile } from '../../types';

// ============================================================================
// Types
// ============================================================================

interface AssignmentPreview {
 course: TrainingCourse;
 users: UserProfile[];
 dueDate: Date;
 totalAssignments: number;
}

interface UseTrainingAssignmentReturn {
 // State
 isLoading: boolean;
 error: string | null;
 preview: AssignmentPreview | null;

 // Actions
 assignTraining: (
 courseId: string,
 userIds: string[],
 dueDate: Date,
 campaignId?: string
 ) => Promise<string[]>;
 generatePreview: (
 courseId: string,
 users: UserProfile[],
 dueDate: Date
 ) => void;
 clearPreview: () => void;
 deleteAssignment: (assignmentId: string) => Promise<void>;

 // Data
 courses: TrainingCourse[];
 getUserAssignments: (userId: string) => TrainingAssignment[];
}

// ============================================================================
// Hook
// ============================================================================

export const useTrainingAssignment = (): UseTrainingAssignmentReturn => {
 const { user } = useAuth();
 const { t } = useStore();
 const courses = useCourses();
 const assignments = useTrainingStore((s) => s.assignments);
 const addAssignments = useTrainingStore((s) => s.addAssignments);
 const removeAssignment = useTrainingStore((s) => s.removeAssignment);

 // Local state
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [preview, setPreview] = useState<AssignmentPreview | null>(null);

 /**
 * Generate a preview of the assignment
 */
 const generatePreview = useCallback((
 courseId: string,
 users: UserProfile[],
 dueDate: Date
 ) => {
 const course = courses.find((c) => c.id === courseId);
 if (!course) {
 setError(t('training.errors.courseNotFound'));
 return;
 }

 setPreview({
 course,
 users,
 dueDate,
 totalAssignments: users.length,
 });
 setError(null);
 }, [courses, t]);

 /**
 * Clear the preview
 */
 const clearPreview = useCallback(() => {
 setPreview(null);
 setError(null);
 }, []);

 /**
 * Assign training to one or more users
 */
 const assignTraining = useCallback(async (
 courseId: string,
 userIds: string[],
 dueDate: Date,
 campaignId?: string
 ): Promise<string[]> => {
 if (!user) {
 throw new Error('User not authenticated');
 }

 setIsLoading(true);
 setError(null);

 try {
 let assignmentIds: string[];

 if (userIds.length === 1) {
 // Single assignment
 const id = await TrainingService.assignTraining(
 {
 userId: userIds[0],
 courseId,
 dueDate,
 campaignId,
 },
 user
 );
 assignmentIds = [id];
 } else {
 // Batch assignment
 assignmentIds = await TrainingService.batchAssignTraining(
 userIds,
 courseId,
 dueDate,
 user,
 campaignId
 );
 }

 // Fetch the created assignments and add to store
 const newAssignments = await TrainingService.getAllAssignments(
 user.organizationId!
 );
 const createdAssignments = newAssignments.filter((a) =>
 assignmentIds.includes(a.id)
 );
 addAssignments(createdAssignments);

 // Success toast
 toast.success(
 userIds.length === 1
 ? t('training.success.assignmentCreated')
 : t('training.success.assignmentsCreated', { count: userIds.length })
 );

 // Clear preview
 clearPreview();

 return assignmentIds;
 } catch (err) {
 const message = err instanceof Error ? err.message : t('training.errors.assignFailed');
 setError(message);
 ErrorLogger.error(err, 'useTrainingAssignment.assignTraining', {
 courseId,
 userCount: userIds.length,
 });
 toast.error(message);
 throw err;
 } finally {
 setIsLoading(false);
 }
 }, [user, t, addAssignments, clearPreview]);

 /**
 * Delete an assignment
 */
 const deleteAssignment = useCallback(async (assignmentId: string) => {
 if (!user) {
 throw new Error('User not authenticated');
 }

 setIsLoading(true);
 setError(null);

 try {
 await TrainingService.deleteAssignment(
 user.organizationId!,
 assignmentId,
 user
 );

 // Remove from store
 removeAssignment(assignmentId);

 toast.success(t('training.success.assignmentDeleted'));
 } catch (err) {
 const message = err instanceof Error ? err.message : t('training.errors.deleteFailed');
 setError(message);
 ErrorLogger.error(err, 'useTrainingAssignment.deleteAssignment', {
 assignmentId,
 });
 toast.error(message);
 throw err;
 } finally {
 setIsLoading(false);
 }
 }, [user, t, removeAssignment]);

 /**
 * Get assignments for a specific user
 */
 const getUserAssignments = useCallback((userId: string): TrainingAssignment[] => {
 return assignments.filter((a) => a.userId === userId);
 }, [assignments]);

 return {
 isLoading,
 error,
 preview,
 assignTraining,
 generatePreview,
 clearPreview,
 deleteAssignment,
 courses,
 getUserAssignments,
 };
};

export default useTrainingAssignment;
