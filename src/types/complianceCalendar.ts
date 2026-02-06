export interface ComplianceEvent {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  type: 'regulatory-deadline' | 'certification-renewal' | 'audit-scheduled' | 'review-due' | 'training-deadline' | 'policy-review' | 'assessment-due' | 'report-submission' | 'custom';
  category: 'compliance' | 'audit' | 'certification' | 'risk' | 'training' | 'governance';
  date: string;
  endDate?: string;
  isAllDay: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'upcoming' | 'in-progress' | 'completed' | 'overdue' | 'cancelled';
  framework?: string;
  assignee?: string;
  assigneeName?: string;
  recurrence?: EventRecurrence;
  reminders: EventReminder[];
  relatedEntityType?: 'audit' | 'risk' | 'control' | 'certification' | 'policy' | 'training';
  relatedEntityId?: string;
  color?: string;
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface EventRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  interval: number;
  endDate?: string;
  count?: number;
}

export interface EventReminder {
  type: 'email' | 'in-app' | 'both';
  daysBefore: number;
  sent: boolean;
  sentAt?: string;
}

export interface ComplianceDeadline {
  id: string;
  organizationId: string;
  title: string;
  framework: string;
  article?: string;
  deadline: string;
  description: string;
  status: 'pending' | 'met' | 'missed' | 'extended';
  penalty?: string;
  assignee?: string;
  assigneeName?: string;
  createdAt: string;
  updatedAt: string;
}

export type ComplianceEventType = ComplianceEvent['type'];
export type ComplianceEventCategory = ComplianceEvent['category'];
export type ComplianceEventPriority = ComplianceEvent['priority'];
export type ComplianceEventStatus = ComplianceEvent['status'];
export type ComplianceDeadlineStatus = ComplianceDeadline['status'];
