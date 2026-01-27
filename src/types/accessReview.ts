/**
 * Access Review Types
 *
 * Types for periodic access review and dormant account management.
 * Part of NIS2 Article 21.2(i) compliance.
 *
 * @module types/accessReview
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Access review campaign status
 */
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

/**
 * Individual review status
 */
export type ReviewStatus = 'pending' | 'approved' | 'revoked' | 'escalated';

/**
 * Review decision
 */
export type ReviewDecision = 'keep' | 'revoke' | 'escalate';

/**
 * Dormant account status
 */
export type DormantStatus = 'detected' | 'contacted' | 'disabled' | 'deleted' | 'excluded';

/**
 * Campaign scope
 */
export type CampaignScope = 'all' | 'department' | 'role';

/**
 * Access Review Campaign
 */
export interface AccessReviewCampaign {
  id: string;
  organizationId: string;

  // Basic info
  name: string;
  description?: string;

  // Schedule
  startDate: Timestamp;
  endDate: Timestamp;
  status: CampaignStatus;

  // Scope
  scope: CampaignScope;
  scopeValue?: string; // department name or role name if scope is not 'all'

  // Recurrence
  isRecurring: boolean;
  recurrenceDays?: number; // e.g., 90 for quarterly

  // Progress
  totalReviews: number;
  completedReviews: number;
  approvedCount: number;
  revokedCount: number;
  escalatedCount: number;

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  completedAt?: Timestamp;
}

/**
 * Individual Access Review
 */
export interface AccessReview {
  id: string;
  organizationId: string;
  campaignId: string;

  // User being reviewed
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userDepartment?: string;

  // Reviewer (manager)
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;

  // Current permissions/access being reviewed
  permissions: UserPermission[];

  // Review details
  status: ReviewStatus;
  decision?: ReviewDecision;
  justification?: string;
  reviewedAt?: Timestamp;

  // Deadline
  deadline: Timestamp;
  remindersSent: number;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * User permission for review
 */
export interface UserPermission {
  id: string;
  name: string;
  resource: string;
  level: 'read' | 'write' | 'manage' | 'admin';
  grantedAt?: Timestamp;
  grantedBy?: string;
}

/**
 * Dormant Account
 */
export interface DormantAccount {
  id: string;
  organizationId: string;

  // User info
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userDepartment?: string;

  // Detection
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
  daysSinceLastLogin: number;
  neverLoggedIn: boolean;

  // Status
  status: DormantStatus;
  statusReason?: string;
  statusChangedAt?: Timestamp;
  statusChangedBy?: string;

  // Detection
  detectedAt: Timestamp;
  excludedUntil?: Timestamp;
}

/**
 * Access Review Stats
 */
export interface AccessReviewStats {
  activeCampaigns: number;
  pendingReviews: number;
  overdueReviews: number;
  dormantAccounts: number;
  lastCampaignDate?: Timestamp;
  daysSinceLastCampaign: number;
  completionRate: number;
  revocationRate: number;
}

/**
 * Campaign form data
 */
export type CampaignFormData = Omit<AccessReviewCampaign,
  'id' | 'organizationId' | 'status' | 'totalReviews' | 'completedReviews' |
  'approvedCount' | 'revokedCount' | 'escalatedCount' | 'createdAt' | 'createdBy' |
  'updatedAt' | 'updatedBy' | 'completedAt'
>;

/**
 * Review submission data
 */
export interface ReviewSubmission {
  reviewId: string;
  decision: ReviewDecision;
  justification: string;
}
