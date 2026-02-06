export interface Committee {
  id: string;
  organizationId: string;
  name: string;
  type: 'board' | 'steering' | 'audit' | 'risk' | 'compliance' | 'security' | 'custom';
  description: string;
  chair: string;
  secretary?: string;
  members: CommitteeMember[];
  meetingFrequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | 'ad-hoc';
  status: 'active' | 'inactive' | 'archived';
  charter?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CommitteeMember {
  userId: string;
  displayName: string;
  role: 'chair' | 'vice-chair' | 'secretary' | 'member' | 'observer';
  joinedAt: string;
  votingRights: boolean;
}

export interface Meeting {
  id: string;
  organizationId: string;
  committeeId: string;
  committeeName: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  type: 'regular' | 'extraordinary' | 'emergency';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  agenda: AgendaItem[];
  attendees: MeetingAttendee[];
  quorumRequired: number;
  quorumMet?: boolean;
  minutesUrl?: string;
  minutesApproved: boolean;
  minutesApprovedBy?: string;
  minutesApprovedAt?: string;
  decisions: Decision[];
  actionItems: ActionItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AgendaItem {
  id: string;
  order: number;
  title: string;
  description?: string;
  presenter?: string;
  duration: number;
  type: 'information' | 'discussion' | 'decision' | 'approval';
  documents?: string[];
  status: 'pending' | 'discussed' | 'deferred';
}

export interface MeetingAttendee {
  userId: string;
  displayName: string;
  role: string;
  attendance: 'present' | 'absent' | 'excused' | 'remote';
  proxy?: string;
}

export interface Decision {
  id: string;
  meetingId: string;
  committeeId: string;
  organizationId: string;
  title: string;
  description: string;
  type: 'approval' | 'resolution' | 'directive' | 'recommendation';
  status: 'proposed' | 'approved' | 'rejected' | 'deferred' | 'superseded';
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  unanimity: boolean;
  effectiveDate?: string;
  expiryDate?: string;
  relatedRisks?: string[];
  relatedPolicies?: string[];
  actionItems: ActionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  assignee: string;
  assigneeName: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'completed' | 'overdue' | 'cancelled';
  completedAt?: string;
  sourceType: 'meeting' | 'decision';
  sourceId: string;
}
