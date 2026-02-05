import { Framework } from './common';

export interface ProjectTask {
 id: string;
 title: string;
 description?: string;
 status: 'À faire' | 'En cours' | 'Terminé' | 'Bloqué';
 assignee?: string;
 assigneeId?: string;
 startDate?: string; // Added for Gantt chart
 dueDate?: string;
 priority?: 'low' | 'medium' | 'high';
 estimatedHours?: number;
 actualHours?: number;
 dependencies?: string[]; // IDs of tasks this depends on
 progress?: number; // 0-100 percentage
}

export interface ProjectMilestone {
 id: string;
 projectId: string;
 title: string;
 description?: string;
 targetDate: string;
 status: 'pending' | 'achieved' | 'missed';
 linkedTaskIds: string[];
 createdAt: string;
}

export interface ProjectTemplate {
 id: string;
 name: string;
 description: string;
 category: 'ISO27001' | 'Audit' | 'Incident' | 'Deployment' | 'Training' | 'Custom';
 defaultTasks: Omit<ProjectTask, 'id'>[];
 defaultMilestones: Omit<ProjectMilestone, 'id' | 'projectId'>[];
 estimatedDuration: number; // days
 icon: string;
}

export interface Project {
 id: string;
 organizationId: string;
 name: string;
 description: string;
 manager: string;
 managerId?: string;
 framework?: Framework;
 status: 'Planifié' | 'En cours' | 'Terminé' | 'Suspendu';
 startDate?: string; // Added for Gantt chart
 dueDate: string;
 progress: number;
 category?: string;
 tasks: ProjectTask[];
 relatedRiskIds?: string[];
 relatedControlIds?: string[];
 relatedAssetIds?: string[];
 relatedAuditIds?: string[];
 members?: string[]; // IDs of team members
 milestones?: ProjectMilestone[];
 createdAt: string;
 updatedAt?: string;
}
