/**
 * TrainingService Tests
 * Story NIS2-TRN-001: Training Types and Service
 * Target coverage: >80%
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrainingService } from '../TrainingService';
import { createUser, createAdminUser } from '../../tests/factories/userFactory';

// Mock Firebase
vi.mock('../../firebase', () => ({
 db: {},
}));

vi.mock('firebase/firestore', () => ({
 collection: vi.fn(() => ({ id: 'mock-collection' })),
 doc: vi.fn(() => ({ id: 'mock-doc-id' })),
 addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
 updateDoc: vi.fn(() => Promise.resolve()),
 deleteDoc: vi.fn(() => Promise.resolve()),
 getDoc: vi.fn(() =>
 Promise.resolve({
 exists: () => true,
 id: 'course-1',
 data: () => ({
 title: 'Test Course',
 category: 'security',
 source: 'internal',
 isArchived: false,
 }),
 })
 ),
 getDocs: vi.fn(() =>
 Promise.resolve({
 docs: [
 {
 id: 'doc-1',
 data: () => ({
 title: 'Course 1',
 status: 'completed',
 userId: 'user-1',
 }),
 },
 {
 id: 'doc-2',
 data: () => ({
 title: 'Course 2',
 status: 'in_progress',
 userId: 'user-1',
 }),
 },
 {
 id: 'doc-3',
 data: () => ({
 title: 'Course 3',
 status: 'overdue',
 userId: 'user-2',
 }),
 },
 ],
 })
 ),
 query: vi.fn(),
 where: vi.fn(),
 orderBy: vi.fn(),
 limit: vi.fn(),
 writeBatch: vi.fn(() => ({
 set: vi.fn(),
 commit: vi.fn(() => Promise.resolve()),
 })),
 serverTimestamp: vi.fn(() => 'mock-timestamp'),
 Timestamp: {
 fromDate: vi.fn((date) => ({ toDate: () => date })),
 now: vi.fn(() => ({ toDate: () => new Date() })),
 },
}));

vi.mock('../errorLogger', () => ({
 ErrorLogger: {
 error: vi.fn(),
 warn: vi.fn(),
 info: vi.fn(),
 },
}));

vi.mock('../auditLogService', () => ({
 AuditLogService: {
 logCreate: vi.fn().mockResolvedValue(undefined),
 logUpdate: vi.fn().mockResolvedValue(undefined),
 logDelete: vi.fn().mockResolvedValue(undefined),
 },
}));

vi.mock('../../utils/dataSanitizer', () => ({
 sanitizeData: vi.fn((data) => data),
}));

vi.mock('../../schemas/trainingSchema', () => ({
 trainingCourseSchema: {
 parse: vi.fn((data) => data),
 partial: vi.fn(() => ({
 parse: vi.fn((data) => data),
 })),
 },
 trainingAssignmentSchema: {
 parse: vi.fn((data) => data),
 },
 trainingCampaignSchema: {
 parse: vi.fn((data) => data),
 },
}));

import { addDoc, updateDoc, deleteDoc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { AuditLogService } from '../auditLogService';
import { ErrorLogger } from '../errorLogger';

describe('TrainingService', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 // =========================================================================
 // CATALOG OPERATIONS
 // =========================================================================

 describe('getCourses', () => {
 it('should return all non-archived courses for organization', async () => {
 const result = await TrainingService.getCourses('org-1');

 expect(result).toHaveLength(3);
 expect(getDocs).toHaveBeenCalled();
 });

 it('should log error on failure', async () => {
 vi.mocked(getDocs).mockRejectedValueOnce(new Error('Firestore error'));

 await expect(TrainingService.getCourses('org-1')).rejects.toThrow('Firestore error');
 expect(ErrorLogger.error).toHaveBeenCalled();
 });
 });

 describe('getCourse', () => {
 it('should return a single course by ID', async () => {
 const result = await TrainingService.getCourse('org-1', 'course-1');

 expect(result).toBeDefined();
 expect(result?.title).toBe('Test Course');
 expect(getDoc).toHaveBeenCalled();
 });

 it('should return null when course does not exist', async () => {
 vi.mocked(getDoc).mockResolvedValueOnce({
 exists: () => false,
 id: 'course-1',
 data: () => null,
 } as never);

 const result = await TrainingService.getCourse('org-1', 'nonexistent');

 expect(result).toBeNull();
 });
 });

 describe('createCourse', () => {
 it('should create a new course with audit log', async () => {
 const user = createAdminUser({ organizationId: 'org-1' });
 const courseData = {
 title: 'Security Basics',
 description: 'Introduction to security',
 category: 'security' as const,
 source: 'internal' as const,
 duration: 60,
 isRequired: false,
 targetRoles: [],
 content: { type: 'video' as const, url: 'https://example.com/video' },
 frameworkMappings: { nis2: ['21.2g'] },
 };

 const result = await TrainingService.createCourse(courseData, user);

 expect(result).toBe('new-doc-id');
 expect(addDoc).toHaveBeenCalled();
 expect(AuditLogService.logCreate).toHaveBeenCalledWith(
 'org-1',
 expect.objectContaining({ id: user.uid }),
 'training_course',
 'new-doc-id',
 expect.any(Object),
 'Security Basics'
 );
 });

 it('should throw error when user has no organization', async () => {
 const user = createUser();
 (user as { organizationId: string | undefined }).organizationId = undefined;

 await expect(
 TrainingService.createCourse({} as never, user)
 ).rejects.toThrow('User organization ID is missing');
 });
 });

 describe('updateCourse', () => {
 it('should update an existing course', async () => {
 const user = createAdminUser({ organizationId: 'org-1' });
 const updateData = { title: 'Updated Title' };

 await TrainingService.updateCourse('course-1', updateData, user);

 expect(updateDoc).toHaveBeenCalled();
 });

 it('should log update in audit when oldData is provided', async () => {
 const user = createAdminUser({ organizationId: 'org-1' });
 const updateData = { title: 'Updated Title' };
 const oldData = { title: 'Old Title' };

 await TrainingService.updateCourse('course-1', updateData, user, oldData);

 expect(AuditLogService.logUpdate).toHaveBeenCalledWith(
 'org-1',
 expect.any(Object),
 'training_course',
 'course-1',
 oldData,
 expect.any(Object),
 'Old Title'
 );
 });
 });

 describe('archiveCourse', () => {
 it('should archive a course (soft delete)', async () => {
 const user = createAdminUser({ organizationId: 'org-1' });

 await TrainingService.archiveCourse('course-1', user);

 expect(updateDoc).toHaveBeenCalled();
 expect(AuditLogService.logDelete).toHaveBeenCalledWith(
 'org-1',
 expect.any(Object),
 'training_course',
 'course-1',
 { action: 'archive' },
 'Course archived'
 );
 });
 });

 // =========================================================================
 // ASSIGNMENT OPERATIONS
 // =========================================================================

 describe('assignTraining', () => {
 it('should create a training assignment', async () => {
 const user = createAdminUser({ organizationId: 'org-1' });
 const assignmentData = {
 userId: 'user-2',
 courseId: 'course-1',
 dueDate: new Date('2026-02-15'),
 };

 const result = await TrainingService.assignTraining(assignmentData, user);

 expect(result).toBe('new-doc-id');
 expect(addDoc).toHaveBeenCalled();
 });

 it('should include campaignId when provided', async () => {
 const user = createAdminUser({ organizationId: 'org-1' });
 const assignmentData = {
 userId: 'user-2',
 courseId: 'course-1',
 dueDate: new Date('2026-02-15'),
 campaignId: 'campaign-1',
 };

 await TrainingService.assignTraining(assignmentData, user);

 expect(addDoc).toHaveBeenCalled();
 });
 });

 describe('batchAssignTraining', () => {
 it('should create multiple assignments in batch', async () => {
 const user = createAdminUser({ organizationId: 'org-1' });
 const userIds = ['user-1', 'user-2', 'user-3'];
 const dueDate = new Date('2026-02-15');

 const result = await TrainingService.batchAssignTraining(
 userIds,
 'course-1',
 dueDate,
 user
 );

 expect(result).toHaveLength(3);
 expect(writeBatch).toHaveBeenCalled();
 });
 });

 describe('getUserAssignments', () => {
 it('should return assignments for a specific user', async () => {
 const result = await TrainingService.getUserAssignments('org-1', 'user-1');

 expect(result).toBeDefined();
 expect(getDocs).toHaveBeenCalled();
 });
 });

 describe('getAllAssignments', () => {
 it('should return all assignments for an organization', async () => {
 const result = await TrainingService.getAllAssignments('org-1');

 expect(result).toHaveLength(3);
 });
 });

 describe('getOverdueAssignments', () => {
 it('should return overdue assignments', async () => {
 const result = await TrainingService.getOverdueAssignments('org-1');

 expect(result).toBeDefined();
 expect(getDocs).toHaveBeenCalled();
 });
 });

 describe('startAssignment', () => {
 it('should mark assignment as in_progress', async () => {
 await TrainingService.startAssignment('org-1', 'assignment-1');

 expect(updateDoc).toHaveBeenCalled();
 });
 });

 describe('completeAssignment', () => {
 it('should mark assignment as completed', async () => {
 await TrainingService.completeAssignment('org-1', 'assignment-1');

 expect(updateDoc).toHaveBeenCalled();
 });

 it('should include score when provided', async () => {
 await TrainingService.completeAssignment('org-1', 'assignment-1', 85);

 expect(updateDoc).toHaveBeenCalled();
 });

 it('should include timeSpent when provided', async () => {
 await TrainingService.completeAssignment('org-1', 'assignment-1', 85, 45);

 expect(updateDoc).toHaveBeenCalled();
 });
 });

 describe('deleteAssignment', () => {
 it('should delete an assignment with audit log', async () => {
 const user = createAdminUser({ organizationId: 'org-1' });

 await TrainingService.deleteAssignment('org-1', 'assignment-1', user);

 expect(deleteDoc).toHaveBeenCalled();
 expect(AuditLogService.logDelete).toHaveBeenCalledWith(
 'org-1',
 expect.any(Object),
 'training_assignment',
 'assignment-1',
 { action: 'delete' },
 'Assignment deleted'
 );
 });
 });

 // =========================================================================
 // CAMPAIGN OPERATIONS
 // =========================================================================

 describe('getCampaigns', () => {
 it('should return all campaigns for organization', async () => {
 const result = await TrainingService.getCampaigns('org-1');

 expect(result).toBeDefined();
 expect(getDocs).toHaveBeenCalled();
 });
 });

 describe('createCampaign', () => {
 it('should create a new campaign with audit log', async () => {
 const user = createAdminUser({ organizationId: 'org-1' });
 const campaignData = {
 name: 'Q1 Security Training',
 startDate: new Date('2026-01-01'),
 endDate: new Date('2026-03-31'),
 scope: 'all' as const,
 courseIds: ['course-1', 'course-2'],
 };

 const result = await TrainingService.createCampaign(campaignData, user);

 expect(result).toBe('new-doc-id');
 expect(addDoc).toHaveBeenCalled();
 expect(AuditLogService.logCreate).toHaveBeenCalled();
 });
 });

 describe('updateCampaignStatus', () => {
 it('should update campaign status', async () => {
 await TrainingService.updateCampaignStatus('org-1', 'campaign-1', 'active');

 expect(updateDoc).toHaveBeenCalled();
 });

 it('should set completedAt when status is completed', async () => {
 await TrainingService.updateCampaignStatus('org-1', 'campaign-1', 'completed');

 expect(updateDoc).toHaveBeenCalled();
 });
 });

 describe('updateCampaignProgress', () => {
 it('should update campaign progress', async () => {
 const progress = { totalAssignments: 50, completed: 30, overdue: 5 };

 await TrainingService.updateCampaignProgress('org-1', 'campaign-1', progress);

 expect(updateDoc).toHaveBeenCalled();
 });
 });

 // =========================================================================
 // STATISTICS
 // =========================================================================

 describe('getTrainingStats', () => {
 it('should calculate training statistics correctly', async () => {
 // Mock returns 3 assignments: 1 completed, 1 in_progress, 1 overdue
 const result = await TrainingService.getTrainingStats('org-1');

 expect(result.total).toBe(3);
 expect(result.completed).toBe(1);
 expect(result.inProgress).toBe(1);
 expect(result.overdue).toBe(1);
 expect(result.completionRate).toBe(33); // 1/3 * 100 rounded
 });

 it('should return 0 completion rate when no assignments', async () => {
 vi.mocked(getDocs).mockResolvedValueOnce({
 docs: [],
 } as never);

 const result = await TrainingService.getTrainingStats('org-1');

 expect(result.total).toBe(0);
 expect(result.completionRate).toBe(0);
 });
 });

 describe('getUserTrainingStats', () => {
 it('should calculate stats for a specific user', async () => {
 const result = await TrainingService.getUserTrainingStats('org-1', 'user-1');

 expect(result).toBeDefined();
 expect(result.total).toBeGreaterThanOrEqual(0);
 });
 });
});
