import { Framework } from './common';

/**
 * Unified audit status enumeration
 */
export const AUDIT_STATUSES = [
    'Planifié',
    'En cours',
    'Terminé',
    'Validé'
] as const;

export type AuditStatus = typeof AUDIT_STATUSES[number];

/**
 * Finding types (category of finding)
 */
export const FINDING_TYPES = [
    'Majeure',
    'Mineure',
    'Observation',
    'Opportunité'
] as const;

export type FindingType = typeof FINDING_TYPES[number];

/**
 * Finding severity levels (independent of type for filtering)
 */
export const FINDING_SEVERITIES = [
    'Critique',
    'Haute',
    'Moyenne',
    'Faible',
    'Info'
] as const;

export type FindingSeverity = typeof FINDING_SEVERITIES[number];

/**
 * Finding status enumeration
 */
export const FINDING_STATUSES = [
    'Ouvert',
    'En cours',
    'Fermé',
    'Accepté'
] as const;

export type FindingStatus = typeof FINDING_STATUSES[number];

export interface Audit {
    id: string;
    organizationId: string;
    name: string;
    type: 'Interne' | 'Externe' | 'Certification' | 'Fournisseur';
    auditor: string;
    dateScheduled: string;
    status: AuditStatus;
    findingsCount: number;
    description?: string;
    scope?: string;
    framework?: Framework;
    relatedAssetIds?: string[];
    relatedRiskIds?: string[];
    relatedProjectIds?: string[];
    relatedControlIds?: string[];
    findings?: Finding[];
    collaborators?: string[]; // User IDs of internal collaborators
    externalAuditors?: string[]; // Emails of external auditors
    createdBy?: string; // User ID of the creator (for Segregation of Duties)
    createdAt?: string;
    updatedAt?: string;
    score?: number; // Added for Audit reporting
    reference?: string; // e.g. AUD-2024-001
    standard?: string; // e.g. ISO 27001
}

export interface EvidenceRequest {
    id: string;
    auditId: string;
    organizationId: string;
    title: string;
    description: string;
    status: 'Pending' | 'Provided' | 'Accepted' | 'Rejected';
    requestedBy: string; // User ID
    assignedTo?: string; // User ID
    dueDate?: string;
    documentIds?: string[]; // Linked evidence documents
    createdAt: string;
    updatedAt: string;
    relatedControlId?: string;
}

export interface Finding {
    id: string;
    organizationId: string;
    auditId: string;
    description: string;
    type: FindingType;
    severity: FindingSeverity;
    status: FindingStatus;
    relatedControlId?: string;
    evidenceIds?: string[];
    ownerId?: string;
    dueDate?: string;
    recommendation?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface AuditQuestion {
    id: string;
    controlCode: string;
    question: string;
    response: 'Conforme' | 'Non-conforme' | 'Observation' | 'Non-applicable';
    comment?: string;
    evidenceIds?: string[];
}

export interface AuditChecklist {
    id: string;
    auditId: string;
    organizationId: string;
    questions: AuditQuestion[];
    completedBy?: string;
    completedAt?: string;
}

export type QuestionType = 'text' | 'yes_no' | 'choice' | 'multiple_choice' | 'rating';

export interface QuestionnaireQuestion {
    id: string;
    text: string;
    type: QuestionType;
    options?: string[]; // For choice/multiple_choice
    required: boolean;
    description?: string;
}

export interface Questionnaire {
    id: string;
    organizationId: string;
    auditId: string;
    title: string;
    description?: string;
    questions: QuestionnaireQuestion[];
    status: 'Draft' | 'Published' | 'Closed';
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    dueDate?: string;
    targetAudience?: string[]; // User IDs or Emails
}

export interface QuestionnaireResponse {
    id: string;
    questionnaireId: string;
    organizationId: string;
    auditId: string;
    respondentId: string; // User ID
    respondentEmail?: string; // For external
    answers: Record<string, string | string[] | number>; // questionId -> answer
    evidence?: Record<string, string[]>; // questionId -> documentIds[]
    aiAnalysis?: string; // AI generated analysis
    score?: number;
    status: 'In Progress' | 'Submitted';
    submittedAt?: string;
    startedAt: string;
    updatedAt: string;
}

/**
 * Audit Workshop Phase Status
 */
export type WorkshopPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

/**
 * Audit Workshop Phase
 */
export interface AuditWorkshopPhase {
    id: string;
    name: string;
    description: string;
    status: WorkshopPhaseStatus;
    order: number;
    tasks: AuditWorkshopTask[];
    dueDate?: string;
    completedAt?: string;
    responsible?: string;
    deliverables?: string[];
}

/**
 * Audit Workshop Task
 */
export interface AuditWorkshopTask {
    id: string;
    title: string;
    description: string;
    isCompleted: boolean;
    isRequired: boolean;
    helpText?: string;
    linkedDocumentIds?: string[];
    linkedControlIds?: string[];
}

/**
 * Audit Method Template
 */
export interface AuditMethodTemplate {
    id: string;
    name: string;
    type: 'Interne' | 'Externe' | 'Certification';
    framework?: string; // ISO 27001, SOC 2, etc.
    description: string;
    phases: Omit<AuditWorkshopPhase, 'status' | 'completedAt'>[];
    estimatedDuration: string; // e.g., "2-4 semaines"
    bestPractices: string[];
    deliverables: string[];
    isDefault?: boolean;
}

/**
 * Audit Workshop (instance of a method template for a specific audit)
 */
export interface AuditWorkshop {
    id: string;
    auditId: string;
    organizationId: string;
    templateId: string;
    name: string;
    type: 'Interne' | 'Externe' | 'Certification';
    status: 'not_started' | 'in_progress' | 'completed' | 'cancelled';
    phases: AuditWorkshopPhase[];
    progress: number; // 0-100
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
    notes?: string;
}
