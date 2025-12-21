import { Framework } from './common';

export interface Audit {
    id: string;
    organizationId: string;
    name: string;
    type: 'Interne' | 'Externe' | 'Certification' | 'Fournisseur';
    auditor: string;
    dateScheduled: string;
    status: 'Planifié' | 'En cours' | 'Terminé' | 'Validé';
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
    type: 'Majeure' | 'Mineure' | 'Observation' | 'Opportunité';
    status: 'Ouvert' | 'Fermé';
    relatedControlId?: string;
    evidenceIds?: string[];
    createdAt: string;
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
