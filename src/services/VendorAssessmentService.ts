/**
 * Vendor Assessment Service
 * Handles vendor risk assessments, templates, expiration checking, and review scheduling
 * Story 37-1: Vendor Assessment Creation
 */

import { AuditLogService } from './auditLogService';
import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  orderBy,
  limit,
} from 'firebase/firestore';
import { sanitizeData } from '../utils/dataSanitizer';
import { ErrorLogger } from './errorLogger';
import { QuestionnaireTemplate } from '../types/business';
import {
  EnhancedAssessmentResponse,
  VendorAssessmentStatus,
  ReviewCycle,
  AssessmentMetrics,
  UpcomingReview,
  ExpiringAssessment,
  CreateAssessmentInput,
  AssessmentAlert,
  AssessmentAlertType,
  TemplatePreview,
  TemplatePreviewMetadata,
  calculateNextReviewDate,
  isAssessmentExpired,
  getDaysUntil,
  REVIEW_ALERT_THRESHOLDS,
} from '../types/vendorAssessment';
import { QUESTIONNAIRE_TEMPLATES, getTemplateById } from '../data/questionnaireTemplates';

// Collection names
const TEMPLATES_COLLECTION = 'questionnaire_templates';
const RESPONSES_COLLECTION = 'questionnaire_responses';
const ALERTS_COLLECTION = 'vendor_assessment_alerts';

export class VendorAssessmentService {
  // ============================================================================
  // Template Management
  // ============================================================================

  /**
   * Seed default questionnaire templates for an organization
   * Only seeds templates that don't already exist
   */
  static async seedDefaultTemplates(organizationId: string, userId: string): Promise<number> {
    try {
      // Check which templates already exist
      const existingQuery = query(
        collection(db, TEMPLATES_COLLECTION),
        where('organizationId', '==', organizationId),
        where('isSystem', '==', true)
      );
      const existingSnap = await getDocs(existingQuery);
      const existingIds = new Set(existingSnap.docs.map(d => d.data().id));

      const batch = writeBatch(db);
      let count = 0;

      for (const templateData of QUESTIONNAIRE_TEMPLATES) {
        // Skip if already exists
        if (existingIds.has(templateData.metadata.id)) {
          continue;
        }

        const newRef = doc(collection(db, TEMPLATES_COLLECTION));
        const template: QuestionnaireTemplate = {
          id: templateData.metadata.id,
          organizationId,
          title: templateData.metadata.title,
          description: templateData.metadata.description,
          sections: templateData.sections,
          isDefault: templateData.metadata.id === 'general-security',
          isSystem: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userId,
        };

        batch.set(newRef, sanitizeData(template));
        count++;
      }

      if (count > 0) {
        await batch.commit();
      }

      return count;
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.seedDefaultTemplates');
      throw error;
    }
  }

  /**
   * Get all available templates for an organization
   */
  static async getTemplates(organizationId: string): Promise<QuestionnaireTemplate[]> {
    try {
      const q = query(
        collection(db, TEMPLATES_COLLECTION),
        where('organizationId', '==', organizationId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as QuestionnaireTemplate));
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.getTemplates');
      throw error;
    }
  }

