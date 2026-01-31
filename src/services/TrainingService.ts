import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { AuditLogService } from './auditLogService';
import { sanitizeData } from '../utils/dataSanitizer';
import {
  trainingCourseSchema,
  trainingAssignmentSchema,
  trainingCampaignSchema,
  type TrainingCourseFormData,
  type TrainingAssignmentFormData,
  type TrainingCampaignFormData,
} from '../schemas/trainingSchema';
import type {
  TrainingCourse,
  TrainingAssignment,
  TrainingCampaign,
  TrainingStats,
  AssignmentStatus,
} from '../types/training';
import type { UserProfile } from '../types';

// ============================================================================
// TrainingService - NIS2 Article 21.2(g)
// ============================================================================

export class TrainingService {
  private static readonly CATALOG_COLLECTION = 'training_catalog';
  private static readonly ASSIGNMENTS_COLLECTION = 'training_assignments';
  private static readonly CAMPAIGNS_COLLECTION = 'training_campaigns';

  // ==========================================================================
  // CATALOG OPERATIONS
  // ==========================================================================

  /**
   * Get all courses for an organization
   */
  static async getCourses(organizationId: string): Promise<TrainingCourse[]> {
    try {
      const q = query(
        collection(db, `organizations/${organizationId}/${this.CATALOG_COLLECTION}`),
        where('isArchived', '==', false),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TrainingCourse[];
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getCourses', { organizationId });
      throw error;
    }
  }

  /**
   * Get a single course by ID
   */
  static async getCourse(
    organizationId: string,
    courseId: string
  ): Promise<TrainingCourse | null> {
    try {
      const docRef = doc(
        db,
        `organizations/${organizationId}/${this.CATALOG_COLLECTION}/${courseId}`
      );
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return { id: docSnap.id, ...docSnap.data() } as TrainingCourse;
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getCourse', {
        organizationId,
        courseId,
      });
      throw error;
    }
  }

  /**
   * Create a new training course
   */
  static async createCourse(
    data: TrainingCourseFormData,
    user: UserProfile
  ): Promise<string> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new Error('User organization ID is missing');
    }

    try {
      // Validate and sanitize
      const validatedData = trainingCourseSchema.parse(data);
      const cleanData = sanitizeData(validatedData);

      const courseData = {
        ...cleanData,
        organizationId,
        isArchived: false,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      };

      const docRef = await addDoc(
        collection(db, `organizations/${organizationId}/${this.CATALOG_COLLECTION}`),
        courseData
      );

      // Audit log
      await AuditLogService.logCreate(
        organizationId,
        { id: user.uid, name: user.displayName || user.email, email: user.email },
        'training_course',
        docRef.id,
        cleanData,
        cleanData.title
      );

      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.createCourse', { organizationId });
      throw error;
    }
  }

  /**
   * Update an existing course
   */
  static async updateCourse(
    courseId: string,
    data: Partial<TrainingCourseFormData>,
    user: UserProfile,
    oldData?: Record<string, unknown>
  ): Promise<void> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new Error('User organization ID is missing');
    }

    try {
      const validatedData = trainingCourseSchema.partial().parse(data);
      const cleanData = sanitizeData(validatedData);

      await updateDoc(
        doc(db, `organizations/${organizationId}/${this.CATALOG_COLLECTION}/${courseId}`),
        {
          ...cleanData,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        }
      );

      // Audit log
      if (oldData) {
        await AuditLogService.logUpdate(
          organizationId,
          { id: user.uid, name: user.displayName || user.email, email: user.email },
          'training_course',
          courseId,
          oldData,
          cleanData,
          (oldData as { title?: string }).title
        );
      }
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.updateCourse', {
        organizationId,
        courseId,
      });
      throw error;
    }
  }

  /**
   * Archive a course (soft delete)
   */
  static async archiveCourse(courseId: string, user: UserProfile): Promise<void> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new Error('User organization ID is missing');
    }

    try {
      await updateDoc(
        doc(db, `organizations/${organizationId}/${this.CATALOG_COLLECTION}/${courseId}`),
        sanitizeData({
          isArchived: true,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        })
      );

      // Audit log
      await AuditLogService.logDelete(
        organizationId,
        { id: user.uid, name: user.displayName || user.email, email: user.email },
        'training_course',
        courseId,
        { action: 'archive' },
        'Course archived'
      );
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.archiveCourse', {
        organizationId,
        courseId,
      });
      throw error;
    }
  }

  // ==========================================================================
  // ASSIGNMENT OPERATIONS
  // ==========================================================================

  /**
   * Assign training to a user
   */
  static async assignTraining(
    data: TrainingAssignmentFormData,
    user: UserProfile
  ): Promise<string> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new Error('User organization ID is missing');
    }

    try {
      const validatedData = trainingAssignmentSchema.parse(data);

      const assignmentData = sanitizeData({
        organizationId,
        userId: validatedData.userId,
        courseId: validatedData.courseId,
        campaignId: validatedData.campaignId || null,
        assignedBy: user.uid,
        assignedAt: serverTimestamp(),
        dueDate: Timestamp.fromDate(validatedData.dueDate),
        status: 'assigned' as AssignmentStatus,
        remindersSent: 0,
      });

      const docRef = await addDoc(
        collection(db, `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}`),
        assignmentData
      );

      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.assignTraining', {
        organizationId,
        userId: data.userId,
        courseId: data.courseId,
      });
      throw error;
    }
  }

  /**
   * Batch assign training to multiple users
   */
  static async batchAssignTraining(
    userIds: string[],
    courseId: string,
    dueDate: Date,
    user: UserProfile,
    campaignId?: string
  ): Promise<string[]> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new Error('User organization ID is missing');
    }

    try {
      const batch = writeBatch(db);
      const assignmentIds: string[] = [];

      for (const userId of userIds) {
        const docRef = doc(
          collection(db, `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}`)
        );
        assignmentIds.push(docRef.id);

        batch.set(docRef, sanitizeData({
          organizationId,
          userId,
          courseId,
          campaignId: campaignId || null,
          assignedBy: user.uid,
          assignedAt: serverTimestamp(),
          dueDate: Timestamp.fromDate(dueDate),
          status: 'assigned' as AssignmentStatus,
          remindersSent: 0,
        }));
      }

      await batch.commit();
      return assignmentIds;
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.batchAssignTraining', {
        organizationId,
        userCount: userIds.length,
        courseId,
      });
      throw error;
    }
  }

  /**
   * Get assignments for a specific user
   */
  static async getUserAssignments(
    organizationId: string,
    userId: string
  ): Promise<TrainingAssignment[]> {
    try {
      const q = query(
        collection(db, `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}`),
        where('userId', '==', userId),
        orderBy('dueDate', 'asc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TrainingAssignment[];
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getUserAssignments', {
        organizationId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get all assignments for an organization
   */
  static async getAllAssignments(organizationId: string): Promise<TrainingAssignment[]> {
    try {
      const q = query(
        collection(db, `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}`)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TrainingAssignment[];
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getAllAssignments', { organizationId });
      throw error;
    }
  }

  /**
   * Get overdue assignments
   */
  static async getOverdueAssignments(
    organizationId: string,
    maxResults = 50
  ): Promise<TrainingAssignment[]> {
    try {
      const q = query(
        collection(db, `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}`),
        where('status', '==', 'overdue'),
        orderBy('dueDate', 'asc'),
        limit(maxResults)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TrainingAssignment[];
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getOverdueAssignments', {
        organizationId,
      });
      throw error;
    }
  }

  /**
   * Start an assignment (mark as in_progress)
   */
  static async startAssignment(
    organizationId: string,
    assignmentId: string
  ): Promise<void> {
    try {
      await updateDoc(
        doc(
          db,
          `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}/${assignmentId}`
        ),
        sanitizeData({
          status: 'in_progress',
          startedAt: serverTimestamp(),
        })
      );
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.startAssignment', {
        organizationId,
        assignmentId,
      });
      throw error;
    }
  }

  /**
   * Complete an assignment
   */
  static async completeAssignment(
    organizationId: string,
    assignmentId: string,
    score?: number,
    timeSpent?: number
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {
        status: 'completed',
        completedAt: serverTimestamp(),
      };

      if (score !== undefined) {
        updateData.score = score;
      }
      if (timeSpent !== undefined) {
        updateData.timeSpent = timeSpent;
      }

      await updateDoc(
        doc(
          db,
          `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}/${assignmentId}`
        ),
        sanitizeData(updateData)
      );
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.completeAssignment', {
        organizationId,
        assignmentId,
      });
      throw error;
    }
  }

  /**
   * Delete an assignment
   */
  static async deleteAssignment(
    organizationId: string,
    assignmentId: string,
    user: UserProfile
  ): Promise<void> {
    try {
      await deleteDoc(
        doc(
          db,
          `organizations/${organizationId}/${this.ASSIGNMENTS_COLLECTION}/${assignmentId}`
        )
      );

      // Audit log
      await AuditLogService.logDelete(
        organizationId,
        { id: user.uid, name: user.displayName || user.email, email: user.email },
        'training_assignment',
        assignmentId,
        { action: 'delete' },
        'Assignment deleted'
      );
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.deleteAssignment', {
        organizationId,
        assignmentId,
      });
      throw error;
    }
  }

  // ==========================================================================
  // CAMPAIGN OPERATIONS
  // ==========================================================================

  /**
   * Get all campaigns for an organization
   */
  static async getCampaigns(organizationId: string): Promise<TrainingCampaign[]> {
    try {
      const q = query(
        collection(db, `organizations/${organizationId}/${this.CAMPAIGNS_COLLECTION}`),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TrainingCampaign[];
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getCampaigns', { organizationId });
      throw error;
    }
  }

  /**
   * Create a new campaign
   */
  static async createCampaign(
    data: TrainingCampaignFormData,
    user: UserProfile
  ): Promise<string> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new Error('User organization ID is missing');
    }

    try {
      const validatedData = trainingCampaignSchema.parse(data);
      const cleanData = sanitizeData(validatedData);

      const campaignData = {
        ...cleanData,
        organizationId,
        startDate: Timestamp.fromDate(validatedData.startDate),
        endDate: Timestamp.fromDate(validatedData.endDate),
        status: 'draft' as const,
        progress: {
          totalAssignments: 0,
          completed: 0,
          overdue: 0,
        },
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      };

      const docRef = await addDoc(
        collection(db, `organizations/${organizationId}/${this.CAMPAIGNS_COLLECTION}`),
        campaignData
      );

      // Audit log
      await AuditLogService.logCreate(
        organizationId,
        { id: user.uid, name: user.displayName || user.email, email: user.email },
        'training_campaign',
        docRef.id,
        cleanData,
        cleanData.name
      );

      return docRef.id;
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.createCampaign', { organizationId });
      throw error;
    }
  }

  /**
   * Update campaign status
   */
  static async updateCampaignStatus(
    organizationId: string,
    campaignId: string,
    status: TrainingCampaign['status']
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = { status };

      if (status === 'completed') {
        updateData.completedAt = serverTimestamp();
      }

      await updateDoc(
        doc(db, `organizations/${organizationId}/${this.CAMPAIGNS_COLLECTION}/${campaignId}`),
        sanitizeData(updateData)
      );
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.updateCampaignStatus', {
        organizationId,
        campaignId,
        status,
      });
      throw error;
    }
  }

  /**
   * Update campaign progress
   */
  static async updateCampaignProgress(
    organizationId: string,
    campaignId: string,
    progress: TrainingCampaign['progress']
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, `organizations/${organizationId}/${this.CAMPAIGNS_COLLECTION}/${campaignId}`),
        sanitizeData({ progress })
      );
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.updateCampaignProgress', {
        organizationId,
        campaignId,
      });
      throw error;
    }
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get training statistics for an organization
   */
  static async getTrainingStats(organizationId: string): Promise<TrainingStats> {
    try {
      const assignments = await this.getAllAssignments(organizationId);

      const total = assignments.length;
      const completed = assignments.filter((a) => a.status === 'completed').length;
      const overdue = assignments.filter((a) => a.status === 'overdue').length;
      const inProgress = assignments.filter((a) => a.status === 'in_progress').length;

      return {
        total,
        completed,
        overdue,
        inProgress,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getTrainingStats', { organizationId });
      throw error;
    }
  }

  /**
   * Get training stats for a specific user
   */
  static async getUserTrainingStats(
    organizationId: string,
    userId: string
  ): Promise<TrainingStats> {
    try {
      const assignments = await this.getUserAssignments(organizationId, userId);

      const total = assignments.length;
      const completed = assignments.filter((a) => a.status === 'completed').length;
      const overdue = assignments.filter((a) => a.status === 'overdue').length;
      const inProgress = assignments.filter((a) => a.status === 'in_progress').length;

      return {
        total,
        completed,
        overdue,
        inProgress,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    } catch (error) {
      ErrorLogger.error(error, 'TrainingService.getUserTrainingStats', {
        organizationId,
        userId,
      });
      throw error;
    }
  }
}
