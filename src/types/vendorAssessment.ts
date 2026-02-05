/**
 * Vendor Assessment Types
 * Enhanced types for third-party risk management (TPRM)
 * Story 37-1: Vendor Assessment Creation
 */

import { SupplierQuestionnaireResponse, QuestionnaireSection } from './business';

// ============================================================================
// Assessment Status Types
// ============================================================================

/**
 * Extended assessment status including Expired
 * Status Flow: Draft → Sent → In Progress → Submitted → Reviewed → Archived
 * In Progress → Expired (if past due date without completion)
 */
export type VendorAssessmentStatus =
 | 'Draft'
 | 'Sent'
 | 'In Progress'
 | 'Submitted'
 | 'Reviewed'
 | 'Archived'
 | 'Expired';

/**
 * Review cycle frequency for vendor assessments
 */
export type ReviewCycle = 'quarterly' | 'bi-annual' | 'annual' | 'custom';

/**
 * Alert thresholds for review notifications (in days)
 */
export const REVIEW_ALERT_THRESHOLDS = [90, 60, 30] as const;
export type ReviewAlertThreshold = typeof REVIEW_ALERT_THRESHOLDS[number];

// ============================================================================
// Extended Assessment Response
// ============================================================================

/**
 * Extended assessment response with expiration and review scheduling
 * Extends the base SupplierQuestionnaireResponse from business.ts
 */
export interface EnhancedAssessmentResponse extends Omit<SupplierQuestionnaireResponse, 'status'> {
 /** Extended status including Expired */
 status: VendorAssessmentStatus;

 /** Date when assessment expires if not completed */
 expirationDate?: string;

 /** Next scheduled review date after completion */
 nextReviewDate?: string;

 /** Review cycle frequency */
 reviewCycle?: ReviewCycle;

 /** Custom review period in days (when reviewCycle is 'custom') */
 customReviewPeriodDays?: number;

 /** Tracking of review alerts sent */
 alertsSent?: ReviewAlertThreshold[];

 /** Framework the assessment is based on */
 framework?: 'DORA' | 'ISO27001' | 'NIS2' | 'HDS' | 'General';

 /** Completion percentage (0-100) */
 completionPercentage?: number;

 /** History of status changes */
 statusHistory?: VendorAssessmentStatusChange[];

 /** Creation timestamp */
 createdAt?: string;

 /** Last update timestamp */
 updatedAt?: string;
}

/**
 * Record of status change for audit trail
 */
export interface VendorAssessmentStatusChange {
 fromStatus: VendorAssessmentStatus;
 toStatus: VendorAssessmentStatus;
 changedAt: string;
 changedBy: string;
 reason?: string;
}

// ============================================================================
// Template Preview Types
// ============================================================================

/**
 * Template preview metadata for selection UI
 */
export interface TemplatePreviewMetadata {
 id: string;
 title: string;
 description: string;
 framework: string;
 version: string;
 sectionCount: number;
 questionCount: number;
 estimatedDuration: string;
 applicableServiceTypes: string[];
 lastUpdated?: string;
}

/**
 * Template section preview (lightweight for list display)
 */
export interface TemplateSectionPreview {
 id: string;
 title: string;
 description?: string;
 questionCount: number;
 weight: number;
}

/**
 * Full template preview with sections
 */
export interface TemplatePreview {
 metadata: TemplatePreviewMetadata;
 sections: TemplateSectionPreview[];
}

/**
 * Convert QuestionnaireSection to preview format
 */
export function sectionToPreview(section: QuestionnaireSection): TemplateSectionPreview {
 return {
 id: section.id,
 title: section.title,
 description: section.description,
 questionCount: section.questions.length,
 weight: section.weight,
 };
}

// ============================================================================
// Assessment Creation Types
// ============================================================================

/**
 * Input for creating a new vendor assessment
 */
export interface CreateAssessmentInput {
 supplierId: string;
 supplierName: string;
 templateId: string;
 framework?: string;
 dueDate?: string;
 expirationDate?: string;
 reviewCycle?: ReviewCycle;
 customReviewPeriodDays?: number;
 respondentEmail?: string;
 notes?: string;
}

/**
 * Assessment scheduling options
 */
export interface AssessmentScheduleOptions {
 dueDate: string;
 reviewCycle: ReviewCycle;
 customReviewPeriodDays?: number;
 sendReminders: boolean;
 reminderDays: number[];
}

// ============================================================================
// Assessment Metrics Types
// ============================================================================

/**
 * Metrics for assessment overview dashboard
 */
export interface AssessmentMetrics {
 total: number;
 byStatus: Record<VendorAssessmentStatus, number>;
 byFramework: Record<string, number>;
 averageScore: number;
 averageCompletionTime: number; // in days
 upcomingReviews: UpcomingReview[];
 expiringSoon: ExpiringAssessment[];
 overdueCount: number;
}

