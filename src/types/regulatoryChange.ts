export interface RegulatoryChange {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  regulation: string;
  source: string;
  sourceUrl?: string;
  publicationDate: string;
  effectiveDate: string;
  category: 'new-regulation' | 'amendment' | 'guidance' | 'enforcement' | 'standard-update';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  status: 'identified' | 'analyzing' | 'action-required' | 'implementing' | 'compliant' | 'not-applicable';
  impactAssessment?: ImpactAssessment;
  affectedFrameworks: string[];
  affectedControls: string[];
  requiredActions: RegulatoryAction[];
  assignee?: string;
  assigneeName?: string;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ImpactAssessment {
  businessImpact: 'critical' | 'high' | 'medium' | 'low' | 'none';
  complianceGap: string;
  effortEstimate: 'minimal' | 'moderate' | 'significant' | 'major';
  costEstimate?: number;
  deadline: string;
  riskIfNonCompliant: string;
  affectedProcesses: string[];
  affectedDepartments: string[];
}

export interface RegulatoryAction {
  id: string;
  title: string;
  description: string;
  type: 'policy-update' | 'control-implementation' | 'training' | 'audit' | 'process-change' | 'technical';
  assignee: string;
  assigneeName: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in-progress' | 'completed' | 'overdue' | 'cancelled';
  completedAt?: string;
  evidence?: string[];
}

export interface RegulatoryAlert {
  id: string;
  organizationId: string;
  changeId: string;
  type: 'new-regulation' | 'deadline-approaching' | 'enforcement-action' | 'standard-update';
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: string;
}