  /**
   * Get template preview metadata for selection UI
   */
  static async getTemplatePreview(templateId: string): Promise<TemplatePreview | null> {
    try {
      // First try to get from predefined templates
      const predefinedTemplate = getTemplateById(templateId);
      if (predefinedTemplate) {
        return {
          metadata: {
            ...predefinedTemplate.metadata,
            applicableServiceTypes: predefinedTemplate.metadata.applicableTo || [],
          },
          sections: predefinedTemplate.sections.map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            questionCount: s.questions.length,
            weight: s.weight,
          })),
        };
      }

      // Fall back to Firestore query
      const q = query(
        collection(db, TEMPLATES_COLLECTION),
        where('id', '==', templateId),
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const data = snapshot.docs[0].data() as QuestionnaireTemplate;
      const questionCount = data.sections.reduce((sum, s) => sum + s.questions.length, 0);

      const metadata: TemplatePreviewMetadata = {
        id: data.id,
        title: data.title,
        description: data.description,
        framework: data.id.split('-')[0].toUpperCase(),
        version: '1.0',
        sectionCount: data.sections.length,
        questionCount,
        estimatedDuration: `${Math.ceil(questionCount * 2)} min`,
        applicableServiceTypes: [],
        lastUpdated: data.updatedAt,
      };

      return {
        metadata,
        sections: data.sections.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          questionCount: s.questions.length,
          weight: s.weight,
        })),
      };
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.getTemplatePreview');
      throw error;
    }
  }

  // ============================================================================
  // Assessment Creation
  // ============================================================================

  /**
   * Create a new vendor assessment with enhanced fields
   */
  static async createAssessment(
    organizationId: string,
    input: CreateAssessmentInput,
    user?: { uid: string; email: string; displayName?: string }
  ): Promise<string> {
    try {
      const now = new Date().toISOString();

      const newResponse: Partial<EnhancedAssessmentResponse> = {
        organizationId,
        supplierId: input.supplierId,
        supplierName: input.supplierName,
        templateId: input.templateId,
        framework: input.framework as EnhancedAssessmentResponse['framework'],
        status: 'Draft',
        answers: {},
        overallScore: 0,
        completionPercentage: 0,
        createdAt: serverTimestamp() as unknown as string,
        updatedAt: serverTimestamp() as unknown as string,
        sentDate: now,
        dueDate: input.dueDate,
        expirationDate: input.expirationDate,
        reviewCycle: input.reviewCycle,
        customReviewPeriodDays: input.customReviewPeriodDays,
        respondentEmail: input.respondentEmail,
        alertsSent: [],
        statusHistory: [{
          fromStatus: 'Draft',
          toStatus: 'Draft',
          changedAt: now,
          changedBy: user ? (user.displayName || user.email) : 'system',
          reason: 'Assessment created',
        }],
      };

      const res = await addDoc(
        collection(db, RESPONSES_COLLECTION),
        sanitizeData(newResponse)
      );

      // Audit Log
      if (user) {
        await AuditLogService.logCreate(
          organizationId,
          { id: user.uid, name: user.displayName || user.email, email: user.email },
          'audit',
          res.id,
          { ...newResponse, id: res.id },
          `Assessment created for ${input.supplierName}`
        );
      }

      return res.id;
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.createAssessment');
      throw error;
    }
  }

  /**
   * Update assessment status with history tracking
   */
  static async updateVendorAssessmentStatus(
    assessmentId: string,
    newStatus: VendorAssessmentStatus,
    changedBy: string,
    reason?: string
  ): Promise<void> {
    try {
      const docRef = doc(db, RESPONSES_COLLECTION, assessmentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error(`Assessment ${assessmentId} not found`);
      }

      const currentData = docSnap.data() as EnhancedAssessmentResponse;
      const statusHistory = currentData.statusHistory || [];

      statusHistory.push({
        fromStatus: currentData.status,
        toStatus: newStatus,
        changedAt: new Date().toISOString(),
        changedBy,
        reason,
      });

      const updates: Partial<EnhancedAssessmentResponse> = {
        status: newStatus,
        statusHistory,
        updatedAt: serverTimestamp(),
      };

      // Set dates based on status change
      if (newStatus === 'Submitted') {
        updates.submittedDate = new Date().toISOString();
      } else if (newStatus === 'Reviewed') {
        updates.reviewedDate = new Date().toISOString();
        updates.reviewedBy = changedBy;

        // Calculate next review date if review cycle is set
        if (currentData.reviewCycle) {
          updates.nextReviewDate = calculateNextReviewDate(
            new Date().toISOString(),
            currentData.reviewCycle,
            currentData.customReviewPeriodDays
          );
        }
      }

      await updateDoc(docRef, sanitizeData(updates));
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.updateVendorAssessmentStatus');
      throw error;
    }
  }

  // ============================================================================
  // Expiration Management
  // ============================================================================

  /**
   * Check and mark expired assessments for an organization
   * Returns count of assessments marked as expired
   */
  static async checkExpiredAssessments(organizationId: string): Promise<number> {
    try {
      const now = new Date();

      // Query assessments that are not yet expired or completed
      const q = query(
        collection(db, RESPONSES_COLLECTION),
        where('organizationId', '==', organizationId),
        where('status', 'in', ['Draft', 'Sent', 'In Progress'])
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let expiredCount = 0;

      for (const docSnap of snapshot.docs) {
        const assessment = docSnap.data() as EnhancedAssessmentResponse;

        if (isAssessmentExpired(assessment)) {
          const statusHistory = assessment.statusHistory || [];
          statusHistory.push({
            fromStatus: assessment.status,
            toStatus: 'Expired',
            changedAt: now.toISOString(),
            changedBy: 'system',
            reason: 'Assessment expired due to passing due date',
          });

          batch.update(docSnap.ref, sanitizeData({
            status: 'Expired',
            statusHistory,
            updatedAt: serverTimestamp(),
          }));

          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        await batch.commit();
      }

      return expiredCount;
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.checkExpiredAssessments');
      throw error;
    }
  }

  // ============================================================================
  // Review Scheduling
  // ============================================================================

  /**
   * Schedule next review date for an assessment
   */
  static async scheduleNextReview(
    assessmentId: string,
    reviewCycle: ReviewCycle,
    customDays?: number
  ): Promise<string> {
    try {
      const docRef = doc(db, RESPONSES_COLLECTION, assessmentId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error(`Assessment ${assessmentId} not found`);
      }

      const assessment = docSnap.data() as EnhancedAssessmentResponse;
      const baseDate = assessment.reviewedDate || assessment.submittedDate || new Date().toISOString();
      const nextReviewDate = calculateNextReviewDate(baseDate, reviewCycle, customDays);

      await updateDoc(docRef, sanitizeData({
        reviewCycle,
        customReviewPeriodDays: customDays,
        nextReviewDate,
        alertsSent: [], // Reset alerts for new cycle
        updatedAt: serverTimestamp(),
      }));

      return nextReviewDate;
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.scheduleNextReview');
      throw error;
    }
  }

  /**
   * Get assessments with upcoming reviews
   */
  static async getUpcomingReviews(
    organizationId: string,
    daysAhead: number = 90
  ): Promise<UpcomingReview[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const q = query(
        collection(db, RESPONSES_COLLECTION),
        where('organizationId', '==', organizationId),
        where('status', '==', 'Reviewed')
      );

      const snapshot = await getDocs(q);
      const upcomingReviews: UpcomingReview[] = [];

      for (const docSnap of snapshot.docs) {
        const assessment = docSnap.data() as EnhancedAssessmentResponse;

        if (assessment.nextReviewDate) {
          const reviewDate = new Date(assessment.nextReviewDate);
          if (reviewDate <= futureDate) {
            upcomingReviews.push({
              assessmentId: docSnap.id,
              supplierId: assessment.supplierId,
              supplierName: assessment.supplierName,
              nextReviewDate: assessment.nextReviewDate,
              daysUntilReview: getDaysUntil(assessment.nextReviewDate),
              reviewCycle: assessment.reviewCycle || 'annual',
            });
          }
        }
      }

      // Sort by days until review (ascending)
      return upcomingReviews.sort((a, b) => a.daysUntilReview - b.daysUntilReview);
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.getUpcomingReviews');
      throw error;
    }
  }

  /**
   * Get assessments expiring soon
   */
  static async getExpiringSoon(
    organizationId: string,
    daysAhead: number = 30
  ): Promise<ExpiringAssessment[]> {
    try {
      const q = query(
        collection(db, RESPONSES_COLLECTION),
        where('organizationId', '==', organizationId),
        where('status', 'in', ['Draft', 'Sent', 'In Progress'])
      );

      const snapshot = await getDocs(q);
      const expiring: ExpiringAssessment[] = [];

      for (const docSnap of snapshot.docs) {
        const assessment = docSnap.data() as EnhancedAssessmentResponse;
        const expirationDate = assessment.expirationDate || assessment.dueDate;

        if (expirationDate) {
          const daysUntil = getDaysUntil(expirationDate);
          if (daysUntil > 0 && daysUntil <= daysAhead) {
            expiring.push({
              assessmentId: docSnap.id,
              supplierId: assessment.supplierId,
              supplierName: assessment.supplierName,
              expirationDate,
              daysUntilExpiration: daysUntil,
              completionPercentage: assessment.completionPercentage || 0,
            });
          }
        }
      }

      return expiring.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.getExpiringSoon');
      throw error;
    }
  }

  // ============================================================================
  // Metrics & Analytics
  // ============================================================================

  /**
   * Get assessment metrics for dashboard
   */
  static async getAssessmentMetrics(organizationId: string): Promise<AssessmentMetrics> {
    try {
      const q = query(
        collection(db, RESPONSES_COLLECTION),
        where('organizationId', '==', organizationId)
      );

      const snapshot = await getDocs(q);
      const assessments = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as (EnhancedAssessmentResponse & { id: string })[];

      // Initialize status counts
      const byStatus: Record<VendorAssessmentStatus, number> = {
        'Draft': 0,
        'Sent': 0,
        'In Progress': 0,
        'Submitted': 0,
        'Reviewed': 0,
        'Archived': 0,
        'Expired': 0,
      };

      const byFramework: Record<string, number> = {};
      let totalScore = 0;
      let scoredCount = 0;
      let totalCompletionDays = 0;
      let completedCount = 0;

      for (const assessment of assessments) {
        // Status counts
        byStatus[assessment.status] = (byStatus[assessment.status] || 0) + 1;

        // Framework counts
        const framework = assessment.framework || 'Unknown';
        byFramework[framework] = (byFramework[framework] || 0) + 1;

        // Score average (only for completed assessments)
        if (assessment.status === 'Reviewed' && assessment.overallScore > 0) {
          totalScore += assessment.overallScore;
          scoredCount++;
        }

        // Completion time average
        if (assessment.sentDate && assessment.submittedDate) {
          const sentDate = new Date(assessment.sentDate);
          const submittedDate = new Date(assessment.submittedDate);
          const days = Math.ceil((submittedDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
          totalCompletionDays += days;
          completedCount++;
        }
      }

      // Get upcoming reviews and expiring assessments
      const [upcomingReviews, expiringSoon] = await Promise.all([
        this.getUpcomingReviews(organizationId),
        this.getExpiringSoon(organizationId),
      ]);

      // Count overdue (negative days until expiration)
      const overdueCount = assessments.filter(a => {
        const expDate = a.expirationDate || a.dueDate;
        return expDate && getDaysUntil(expDate) < 0 && !['Reviewed', 'Archived', 'Expired'].includes(a.status);
      }).length;

      return {
        total: assessments.length,
        byStatus,
        byFramework,
        averageScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 0,
        averageCompletionTime: completedCount > 0 ? Math.round(totalCompletionDays / completedCount) : 0,
        upcomingReviews: upcomingReviews.slice(0, 5),
        expiringSoon: expiringSoon.slice(0, 5),
        overdueCount,
      };
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.getAssessmentMetrics');
      throw error;
    }
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  /**
   * Generate alerts for assessments that need attention
   * Called by scheduled Cloud Function
   */
  static async generateAlerts(organizationId: string): Promise<number> {
    try {
      const batch = writeBatch(db);
      let alertCount = 0;

      // Get all active assessments
      const activeQuery = query(
        collection(db, RESPONSES_COLLECTION),
        where('organizationId', '==', organizationId),
        where('status', 'in', ['Draft', 'Sent', 'In Progress', 'Reviewed'])
      );

      const snapshot = await getDocs(activeQuery);

      for (const docSnap of snapshot.docs) {
        const assessment = docSnap.data() as EnhancedAssessmentResponse;
        const alertsSent = assessment.alertsSent || [];

        // Check expiration alerts for pending assessments
        if (['Draft', 'Sent', 'In Progress'].includes(assessment.status)) {
          const expirationDate = assessment.expirationDate || assessment.dueDate;
          if (expirationDate) {
            const daysUntil = getDaysUntil(expirationDate);

            for (const threshold of REVIEW_ALERT_THRESHOLDS) {
              if (daysUntil <= threshold && daysUntil > 0 && !alertsSent.includes(threshold)) {
                // Create alert
                const alert = this.createAlertDoc(
                  organizationId,
                  docSnap.id,
                  assessment,
                  'expiration_warning',
                  `Assessment for ${assessment.supplierName} expires in ${daysUntil} days`,
                  daysUntil
                );
                const alertRef = doc(collection(db, ALERTS_COLLECTION));
                batch.set(alertRef, sanitizeData(alert));

                // Update alertsSent
                alertsSent.push(threshold);
                alertCount++;
              }
            }
          }
        }

        // Check review alerts for reviewed assessments
        if (assessment.status === 'Reviewed' && assessment.nextReviewDate) {
          const daysUntil = getDaysUntil(assessment.nextReviewDate);

          for (const threshold of REVIEW_ALERT_THRESHOLDS) {
            if (daysUntil <= threshold && daysUntil > 0 && !alertsSent.includes(threshold)) {
              const alert = this.createAlertDoc(
                organizationId,
                docSnap.id,
                assessment,
                'review_due',
                `Review for ${assessment.supplierName} is due in ${daysUntil} days`,
                daysUntil
              );
              const alertRef = doc(collection(db, ALERTS_COLLECTION));
              batch.set(alertRef, sanitizeData(alert));

              alertsSent.push(threshold);
              alertCount++;
            }
          }
        }

        // Update assessment with new alertsSent
        if (alertsSent.length !== (assessment.alertsSent?.length || 0)) {
          batch.update(docSnap.ref, sanitizeData({ alertsSent }));
        }
      }

      if (alertCount > 0) {
        await batch.commit();
      }

      return alertCount;
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.generateAlerts');
      throw error;
    }
  }

  /**
   * Get unread alerts for an organization
   */
  static async getAlerts(organizationId: string): Promise<AssessmentAlert[]> {
    try {
      const q = query(
        collection(db, ALERTS_COLLECTION),
        where('organizationId', '==', organizationId),
        where('dismissedAt', '==', null),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AssessmentAlert));
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.getAlerts');
      throw error;
    }
  }

  /**
   * Dismiss an alert
   */
  static async dismissAlert(alertId: string): Promise<void> {
    try {
      const alertRef = doc(db, ALERTS_COLLECTION, alertId);
      await updateDoc(alertRef, {
        dismissedAt: serverTimestamp(),
      });
    } catch (error) {
      ErrorLogger.error(error, 'VendorAssessmentService.dismissAlert');
      throw error;
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private static createAlertDoc(
    organizationId: string,
    assessmentId: string,
    assessment: EnhancedAssessmentResponse,
    type: AssessmentAlertType,
    message: string,
    daysRemaining?: number
  ): Omit<AssessmentAlert, 'id'> {
    return {
      organizationId,
      assessmentId,
      supplierId: assessment.supplierId,
      supplierName: assessment.supplierName,
      type,
      message,
      daysRemaining,
      createdAt: new Date().toISOString(),
      readAt: undefined,
      dismissedAt: undefined,
    };
  }
}
