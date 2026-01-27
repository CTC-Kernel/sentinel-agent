import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Training Module Types - NIS2 Article 21.2(g)
// ============================================================================

/**
 * Training course categories
 */
export type TrainingCategory = 'security' | 'compliance' | 'awareness' | 'technical';

/**
 * Training content sources
 */
export type TrainingSource = 'anssi' | 'cnil' | 'internal' | 'external';

/**
 * Training content type
 */
export type TrainingContentType = 'video' | 'document' | 'quiz' | 'external_link';

/**
 * Training assignment status
 */
export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'overdue';

/**
 * Training campaign status
 */
export type CampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

/**
 * Campaign scope type
 */
export type CampaignScope = 'all' | 'department' | 'role';

/**
 * Campaign recurrence frequency
 */
export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'yearly';

// ============================================================================
// Training Course
// ============================================================================

/**
 * Training course content configuration
 */
export interface TrainingContent {
  type: TrainingContentType;
  url?: string;           // External URL or Storage path
  quizId?: string;        // Reference to quiz
}

/**
 * Framework mapping for training course
 */
export interface TrainingFrameworkMapping {
  nis2?: string[];        // e.g., ['21.2g']
  iso27001?: string[];    // e.g., ['A.7.2.2']
  dora?: string[];
  rgpd?: string[];
}

/**
 * Training course in the catalog
 */
export interface TrainingCourse {
  id: string;
  organizationId: string;

  // Core fields
  title: string;
  description: string;
  category: TrainingCategory;
  source: TrainingSource;
  duration: number;        // Minutes

  // Configuration
  isRequired: boolean;
  targetRoles: string[];

  // Content
  content: TrainingContent;

  // Framework mapping
  frameworkMappings: TrainingFrameworkMapping;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  isArchived: boolean;
}

/**
 * Training course form data (for create/edit)
 */
export type TrainingCourseFormData = Omit<
  TrainingCourse,
  'id' | 'organizationId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'isArchived'
>;

// ============================================================================
// Training Assignment
// ============================================================================

/**
 * Training assignment linking user to course
 */
export interface TrainingAssignment {
  id: string;
  organizationId: string;

  // References
  userId: string;
  courseId: string;
  campaignId?: string;

  // Assignment info
  assignedBy: string;
  assignedAt: Timestamp;
  dueDate: Timestamp;

  // Progress
  status: AssignmentStatus;
  startedAt?: Timestamp;
  completedAt?: Timestamp;

  // Results
  score?: number;          // 0-100 if quiz
  timeSpent?: number;      // Minutes
  certificateUrl?: string; // Storage path to PDF
  verificationHash?: string; // Certificate verification hash

  // Metadata
  remindersSent: number;
  lastReminderAt?: Timestamp;
}

/**
 * Assignment form data for creating new assignments
 */
export interface TrainingAssignmentFormData {
  userId: string;
  courseId: string;
  dueDate: Date;
  campaignId?: string;
}

// ============================================================================
// Training Campaign
// ============================================================================

/**
 * Campaign recurrence configuration
 */
export interface CampaignRecurrence {
  enabled: boolean;
  frequency: RecurrenceFrequency;
  nextOccurrence?: Timestamp;
}

/**
 * Campaign progress tracking
 */
export interface CampaignProgress {
  totalAssignments: number;
  completed: number;
  overdue: number;
}

/**
 * Training campaign for batch assignments
 */
export interface TrainingCampaign {
  id: string;
  organizationId: string;

  // Campaign info
  name: string;
  description?: string;

  // Timing
  startDate: Timestamp;
  endDate: Timestamp;

  // Scope
  scope: CampaignScope;
  scopeFilter?: string[];  // Department IDs or role names

  // Content
  courseIds: string[];

  // Recurrence
  recurrence?: CampaignRecurrence;

  // Status
  status: CampaignStatus;
  progress: CampaignProgress;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  completedAt?: Timestamp;
}

/**
 * Campaign form data for creation
 */
export interface TrainingCampaignFormData {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  scope: CampaignScope;
  scopeFilter?: string[];
  courseIds: string[];
  recurrence?: {
    enabled: boolean;
    frequency: RecurrenceFrequency;
  };
}

// ============================================================================
// Training Statistics
// ============================================================================

/**
 * Training statistics for dashboard
 */
export interface TrainingStats {
  total: number;
  completed: number;
  overdue: number;
  inProgress: number;
  completionRate: number;   // 0-100
}

/**
 * Department training breakdown
 */
export interface DepartmentTrainingStats {
  department: string;
  total: number;
  completed: number;
  completionRate: number;
}

/**
 * Training trend data point
 */
export interface TrainingTrendPoint {
  date: string;            // ISO date string
  completed: number;
  assigned: number;
}

/**
 * Complete training dashboard data
 */
export interface TrainingDashboardData {
  stats: TrainingStats;
  byDepartment: DepartmentTrainingStats[];
  trend: TrainingTrendPoint[];
  overdueAssignments: TrainingAssignment[];
}