/**
 * Upcoming review notification
 */
export interface UpcomingReview {
 assessmentId: string;
 supplierId: string;
 supplierName: string;
 nextReviewDate: string;
 daysUntilReview: number;
 reviewCycle: ReviewCycle;
}

/**
 * Assessment expiring soon notification
 */
export interface ExpiringAssessment {
 assessmentId: string;
 supplierId: string;
 supplierName: string;
 expirationDate: string;
 daysUntilExpiration: number;
 completionPercentage: number;
}

// ============================================================================
// Assessment Alert Types
// ============================================================================

/**
 * Alert types for assessment notifications
 */
export type AssessmentAlertType =
 | 'expiration_warning'
 | 'review_due'
 | 'assessment_expired'
 | 'assessment_submitted'
 | 'assessment_reviewed';

/**
 * Assessment alert notification
 */
export interface AssessmentAlert {
 id: string;
 organizationId: string;
 assessmentId: string;
 supplierId: string;
 supplierName: string;
 type: AssessmentAlertType;
 message: string;
 daysRemaining?: number;
 createdAt: string;
 readAt?: string;
 dismissedAt?: string;
}

// ============================================================================
// Assessment Filter Types
// ============================================================================

/**
 * Filters for assessment list view
 */
export interface AssessmentFilters {
 status?: VendorAssessmentStatus[];
 framework?: string[];
 riskLevel?: ('Low' | 'Medium' | 'High' | 'Critical')[];
 supplierId?: string;
 dateRange?: {
 start: string;
 end: string;
 };
 reviewDueSoon?: boolean;
 expiringSoon?: boolean;
 searchQuery?: string;
}

/**
 * Sort options for assessment list
 */
export type AssessmentSortField =
 | 'supplierName'
 | 'status'
 | 'dueDate'
 | 'overallScore'
 | 'submittedDate'
 | 'nextReviewDate'
 | 'createdAt';

export interface AssessmentSortOptions {
 field: AssessmentSortField;
 direction: 'asc' | 'desc';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate next review date based on cycle
 */
export function calculateNextReviewDate(
 completedDate: string,
 reviewCycle: ReviewCycle,
 customDays?: number
): string {
 const date = new Date(completedDate);

 switch (reviewCycle) {
 case 'quarterly':
 date.setMonth(date.getMonth() + 3);
 break;
 case 'bi-annual':
 date.setMonth(date.getMonth() + 6);
 break;
 case 'annual':
 date.setFullYear(date.getFullYear() + 1);
 break;
 case 'custom':
 if (customDays) {
 date.setDate(date.getDate() + customDays);
 } else {
 // Default to annual if custom with no days specified
 date.setFullYear(date.getFullYear() + 1);
 }
 break;
 }

 return date.toISOString();
}

/**
 * Check if assessment is expired based on due date
 */
export function isAssessmentExpired(
 assessment: Pick<EnhancedAssessmentResponse, 'status' | 'dueDate' | 'expirationDate'>
): boolean {
 if (assessment.status === 'Expired') return true;
 if (assessment.status === 'Reviewed' || assessment.status === 'Archived') return false;

 const expirationDate = assessment.expirationDate || assessment.dueDate;
 if (!expirationDate) return false;

 return new Date(expirationDate) < new Date();
}

/**
 * Get days until date (negative if past)
 */
export function getDaysUntil(dateStr: string): number {
 const date = new Date(dateStr);
 const now = new Date();
 const diffTime = date.getTime() - now.getTime();
 return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get review cycle label for display
 */
export function getReviewCycleLabel(cycle: ReviewCycle, customDays?: number): string {
 switch (cycle) {
 case 'quarterly':
 return 'Quarterly (3 months)';
 case 'bi-annual':
 return 'Bi-annual (6 months)';
 case 'annual':
 return 'Annual (12 months)';
 case 'custom':
 return customDays ? `Custom (${customDays} days)` : 'Custom';
 }
}

/**
 * Get status color for UI display
 */
export function getVendorAssessmentStatusColor(status: VendorAssessmentStatus): string {
 const colors: Record<VendorAssessmentStatus, string> = {
 'Draft': 'gray',
 'Sent': 'blue',
 'In Progress': 'indigo',
 'Submitted': 'purple',
 'Reviewed': 'green',
 'Archived': 'gray',
 'Expired': 'red',
 };
 return colors[status];
}

/**
 * Calculate completion percentage from answers
 */
export function calculateCompletionPercentage(
 answers: Record<string, { value: unknown }>,
 totalQuestions: number
): number {
 if (totalQuestions === 0) return 0;
 const answeredCount = Object.keys(answers).length;
 return Math.round((answeredCount / totalQuestions) * 100);
}
